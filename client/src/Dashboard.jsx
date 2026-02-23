import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./firebase/config";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Plus, FileText, LogOut } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 1. Fetch real documents from MongoDB on load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // FETCH real files using the User ID
        try {
          const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
          const response = await fetch(
            `${API_URL}/api/documents/${currentUser.uid}`,
          );
          if (response.ok) {
            const data = await response.json();
            setDocuments(data); // This fills your "Recent Documents" section
          } else {
            console.error("Failed to fetch documents");
          }
        } catch (err) {
          console.error("Dashboard Fetch Error:", err);
          alert("Failed to fetch recent documents.");
        } finally {
          setLoading(false);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 2. Register the new document in MongoDB before navigating
  const createNewDocument = async () => {
    const newId = uuidv4();
    const userId = auth.currentUser?.uid; // Should be 'OjX21TsDXK...'

    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      // We must call Port 3000 to reach your Express server
      const response = await fetch(
        `${API_URL}/api/documents/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            documentId: newId,
            ownerId: userId,
            title: "Untitled document",
          }),
        },
      );

      if (response.ok) {
        console.log("Metadata created successfully!");
        navigate(`/document/${newId}`);
      } else {
        throw new Error("Server responded with an error");
      }
    } catch (err) {
      console.error("Failed to create metadata record:", err);
      alert("Failed to create document.");
    }
  };

  const deleteDocument = async (e, documentId) => {
    // CRITICAL: Stops the browser from opening the file while you try to delete it
    e.stopPropagation();

    if (!window.confirm("Are you sure? This deletes the file from everywhere."))
      return;

    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(
        `${API_URL}/api/documents/${documentId}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        },
      );

      if (response.ok) {
        // Instantly remove the card from the UI
        setDocuments((prev) =>
          prev.filter((doc) => doc.documentId !== documentId),
        );
      } else {
        throw new Error("Failed to delete from server");
      }
    } catch (err) {
      console.error("UI Delete Error:", err);
      alert("Failed to delete document.");
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (!user || loading) return <div className="loading" style={{ textAlign: "center", marginTop: "50px", fontFamily: "sans-serif" }}>Loading your Dashboard...</div>;

  return (
    <div
      className="dashboard-container"
      style={{ background: "#f8f9fa", minHeight: "100vh" }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between", // Forces logo to left and user info to right
          alignItems: "center",
          padding: "8px 20px",
          background: "white",
          borderBottom: "1px solid #dadce0",
          width: "100%", // Ensures it spans the full browser width
          boxSizing: "border-box", // Prevents padding from causing overflow
        }}
      >
        {/* --- LEFT SIDE: LOGO AND NAME --- */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="https://cdn.worldvectorlogo.com/logos/svg-2.svg"
            alt="Docs Logo"
            style={{ width: "35px", height: "35px", cursor: "pointer" }}
            onClick={() => navigate("/dashboard")}
          />
          <span
            style={{
              fontSize: "22px",
              color: "#5f6368",
              fontWeight: "400",
              fontFamily: "Product Sans, Arial, sans-serif",
            }}
          >
            Docs
          </span>
        </div>

        {/* --- RIGHT SIDE: EMAIL AND LOGOUT --- */}
        <div
          style={{
            display: "flex",
            flexDirection: "column", // Stacks email directly above the button
            alignItems: "flex-end", // Aligns both text and button to the right edge
            gap: "4px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              color: "#5f6368",
              fontWeight: "500",
              marginRight: "4px", // Small tweak for alignment
            }}
          >
            {user?.email} {/* Dynamic email from your auth state */}
          </span>

          <button
            onClick={handleLogout}
            style={{
              padding: "6px 20px",
              background: "#1a73e8",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1765cc")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1a73e8")}
          >
            Logout
          </button>
        </div>
      </header>

      <div style={{ background: "#f1f3f4", padding: "40px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <p style={{ marginBottom: "15px", color: "#202124" }}>
            Start a new document
          </p>
          <div
            onClick={createNewDocument}
            style={{
              width: "150px",
              height: "190px",
              background: "white",
              border: "1px solid #dadce0",
              borderRadius: "4px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
              transition: "0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = "#1a73e8")}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = "#dadce0")}
          >
            <Plus size={48} color="#1a73e8" />
          </div>
          <p
            style={{
              marginTop: "10px",
              fontSize: "0.8rem",
              fontWeight: "bold",
            }}
          >
            Blank
          </p>
        </div>
      </div>

      <div
        style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px" }}
      >
        <p style={{ marginBottom: "20px", fontWeight: "500" }}>
          Recent documents
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "20px",
          }}
        >
          {documents.map((doc) => (
            <div
              key={doc.documentId}
              onClick={() => navigate(`/document/${doc.documentId}`)}
              style={{
                background: "white",
                border: "1px solid #dadce0",
                borderRadius: "4px",
                cursor: "pointer",
                position: "relative", // Needed for the button positioning
              }}
            >
              {/* THE DELETE BUTTON (THE CROSS SYMBOL) */}
              <button
                onClick={(e) => deleteDocument(e, doc.documentId)}
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  background: "#f1f3f4",
                  border: "none",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#5f6368",
                  zIndex: "10",
                  fontWeight: "bold",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#e8eaed")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#f1f3f4")
                }
              >
                ×
              </button>

              <div
                style={{
                  height: "140px",
                  borderBottom: "1px solid #f1f3f4",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  color: "#1a73e8",
                }}
              >
                <FileText size={40} />
              </div>
              <div style={{ padding: "10px" }}>
                <p
                  style={{
                    fontSize: "0.9rem",
                    margin: "0",
                    fontWeight: "500",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {doc.title}
                </p>
                <p
                  style={{
                    fontSize: "0.7rem",
                    color: "#70757a",
                    marginTop: "5px",
                  }}
                >
                  {doc.createdAt
                    ? new Date(doc.createdAt).toLocaleDateString()
                    : "Recent"}
                </p>
              </div>
            </div>
          ))}
          {documents.length === 0 && (
            <p style={{ color: "#70757a" }}>
              No documents yet. Click '+' to start!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
