import admin from "firebase-admin";

// Initialize Firebase Admin without credentials (works for ID token verification if projectId is provided)
admin.initializeApp({
    projectId: "docs-clone-2306d"
});

export default admin;
