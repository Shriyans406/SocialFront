import connectMongo from "../persistence/mongo.js";

/**
 * Middleware factory for role-based access control.
 * Usage: requireRole("owner") or requireRole("editor", "owner")
 *
 * "owner" always has access, regardless of which roles are listed.
 * The documentId must be in req.params.documentId.
 */
const requireRole = (...allowedRoles) => async (req, res, next) => {
    try {
        const db = await connectMongo();
        const permission = await db.collection("permissions").findOne({
            documentId: req.params.documentId,
            userId: req.user.uid,
        });

        if (!permission) {
            return res.status(403).json({ error: "Access denied: no permission found" });
        }

        // Owner always passes
        if (permission.role === "owner") {
            req.userRole = "owner";
            return next();
        }

        if (!allowedRoles.includes(permission.role)) {
            return res.status(403).json({ error: `Access denied: requires one of [${allowedRoles.join(", ")}]` });
        }

        req.userRole = permission.role;
        next();
    } catch (err) {
        console.error("requireRole error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
};

export default requireRole;
