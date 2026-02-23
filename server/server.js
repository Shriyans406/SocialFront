import dotenv from "dotenv";
dotenv.config();

import http from "http";
import express from "express";
import cors from "cors";
import connectMongo from "./persistence/mongo.js";
import hocuspocusServer from "./collaborations/hocuspocus.js";
import verifyToken from "./middleware/auth.js";

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

// ---------- PHASE 3: DOCUMENT MANAGEMENT ROUTES ----------

// 1. CREATE Route - Updated to use the new connection logic
app.post("/api/documents/create", verifyToken, async (req, res) => {
  const { documentId, ownerId, title } = req.body;
  const userEmail = req.user.email; // From decoded token

  try {
    const db = await connectMongo();
    await db.collection("document_metadata").insertOne({
      documentId,
      ownerId,            // Kept for backward compatibility
      ownerEmail: userEmail, // explicitly save email
      title: title || "Untitled document",
      sharedWith: [],     // Array of emails
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("CREATE ERROR:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// 2. FETCH ALL Route - Returns docs owned by OR shared with user
app.get("/api/documents/:userId", verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const db = await connectMongo();

    // We look for documents where the user is the owner OR their email is in sharedWith
    const userDocs = await db
      .collection("document_metadata")
      .find({
        $or: [
          { ownerId: req.params.userId },
          { ownerEmail: userEmail },
          { sharedWith: userEmail }
        ]
      })
      .toArray();

    res.json(userDocs);
  } catch (error) {
    console.error("FETCH LIST ERROR:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. FETCH ONE Route - Verify access rights
app.get("/api/documents/metadata/:documentId", verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const db = await connectMongo();
    const doc = await db.collection("document_metadata").findOne({
      documentId: req.params.documentId,
    });

    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Check permissions
    const isOwner = doc.ownerId === req.user.uid || doc.ownerEmail === userEmail;
    const isShared = doc.sharedWith && doc.sharedWith.includes(userEmail);

    if (!isOwner && !isShared) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(doc);
  } catch (error) {
    console.error("FETCH METADATA ERROR:", error);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

// 4. UPDATE Route - Updated to remove .db()
app.patch("/api/documents/update-title", verifyToken, async (req, res) => {
  const { documentId, title } = req.body;
  try {
    const userEmail = req.user.email;
    const db = await connectMongo();

    // First check access
    const doc = await db.collection("document_metadata").findOne({ documentId });
    if (!doc) return res.status(404).json({ error: "Not found" });

    const isOwner = doc.ownerId === req.user.uid || doc.ownerEmail === userEmail;
    const isShared = doc.sharedWith && doc.sharedWith.includes(userEmail);
    if (!isOwner && !isShared) return res.status(403).json({ error: "Access denied" });

    await db
      .collection("document_metadata")
      .updateOne(
        { documentId: documentId },
        { $set: { title: title, updatedAt: new Date() } },
      );
    res.json({ success: true });
  } catch (error) {
    console.error("UPDATE TITLE ERROR:", error);
    res.status(500).json({ error: "Failed to update title" });
  }
});

// 5. SHARE Route - Add an email to sharedWith array
app.post("/api/documents/:documentId/share", verifyToken, async (req, res) => {
  const { documentId } = req.params;
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const userEmail = req.user.email;
    const db = await connectMongo();

    // Only the owner should be able to share (or anyone with access, but typically owner)
    const doc = await db.collection("document_metadata").findOne({ documentId });
    if (!doc) return res.status(404).json({ error: "Not found" });

    const isOwner = doc.ownerId === req.user.uid || doc.ownerEmail === userEmail;
    if (!isOwner) {
      return res.status(403).json({ error: "Only the owner can share this document" });
    }

    await db.collection("document_metadata").updateOne(
      { documentId },
      { $addToSet: { sharedWith: email.toLowerCase() } } // $addToSet prevents duplicates
    );

    res.json({ success: true, message: `Shared with ${email}` });
  } catch (error) {
    console.error("SHARE ERROR:", error);
    res.status(500).json({ error: "Failed to share document" });
  }
});

// DELETE Route: Removes document from both metadata and raw data buckets
app.delete("/api/documents/:documentId", verifyToken, async (req, res) => {
  const { documentId } = req.params;
  try {
    const db = await connectMongo();

    // 1. Check access
    const doc = await db.collection("document_metadata").findOne({ documentId });
    if (!doc) return res.status(404).json({ error: "Not found" });

    // Only owner can delete
    const isOwner = doc.ownerId === req.user.uid || doc.ownerEmail === req.user.email;
    if (!isOwner) return res.status(403).json({ error: "Only the owner can delete" });

    // 2. Delete the dashboard entry
    const deleteMetadata = await db
      .collection("document_metadata")
      .deleteOne({ documentId });

    // 3. Delete the actual text data (Hocuspocus/Yjs bucket)
    const deleteData = await db
      .collection("documents")
      .deleteOne({ name: documentId });

    if (deleteMetadata.deletedCount > 0) {
      console.log(`Document ${documentId} deleted successfully.`);
      res.json({ success: true, message: "Deleted from all databases" });
    } else {
      res.status(404).json({ error: "Document not found" });
    }
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

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
