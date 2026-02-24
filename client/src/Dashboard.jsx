import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./firebase/config";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { Plus, FileText, LogOut, Star, Archive, Copy, Trash2, MoreVertical } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("recent"); // "recent" | "owned" | "archived"
  const [openMenuId, setOpenMenuId] = useState(null); // Which doc's context menu is open
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 1. Fetch real documents from MongoDB on load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchDocuments(currentUser);
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchDocuments = async (currentUser) => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}/api/documents/${currentUser.uid}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      } else {
        console.error("Failed to fetch documents", await response.text());
      }
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
      alert("Failed to fetch recent documents.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Create new document
  const createNewDocument = async () => {
    const newId = uuidv4();
    const userId = auth.currentUser?.uid;
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/documents/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ documentId: newId, ownerId: userId, title: "" }),
      });
      if (response.ok) {
        navigate(`/document/${newId}`);
      } else {
        throw new Error("Server responded with an error");
      }
    } catch (err) {
      console.error("Failed to create document:", err);
      alert("Failed to create document.");
    }
  };

  // 3. Delete document
  const deleteDocument = async (e, documentId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (!window.confirm("Are you sure? This deletes the file permanently.")) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/documents/${documentId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.documentId !== documentId));
      } else {
        throw new Error("Failed to delete from server");
      }
    } catch (err) {
      console.error("UI Delete Error:", err);
      alert("Failed to delete document.");
    }
  };

  // 4. Star document
  const starDocument = async (e, documentId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/documents/${documentId}/star`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (response.ok) {
        const { isStarred } = await response.json();
        setDocuments((prev) =>
          prev.map((doc) => doc.documentId === documentId ? { ...doc, isStarred } : doc)
        );
      }
    } catch (err) {
      console.error("Star error:", err);
    }
  };

  // 5. Archive / Unarchive document
  const archiveDocument = async (e, documentId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/documents/${documentId}/archive`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (response.ok) {
        const { isArchived } = await response.json();
        setDocuments((prev) =>
          prev.map((doc) => doc.documentId === documentId ? { ...doc, isArchived } : doc)
        );
      }
    } catch (err) {
      console.error("Archive error:", err);
    }
  };

  // 6. Duplicate document
  const duplicateDocument = async (e, documentId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/documents/${documentId}/duplicate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (response.ok) {
        // Refresh the document list
        await fetchDocuments(auth.currentUser);
      }
    } catch (err) {
      console.error("Duplicate error:", err);
    }
  };

  const handleLogout = () => signOut(auth);

  // Filtering logic
  const filteredDocs = documents.filter((doc) => {
    if (activeTab === "archived") return doc.isArchived;
    if (activeTab === "owned") return !doc.isArchived && (doc.ownerId === user?.uid || doc.ownerEmail === user?.email);
    return !doc.isArchived; // recent
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "Recently";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  if (!user || loading) return (
    <div style={{ textAlign: "center", marginTop: "50px", fontFamily: "sans-serif" }}>
      Loading your Dashboard...
    </div>
  );

  const tabs = [
    { id: "recent", label: "Recent" },
    { id: "owned", label: "Owned by me" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <div className="dashboard-container" style={{ background: "#f8f9fa", minHeight: "100vh" }}>
      {/* HEADER */}
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 20px", background: "white", borderBottom: "1px solid #dadce0",
        width: "100%", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src="https://cdn.worldvectorlogo.com/logos/svg-2.svg"
            alt="Docs Logo"
            style={{ width: "35px", height: "35px", cursor: "pointer" }}
            onClick={() => navigate("/dashboard")}
          />
          <span style={{ fontSize: "22px", color: "#5f6368", fontWeight: "400", fontFamily: "Product Sans, Arial, sans-serif" }}>
            Docs
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
          <span style={{ fontSize: "13px", color: "#5f6368", fontWeight: "500" }}>{user?.email}</span>
          <button
            onClick={handleLogout}
            style={{ padding: "6px 20px", background: "#1a73e8", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#1765cc")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#1a73e8")}
          >
            Logout
          </button>
        </div>
      </header>

      {/* NEW DOCUMENT SECTION */}
      <div style={{ background: "#f1f3f4", padding: "40px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <p style={{ marginBottom: "15px", color: "#202124" }}>Start a new document</p>
          <div
            onClick={createNewDocument}
            style={{
              width: "150px", height: "190px", background: "white", border: "1px solid #dadce0",
              borderRadius: "4px", display: "flex", justifyContent: "center", alignItems: "center",
              cursor: "pointer", transition: "0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.borderColor = "#1a73e8")}
            onMouseOut={(e) => (e.currentTarget.style.borderColor = "#dadce0")}
          >
            <Plus size={48} color="#1a73e8" />
          </div>
          <p style={{ marginTop: "10px", fontSize: "0.8rem", fontWeight: "bold" }}>Blank</p>
        </div>
      </div>

      {/* TABS + DOCUMENT GRID */}
      <div style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px" }}>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "20px", borderBottom: "1px solid #dadce0" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: "none", border: "none", padding: "10px 0", cursor: "pointer",
                fontWeight: activeTab === tab.id ? "600" : "400",
                color: activeTab === tab.id ? "#1a73e8" : "#5f6368",
                borderBottom: activeTab === tab.id ? "3px solid #1a73e8" : "3px solid transparent",
                fontSize: "0.95rem",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Document grid */}
        {filteredDocs.length === 0 ? (
          <p style={{ color: "#70757a" }}>
            {activeTab === "archived"
              ? "No archived documents."
              : "No documents yet. Click '+' to start!"}
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "20px" }}>
            {filteredDocs.map((doc) => (
              <div
                key={doc.documentId}
                onClick={() => navigate(`/document/${doc.documentId}`)}
                style={{
                  background: "white", border: "1px solid #dadce0", borderRadius: "4px",
                  cursor: "pointer", position: "relative", transition: "box-shadow 0.2s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)")}
                onMouseOut={(e) => (e.currentTarget.style.boxShadow = "none")}
              >
                {/* Star badge */}
                {doc.isStarred && (
                  <div style={{ position: "absolute", top: "6px", left: "8px", zIndex: 9, fontSize: "14px" }}>⭐</div>
                )}

                {/* Role badge */}
                {doc.userRole && doc.userRole !== "owner" && (
                  <div style={{
                    position: "absolute", top: "6px", left: doc.isStarred ? "28px" : "8px", zIndex: 9,
                    background: doc.userRole === "editor" ? "#e8f0fe" : "#f1f3f4",
                    color: doc.userRole === "editor" ? "#1a73e8" : "#5f6368",
                    fontSize: "10px", padding: "2px 6px", borderRadius: "10px", fontWeight: "600",
                  }}>
                    {doc.userRole}
                  </div>
                )}

                {/* 3-dot context menu trigger */}
                <div
                  ref={openMenuId === doc.documentId ? menuRef : null}
                  style={{ position: "absolute", top: "6px", right: "6px", zIndex: 10 }}
                  onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === doc.documentId ? null : doc.documentId); }}
                >
                  <div style={{
                    borderRadius: "50%", width: "28px", height: "28px", display: "flex",
                    alignItems: "center", justifyContent: "center", color: "#5f6368",
                    background: openMenuId === doc.documentId ? "#e8eaed" : "transparent",
                  }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#e8eaed")}
                    onMouseOut={(e) => (e.currentTarget.style.background = openMenuId === doc.documentId ? "#e8eaed" : "transparent")}
                  >
                    <MoreVertical size={16} />
                  </div>

                  {/* Dropdown menu */}
                  {openMenuId === doc.documentId && (
                    <div style={{
                      position: "absolute", right: 0, top: "32px", background: "white",
                      border: "1px solid #dadce0", borderRadius: "4px", boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      zIndex: 100, minWidth: "160px",
                    }}>
                      {[
                        { icon: <Star size={14} />, label: doc.isStarred ? "Unstar" : "Star", action: (e) => starDocument(e, doc.documentId) },
                        ...(doc.userRole === "owner" ? [
                          { icon: <Copy size={14} />, label: "Duplicate", action: (e) => duplicateDocument(e, doc.documentId) },
                          { icon: <Archive size={14} />, label: doc.isArchived ? "Unarchive" : "Archive", action: (e) => archiveDocument(e, doc.documentId) },
                          { icon: <Trash2 size={14} />, label: "Delete", action: (e) => deleteDocument(e, doc.documentId), danger: true },
                        ] : []),
                      ].map((item) => (
                        <div
                          key={item.label}
                          onClick={item.action}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "10px 14px", cursor: "pointer", fontSize: "0.875rem",
                            color: item.danger ? "#d93025" : "#202124",
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = "#f1f3f4")}
                          onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          {item.icon} {item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Document thumbnail */}
                <div style={{
                  height: "140px", borderBottom: "1px solid #f1f3f4", display: "flex",
                  justifyContent: "center", alignItems: "center", color: "#1a73e8",
                }}>
                  <FileText size={40} />
                </div>

                {/* Document info */}
                <div style={{ padding: "10px" }}>
                  <p style={{ fontSize: "0.9rem", margin: "0", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.title || "Untitled document"}
                  </p>
                  <p style={{ fontSize: "0.7rem", color: "#70757a", marginTop: "4px" }}>
                    {formatDate(doc.lastOpenedAt || doc.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
