import admin from "../firebaseAdmin.js";

const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split("Bearer ")[1];

        if (!token) {
            return res.status(401).send("Unauthorized");
        }

        const decoded = await admin.auth().verifyIdToken(token);

        req.user = decoded;
        next();

    } catch (error) {
        res.status(401).send("Invalid token");
    }
};

export default verifyToken;
