import mongoose from "mongoose";

const PermissionSchema = new mongoose.Schema({
    documentId: { type: String, required: true },
    userId: { type: String, required: true },  // Firebase UID
    userEmail: { type: String, required: true },
    role: { type: String, enum: ["owner", "editor", "viewer"], required: true },
    createdAt: { type: Date, default: Date.now },
});

// Compound index so there's only one permission record per (document, user)
PermissionSchema.index({ documentId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Permission", PermissionSchema);
