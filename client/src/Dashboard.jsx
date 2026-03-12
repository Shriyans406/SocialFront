import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "./firebase/config";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  Plus,
  FileText,
  LogOut,
  Star,
  Archive,
  Copy,
  Trash2,
  MoreVertical,
  Sun,
  Moon,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import useDarkMode from "./useDarkMode";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("recent");
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const [isDark, toggleDark] = useDarkMode();

  // ── Palette ──────────────────────────────────────────────────────────────
  const c = {
    pageBg: isDark ? "#111827" : "#f8f9fa",
    headerBg: isDark ? "#1f2937" : "white",
    headerBorder: isDark ? "#374151" : "#dadce0",
    sectionBg: isDark ? "#1a2332" : "#f1f3f4",
    cardBg: isDark ? "#1f2937" : "white",
    cardBorder: isDark ? "#374151" : "#dadce0",
    cardHoverShadow: isDark
      ? "0 2px 8px rgba(0,0,0,0.5)"
      : "0 2px 8px rgba(0,0,0,0.15)",
    textPrimary: isDark ? "#e8eaed" : "#202124",
    textSecondary: isDark ? "#9aa0a6" : "#5f6368",
    textMuted: isDark ? "#6b7280" : "#70757a",
    accent: isDark ? "#8ab4f8" : "#1a73e8",
    accentHover: isDark ? "#aecbfa" : "#1765cc",
    tabActiveBorder: isDark ? "#8ab4f8" : "#1a73e8",
    tabBorder: isDark ? "#374151" : "#dadce0",
    dropdownBg: isDark ? "#2d3748" : "white",
    dropdownBorder: isDark ? "#4a5568" : "#dadce0",
    dropdownHover: isDark ? "#374151" : "#f1f3f4",
    iconAreaBg: isDark ? "#263040" : "#f9fbff",
    toggleBg: isDark ? "#374151" : "#e8eaed",
    toggleColor: isDark ? "#f9ab00" : "#5f6368",
    newDocBorder: isDark ? "#374151" : "#dadce0",
    newDocHover: isDark ? "#8ab4f8" : "#1a73e8",
    btnBg: isDark ? "#8ab4f8" : "#1a73e8",
    btnColor: isDark ? "#202124" : "white",
    btnHover: isDark ? "#aecbfa" : "#1765cc",
  };

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
      const response = await fetch(
        `${API_URL}/api/documents/${currentUser.uid}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
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

  const createNewDocument = async () => {
    const newId = uuidv4();
    const userId = auth.currentUser?.uid;
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/documents/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

  const deleteDocument = async (e, documentId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    if (!window.confirm("Are you sure? This deletes the file permanently."))
      return;
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/documents/${documentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
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

  const starDocument = async (e, documentId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(
        `${API_URL}/api/documents/${documentId}/star`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const { isStarred } = await response.json();
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.documentId === documentId ? { ...doc, isStarred } : doc,
          ),
        );
      }
    } catch (err) {
      console.error("Star error:", err);
    }
  };

  const archiveDocument = async (e, documentId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(
        `${API_URL}/api/documents/${documentId}/archive`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const { isArchived } = await response.json();
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.documentId === documentId ? { ...doc, isArchived } : doc,
          ),
        );
      }
    } catch (err) {
      console.error("Archive error:", err);
    }
  };

  const duplicateDocument = async (e, documentId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(
        `${API_URL}/api/documents/${documentId}/duplicate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        await fetchDocuments(auth.currentUser);
      }
    } catch (err) {
      console.error("Duplicate error:", err);
    }
  };

  const handleLogout = () => signOut(auth);

  const filteredDocs = documents.filter((doc) => {
    if (activeTab === "archived") return doc.isArchived;
    if (activeTab === "owned")
      return (
        !doc.isArchived &&
        (doc.ownerId === user?.uid || doc.ownerEmail === user?.email)
      );
    return !doc.isArchived;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return "Recently";
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!user || loading)
    return (
      <div
        style={{
          textAlign: "center",
          marginTop: "50px",
          fontFamily: "sans-serif",
          color: isDark ? "#e8eaed" : "#202124",
          background: c.pageBg,
          minHeight: "100vh",
          paddingTop: "80px",
        }}
      >
        Loading your Dashboard...
      </div>
    );

  const tabs = [
    { id: "recent", label: "Recent" },
    { id: "owned", label: "Owned by me" },
    { id: "archived", label: "Archived" },
  ];

  return (
    <div
      style={{
        background: c.pageBg,
        minHeight: "100vh",
        transition: "background 0.3s",
      }}
    >
      {/* HEADER */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 20px",
          background: c.headerBg,
          borderBottom: `1px solid ${c.headerBorder}`,
          width: "100%",
          boxSizing: "border-box",
          transition: "background 0.3s, border-color 0.3s",
        }}
      >
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
              color: c.textSecondary,
              fontWeight: "400",
              fontFamily: "Product Sans, Arial, sans-serif",
              transition: "color 0.3s",
            }}
          >
            Docs
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            style={{
              background: c.toggleBg,
              border: "none",
              borderRadius: "50%",
              width: "36px",
              height: "36px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: c.toggleColor,
              transition: "background 0.3s, color 0.3s",
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                color: c.textSecondary,
                fontWeight: "500",
                transition: "color 0.3s",
              }}
            >
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: "6px 20px",
                background: c.btnBg,
                color: c.btnColor,
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "500",
                transition: "background 0.3s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = c.btnHover)
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = c.btnBg)}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* NEW DOCUMENT SECTION */}
      <div
        style={{
          background: c.sectionBg,
          padding: "40px",
          transition: "background 0.3s",
        }}
      >
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <p
            style={{
              marginBottom: "15px",
              color: c.textPrimary,
              transition: "color 0.3s",
            }}
          >
            Start a new document
          </p>
          <div
            onClick={createNewDocument}
            style={{
              width: "150px",
              height: "190px",
              background: c.cardBg,
              border: `1px solid ${c.newDocBorder}`,
              borderRadius: "4px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              cursor: "pointer",
              transition: "border-color 0.2s, background 0.3s",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.borderColor = c.newDocHover)
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.borderColor = c.newDocBorder)
            }
          >
            <Plus size={48} color={c.accent} />
          </div>
          <p
            style={{
              marginTop: "10px",
              fontSize: "0.8rem",
              fontWeight: "bold",
              color: c.textPrimary,
              transition: "color 0.3s",
            }}
          >
            Blank
          </p>
        </div>
      </div>

      {/* TABS + DOCUMENT GRID */}
      <div
        style={{ maxWidth: "800px", margin: "40px auto", padding: "0 20px" }}
      >
        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: "20px",
            marginBottom: "20px",
            borderBottom: `1px solid ${c.tabBorder}`,
            transition: "border-color 0.3s",
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: "none",
                border: "none",
                padding: "10px 0",
                cursor: "pointer",
                fontWeight: activeTab === tab.id ? "600" : "400",
                color: activeTab === tab.id ? c.accent : c.textSecondary,
                borderBottom:
                  activeTab === tab.id
                    ? `3px solid ${c.tabActiveBorder}`
                    : "3px solid transparent",
                fontSize: "0.95rem",
                transition: "color 0.3s, border-color 0.3s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Document grid */}
        {filteredDocs.length === 0 ? (
          <p style={{ color: c.textMuted, transition: "color 0.3s" }}>
            {activeTab === "archived"
              ? "No archived documents."
              : "No documents yet. Click '+' to start!"}
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "20px",
            }}
          >
            {filteredDocs.map((doc) => (
              <div
                key={doc.documentId}
                onClick={() => navigate(`/document/${doc.documentId}`)}
                style={{
                  background: c.cardBg,
                  border: `1px solid ${c.cardBorder}`,
                  borderRadius: "4px",
                  cursor: "pointer",
                  position: "relative",
                  transition:
                    "box-shadow 0.2s, background 0.3s, border-color 0.3s",
                }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.boxShadow = c.cardHoverShadow)
                }
                onMouseOut={(e) => (e.currentTarget.style.boxShadow = "none")}
              >
                {/* Star badge */}
                {doc.isStarred && (
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      left: "8px",
                      zIndex: 9,
                      fontSize: "14px",
                    }}
                  >
                    ⭐
                  </div>
                )}

                {/* Role badge */}
                {doc.userRole && doc.userRole !== "owner" && (
                  <div
                    style={{
                      position: "absolute",
                      top: "6px",
                      left: doc.isStarred ? "28px" : "8px",
                      zIndex: 9,
                      background:
                        doc.userRole === "editor"
                          ? isDark
                            ? "#1a3a6b"
                            : "#e8f0fe"
                          : isDark
                            ? "#2d3748"
                            : "#f1f3f4",
                      color:
                        doc.userRole === "editor" ? c.accent : c.textSecondary,
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "10px",
                      fontWeight: "600",
                    }}
                  >
                    {doc.userRole}
                  </div>
                )}

                {/* 3-dot context menu */}
                <div
                  ref={openMenuId === doc.documentId ? menuRef : null}
                  style={{
                    position: "absolute",
                    top: "6px",
                    right: "6px",
                    zIndex: 10,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(
                      openMenuId === doc.documentId ? null : doc.documentId,
                    );
                  }}
                >
                  <div
                    style={{
                      borderRadius: "50%",
                      width: "28px",
                      height: "28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: c.textSecondary,
                      background:
                        openMenuId === doc.documentId
                          ? isDark
                            ? "#374151"
                            : "#e8eaed"
                          : "transparent",
                      transition: "background 0.2s",
                    }}
                    onMouseOver={(e) =>
                      (e.currentTarget.style.background = isDark
                        ? "#374151"
                        : "#e8eaed")
                    }
                    onMouseOut={(e) =>
                      (e.currentTarget.style.background =
                        openMenuId === doc.documentId
                          ? isDark
                            ? "#374151"
                            : "#e8eaed"
                          : "transparent")
                    }
                  >
                    <MoreVertical size={16} />
                  </div>

                  {openMenuId === doc.documentId && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "32px",
                        background: c.dropdownBg,
                        border: `1px solid ${c.dropdownBorder}`,
                        borderRadius: "4px",
                        boxShadow: isDark
                          ? "0 4px 12px rgba(0,0,0,0.5)"
                          : "0 4px 12px rgba(0,0,0,0.15)",
                        zIndex: 100,
                        minWidth: "160px",
                        transition: "background 0.3s",
                      }}
                    >
                      {[
                        {
                          icon: <Star size={14} />,
                          label: doc.isStarred ? "Unstar" : "Star",
                          action: (e) => starDocument(e, doc.documentId),
                        },
                        ...(doc.userRole === "owner"
                          ? [
                              {
                                icon: <Copy size={14} />,
                                label: "Duplicate",
                                action: (e) =>
                                  duplicateDocument(e, doc.documentId),
                              },
                              {
                                icon: <Archive size={14} />,
                                label: doc.isArchived ? "Unarchive" : "Archive",
                                action: (e) =>
                                  archiveDocument(e, doc.documentId),
                              },
                              {
                                icon: <Trash2 size={14} />,
                                label: "Delete",
                                action: (e) =>
                                  deleteDocument(e, doc.documentId),
                                danger: true,
                              },
                            ]
                          : []),
                      ].map((item) => (
                        <div
                          key={item.label}
                          onClick={item.action}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 14px",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            color: item.danger ? "#f28b82" : c.textPrimary,
                            transition: "background 0.15s",
                          }}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.background = c.dropdownHover)
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          {item.icon} {item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Document thumbnail */}
                <div
                  style={{
                    height: "140px",
                    borderBottom: `1px solid ${isDark ? "#374151" : "#f1f3f4"}`,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    color: c.accent,
                    background: c.iconAreaBg,
                    borderRadius: "4px 4px 0 0",
                    transition: "background 0.3s",
                  }}
                >
                  <FileText size={40} />
                </div>

                {/* Document info */}
                <div style={{ padding: "10px" }}>
                  <p
                    style={{
                      fontSize: "0.9rem",
                      margin: "0",
                      fontWeight: "500",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: c.textPrimary,
                      transition: "color 0.3s",
                    }}
                  >
                    {doc.title || "Untitled document"}
                  </p>
                  <p
                    style={{
                      fontSize: "0.7rem",
                      color: c.textMuted,
                      marginTop: "4px",
                      transition: "color 0.3s",
                    }}
                  >
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
