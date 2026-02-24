import dotenv from "dotenv";
dotenv.config();

import http from "http";
import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import connectMongo from "./persistence/mongo.js";
import hocuspocusServer from "./collaborations/hocuspocus.js";
import verifyToken from "./middleware/auth.js";
import requireRole from "./middleware/requireRole.js";

const app = express();

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.url} - ${duration}ms`);
  });
  next();
};

// ================================================================
// DOCUMENT MANAGEMENT ROUTES
// ================================================================

// 1. CREATE — Also inserts an "owner" permission record
app.post("/api/documents/create", verifyToken, async (req, res) => {
  const { documentId, ownerId, title } = req.body;
  const userEmail = req.user.email;
  const uid = req.user.uid;

  try {
    const db = await connectMongo();

    // Insert metadata
    await db.collection("document_metadata").insertOne({
      documentId,
      ownerId: uid,
      ownerEmail: userEmail,
      title: title !== undefined ? title : "Untitled document",
      icon: "",
      isStarred: false,
      isArchived: false,
      lastEditedBy: userEmail,
      lastOpenedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Insert owner permission
    await db.collection("permissions").insertOne({
      documentId,
      userId: uid,
      userEmail,
      role: "owner",
      createdAt: new Date(),
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error("CREATE ERROR:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// 2. FETCH ALL — Returns docs where user has any permission, sorted by recent
app.get("/api/documents/:userId", verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const uid = req.user.uid;
    const db = await connectMongo();

    // Find all documentIds this user has a permission for
    const userPermissions = await db
      .collection("permissions")
      .find({ $or: [{ userId: uid }, { userEmail }] })
      .toArray();

    const documentIds = userPermissions.map((p) => p.documentId);

    // Fetch the metadata for those docs
    const userDocs = await db
      .collection("document_metadata")
      .find({ documentId: { $in: documentIds } })
      .sort({ lastOpenedAt: -1, updatedAt: -1, createdAt: -1 })
      .toArray();

    // Attach the user's role to each doc
    const permissionMap = {};
    userPermissions.forEach((p) => { permissionMap[p.documentId] = p.role; });

    const docsWithRole = userDocs.map((doc) => ({
      ...doc,
      userRole: permissionMap[doc.documentId] || "viewer",
    }));

    res.json(docsWithRole);
  } catch (error) {
    console.error("FETCH LIST ERROR:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. FETCH ONE METADATA — Checks via permissions collection
app.get("/api/documents/metadata/:documentId", verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const userEmail = req.user.email;
    const db = await connectMongo();

    const permission = await db.collection("permissions").findOne({
      documentId: req.params.documentId,
      $or: [{ userId: uid }, { userEmail }],
    });

    if (!permission) {
      return res.status(403).json({ error: "Access denied" });
    }

    const doc = await db.collection("document_metadata").findOne({
      documentId: req.params.documentId,
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Update lastOpenedAt
    await db.collection("document_metadata").updateOne(
      { documentId: req.params.documentId },
      { $set: { lastOpenedAt: new Date() } }
    );

    // Get all collaborators with their roles
    const permissions = await db
      .collection("permissions")
      .find({ documentId: req.params.documentId })
      .toArray();

    res.json({ ...doc, userRole: permission.role, permissions });
  } catch (error) {
    console.error("FETCH METADATA ERROR:", error);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

// 4. RENAME — Requires editor or owner
app.patch("/api/documents/:documentId/rename", verifyToken, requireRole("editor", "owner"), async (req, res) => {
  const { title } = req.body;
  try {
    const db = await connectMongo();
    await db.collection("document_metadata").updateOne(
      { documentId: req.params.documentId },
      { $set: { title, lastEditedBy: req.user.email, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("RENAME ERROR:", error);
    res.status(500).json({ error: "Failed to rename document" });
  }
});

// Keep old update-title route as alias for backwards compat with Editor.jsx
app.patch("/api/documents/update-title", verifyToken, async (req, res) => {
  const { documentId, title } = req.body;
  try {
    const db = await connectMongo();
    const permission = await db.collection("permissions").findOne({
      documentId,
      $or: [{ userId: req.user.uid }, { userEmail: req.user.email }],
    });
    if (!permission) return res.status(403).json({ error: "Access denied" });
    if (!["owner", "editor"].includes(permission.role)) {
      return res.status(403).json({ error: "Viewers cannot rename documents" });
    }
    await db.collection("document_metadata").updateOne(
      { documentId },
      { $set: { title, lastEditedBy: req.user.email, updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("UPDATE TITLE ERROR:", error);
    res.status(500).json({ error: "Failed to update title" });
  }
});

// 5. STAR — Any role can star for themselves (stored on metadata as global star for now)
app.patch("/api/documents/:documentId/star", verifyToken, requireRole("viewer", "editor", "owner"), async (req, res) => {
  try {
    const db = await connectMongo();
    const doc = await db.collection("document_metadata").findOne({ documentId: req.params.documentId });
    if (!doc) return res.status(404).json({ error: "Not found" });
    await db.collection("document_metadata").updateOne(
      { documentId: req.params.documentId },
      { $set: { isStarred: !doc.isStarred, updatedAt: new Date() } }
    );
    res.json({ success: true, isStarred: !doc.isStarred });
  } catch (error) {
    console.error("STAR ERROR:", error);
    res.status(500).json({ error: "Failed to star document" });
  }
});

// 6. ARCHIVE — Requires owner only
app.patch("/api/documents/:documentId/archive", verifyToken, requireRole("owner"), async (req, res) => {
  try {
    const db = await connectMongo();
    const doc = await db.collection("document_metadata").findOne({ documentId: req.params.documentId });
    if (!doc) return res.status(404).json({ error: "Not found" });
    await db.collection("document_metadata").updateOne(
      { documentId: req.params.documentId },
      { $set: { isArchived: !doc.isArchived, updatedAt: new Date() } }
    );
    res.json({ success: true, isArchived: !doc.isArchived });
  } catch (error) {
    console.error("ARCHIVE ERROR:", error);
    res.status(500).json({ error: "Failed to archive document" });
  }
});

// 7. DUPLICATE — Requires owner
app.post("/api/documents/:documentId/duplicate", verifyToken, requireRole("owner"), async (req, res) => {
  try {
    const db = await connectMongo();
    const original = await db.collection("document_metadata").findOne({ documentId: req.params.documentId });
    if (!original) return res.status(404).json({ error: "Not found" });

    const newId = uuidv4();
    const { _id, documentId, createdAt, updatedAt, lastOpenedAt, ...rest } = original;

    await db.collection("document_metadata").insertOne({
      ...rest,
      documentId: newId,
      title: `${original.title || "Untitled document"} (copy)`,
      ownerId: req.user.uid,
      ownerEmail: req.user.email,
      isStarred: false,
      isArchived: false,
      lastOpenedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Give the duplicating user owner permission on the new doc
    await db.collection("permissions").insertOne({
      documentId: newId,
      userId: req.user.uid,
      userEmail: req.user.email,
      role: "owner",
      createdAt: new Date(),
    });

    res.status(201).json({ success: true, newDocumentId: newId });
  } catch (error) {
    console.error("DUPLICATE ERROR:", error);
    res.status(500).json({ error: "Failed to duplicate document" });
  }
});

// 8. SHARE — Requires owner, assigns role
app.post("/api/documents/:documentId/share", verifyToken, requireRole("owner"), async (req, res) => {
  const { email, role = "editor" } = req.body;

  if (!email) return res.status(400).json({ error: "Email is required" });
  if (!["editor", "viewer"].includes(role)) {
    return res.status(400).json({ error: "Role must be 'editor' or 'viewer'" });
  }

  try {
    const db = await connectMongo();

    // Upsert the permission (update role if already shared)
    await db.collection("permissions").updateOne(
      { documentId: req.params.documentId, userEmail: email.toLowerCase() },
      {
        $set: {
          userEmail: email.toLowerCase(),
          role,
          documentId: req.params.documentId,
        },
        $setOnInsert: { userId: "", createdAt: new Date() },
      },
      { upsert: true }
    );

    res.json({ success: true, message: `Shared with ${email} as ${role}` });
  } catch (error) {
    console.error("SHARE ERROR:", error);
    res.status(500).json({ error: "Failed to share document" });
  }
});

// 9. DELETE — Requires owner; cleans up metadata, permissions, and Yjs data
app.delete("/api/documents/:documentId", verifyToken, requireRole("owner"), async (req, res) => {
  try {
    const db = await connectMongo();

    await db.collection("document_metadata").deleteOne({ documentId: req.params.documentId });
    await db.collection("permissions").deleteMany({ documentId: req.params.documentId });
    await db.collection("documents").deleteOne({ name: req.params.documentId });

    console.log(`Document ${req.params.documentId} deleted successfully.`);
    res.json({ success: true, message: "Deleted from all databases" });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// ================================================================
// FILE UPLOAD (unchanged)
// ================================================================
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

app.post("/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const API_URL = process.env.API_URL || `http://localhost:${PORT}`;
  res.json({ url: `${API_URL}/uploads/${req.file.filename}` });
});

// Serve uploaded files
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname_es = dirname(__filename);
app.use("/uploads", express.static(join(__dirname_es, "uploads")));

// ---------- GENERAL ROUTES ----------
app.get("/", (req, res) => res.send("root"));
app.get("/health", requestLogger, (req, res) => res.send("OK"));
app.get("/status", requestLogger, (req, res) => res.send("Server Running"));

// ---------- ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Something Broke");
});

// ---------- START SERVERS ----------
const startServer = async () => {
  try {
    await connectMongo();

    const server = http.createServer(app);
    server.listen(PORT, () => {
      console.log(`Express running on http://localhost:${PORT}`);
    });

    hocuspocusServer.listen(1234).then(() => {
      console.log("Hocuspocus is officially listening on port 1234");
    });
  } catch (err) {
    console.error("Server failed to start:", err);
    process.exit(1);
  }
};

startServer();
