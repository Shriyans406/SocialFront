import "./styles.scss";
import { useEffect, useState, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import Image from "@tiptap/extension-image";
import ImageResize from "tiptap-extension-resize-image";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { FontFamily } from "@tiptap/extension-font-family";
import { TextStyle } from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { useParams } from "react-router-dom";
import useDarkMode from "./useDarkMode";

import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ListOrdered,
  Outdent,
  Indent,
} from "lucide-react";
import {
  Bold,
  Italic,
  Strikethrough,
  Undo,
  Redo,
  List,
  Code,
  Image as ImageIcon,
  Upload,
  Share2,
  X,
  Sun,
  Moon,
} from "lucide-react";

const colors = [
  "#958DF1",
  "#F98181",
  "#FBBC88",
  "#FAF594",
  "#70CFF8",
  "#94FADB",
  "#B9F18D",
];
const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];
const getColorFromString = (str) => {
  if (!str) return "#958DF1";
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const uploadImageFile = async (file, editor) => {
  if (!file || !editor) return;
  const formData = new FormData();
  formData.append("image", file);
  try {
    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const response = await fetch(`${API_URL}/upload`, {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      const data = await response.json();
      editor.chain().focus().setImage({ src: data.url }).run();
    } else {
      alert("Failed to upload image to server.");
    }
  } catch (error) {
    alert("Server not responding. Is the Backend running?");
  }
};

const Editor = () => {
  const { documentId } = useParams();
  const [isDark, toggleDark] = useDarkMode();

  const [provider, setProvider] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("offline");
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("editor");
  const [sharedWithList, setSharedWithList] = useState([]);
  const [userRole, setUserRole] = useState("owner");
  const [user, setUser] = useState(null);

  // ── Palette ─────────────────────────────────────────────────────────────
  const c = {
    appBg: isDark ? "#111827" : "#f8f9fa",
    headerBg: isDark ? "#1f2937" : "white",
    headerBorder: isDark ? "#374151" : "#e0e0e0",
    toolbarBg: isDark ? "#1a2332" : "#f8f9fa",
    toolbarPillBg: isDark ? "#263040" : "#edf2fa",
    toolbarBtn: isDark ? "#9aa0a6" : "#444",
    toolbarHover: isDark ? "#374151" : "#dee1e6",
    toolbarActive: isDark ? "#1a3a6b" : "#d3e3fd",
    toolbarActiveColor: isDark ? "#8ab4f8" : "#041e49",
    divider: isDark ? "#374151" : "#c7c7c7",
    canvasBg: isDark ? "#111827" : "#f8f9fa",
    pageBg: isDark ? "#1f2937" : "white",
    pageText: isDark ? "#e8eaed" : "#202124",
    titleColor: isDark ? "#e8eaed" : "#202124",
    titlePlaceholder: isDark ? "#6b7280" : "#999",
    statusOnline: isDark ? "#34d399" : "#34a853",
    statusOffline: isDark ? "#f87171" : "#ea4335",
    statusText: isDark ? "#9aa0a6" : "#5f6368",
    shareBtnBg: isDark ? "#1a3a6b" : "#c2e7ff",
    shareBtnColor: isDark ? "#8ab4f8" : "#202124",
    toggleBg: isDark ? "#374151" : "#e8eaed",
    toggleColor: isDark ? "#f9ab00" : "#5f6368",
    modalOverlay: "rgba(0,0,0,0.6)",
    modalBg: isDark ? "#1f2937" : "white",
    modalBorder: isDark ? "#374151" : "#dadce0",
    modalTitle: isDark ? "#e8eaed" : "#202124",
    modalLabel: isDark ? "#9aa0a6" : "#5f6368",
    inputBg: isDark ? "#111827" : "white",
    inputBorder: isDark ? "#374151" : "#dadce0",
    inputColor: isDark ? "#e8eaed" : "#202124",
    selectBg: isDark ? "#111827" : "white",
    sendBtnBg: isDark ? "#8ab4f8" : "#1a73e8",
    sendBtnColor: isDark ? "#202124" : "white",
    copyLinkBorder: isDark ? "#374151" : "#dadce0",
    copyLinkColor: isDark ? "#8ab4f8" : "#1a73e8",
    fontSelectBg: isDark ? "#263040" : "white",
    fontSelectColor: isDark ? "#e8eaed" : "#444",
    fontSelectHover: isDark ? "#374151" : "#dee1e6",
  };

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) =>
      setUser(firebaseUser),
    );
    return () => unsubscribe();
  }, []);

  const updateTitle = async (newTitle) => {
    try {
      if (!user) return;
      const token = await user.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/documents/update-title`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId, title: newTitle }),
      });
      if (!response.ok) throw new Error("Failed to save title");
    } catch (err) {
      console.error("Save failed", err);
      alert("Failed to save document title.");
    }
  };

  // ── Hocuspocus provider ──────────────────────────────────────────────────
  useEffect(() => {
    const ydoc = new Y.Doc();
    const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:1234";
    const wsProvider = new HocuspocusProvider({
      url: WS_URL,
      name: documentId || "default-room",
      document: ydoc,
      token: async () => {
        const auth = getAuth();
        if (!auth.currentUser) return "";
        return await auth.currentUser.getIdToken();
      },
      connect: true,
    });

    wsProvider.awareness.on("update", () => {
      const states = Array.from(wsProvider.awareness.getStates().values());
      const validUsers = states.filter((s) => s.user && s.user.name);
      const uniqueUsers = Array.from(
        new Map(validUsers.map((i) => [i.user.id || i.user.name, i])).values(),
      );
      setActiveUsers(uniqueUsers);
    });

    wsProvider.on("status", ({ status }) => {
      setConnectionStatus(status);
      if (status === "connected") setLoading(false);
    });

    wsProvider.on("synced", () => setLoading(false));
    setProvider(wsProvider);

    return () => {
      wsProvider.off("status");
      wsProvider.off("synced");
      wsProvider.destroy();
      ydoc.destroy();
    };
  }, [documentId]);

  // ── Metadata ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!user || !documentId) return;
      try {
        const token = await user.getIdToken();
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(
          `${API_URL}/api/documents/metadata/${documentId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (response.ok) {
          const data = await response.json();
          setTitle(data.title === "Untitled document" ? "" : data.title || "");
          setUserRole(data.userRole || "viewer");
          const perms = (data.permissions || []).filter(
            (p) => p.role !== "owner",
          );
          setSharedWithList(perms);
        }
      } catch (err) {
        console.error("Error fetching metadata:", err);
      }
    };
    fetchMetadata();
  }, [documentId, user]);

  // ── Editor ────────────────────────────────────────────────────────────────
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Image,
        ImageResize,
        TextStyle,
        FontFamily,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        Extension.create({
          name: "customEnter",
          addKeyboardShortcuts() {
            return { Enter: () => this.editor.commands.setHardBreak() };
          },
        }),
        Extension.create({
          name: "imagePaste",
          addProseMirrorPlugins() {
            const editor = this.editor;
            return [
              new Plugin({
                key: new PluginKey("imagePaste"),
                props: {
                  handlePaste(view, event) {
                    const items = Array.from(event.clipboardData?.items || []);
                    const imageItem = items.find((item) =>
                      item.type.startsWith("image/"),
                    );
                    if (imageItem) {
                      const file = imageItem.getAsFile();
                      if (file) {
                        event.preventDefault();
                        uploadImageFile(file, editor);
                        return true;
                      }
                    }
                    return false;
                  },
                },
              }),
            ];
          },
        }),
        ...(provider && user
          ? [
              Collaboration.configure({ document: provider.document }),
              CollaborationCaret.configure({
                provider,
                user: {
                  name: user.displayName || user.email || "Anonymous",
                  color: getColorFromString(user.uid || user.email || "anon"),
                },
                render: (caretUser) => {
                  const wrapper = document.createElement("span");
                  wrapper.style.position = "relative";
                  const cursor = document.createElement("span");
                  cursor.style.borderLeft = `2px solid ${caretUser.color}`;
                  cursor.style.height = "1em";
                  cursor.style.marginLeft = "-1px";
                  cursor.style.marginRight = "-1px";
                  cursor.style.display = "inline-block";
                  cursor.style.verticalAlign = "text-bottom";
                  const label = document.createElement("div");
                  label.textContent = caretUser.name;
                  label.style.position = "absolute";
                  label.style.top = "-22px";
                  label.style.left = "0";
                  label.style.backgroundColor = caretUser.color;
                  label.style.color = "white";
                  label.style.fontSize = "11px";
                  label.style.padding = "2px 6px";
                  label.style.borderRadius = "4px";
                  label.style.whiteSpace = "nowrap";
                  wrapper.append(cursor);
                  wrapper.append(label);
                  return wrapper;
                },
              }),
            ]
          : []),
      ],
      immediatelyRender: false,
    },
    [provider, user],
  );

  if (!editor || !provider) {
    return (
      <div
        style={{
          background: c.appBg,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: c.pageText,
        }}
      >
        Connecting...
      </div>
    );
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    await uploadImageFile(file, editor);
  };

  const copyRoomLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() =>
        alert("Room link copied to clipboard! Share it with a friend."),
      )
      .catch((err) => console.error("Could not copy text: ", err));
  };

  const handleShare = async () => {
    if (!shareEmail.trim() || !user) return;
    try {
      const token = await user.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(
        `${API_URL}/api/documents/${documentId}/share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email: shareEmail, role: shareRole }),
        },
      );
      if (response.ok) {
        setSharedWithList((prev) => {
          const existing = prev.filter(
            (p) => p.userEmail !== shareEmail.toLowerCase(),
          );
          return [
            ...existing,
            { userEmail: shareEmail.toLowerCase(), role: shareRole },
          ];
        });
        setShareEmail("");
        alert(`Successfully shared with ${shareEmail} as ${shareRole}`);
      } else {
        const errData = await response.json();
        alert(`Failed to share: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error sharing document.");
    }
  };

  return (
    <div
      className={`google-docs-app${isDark ? " dark-mode" : ""}`}
      style={{ backgroundColor: c.appBg }}
    >
      {/* ── SHARE MODAL ──────────────────────────────────────────────────── */}
      {isShareModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: c.modalOverlay,
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              background: c.modalBg,
              padding: "24px",
              borderRadius: "8px",
              width: "440px",
              maxWidth: "90%",
              boxShadow: isDark
                ? "0 4px 24px rgba(0,0,0,0.6)"
                : "0 4px 6px rgba(0,0,0,0.1)",
              border: `1px solid ${c.modalBorder}`,
              transition: "background 0.3s",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{ margin: 0, fontSize: "1.25rem", color: c.modalTitle }}
              >
                Share document
              </h2>
              <button
                onClick={() => setIsShareModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: c.modalLabel,
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <input
                type="email"
                placeholder="Add people by email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: `1px solid ${c.inputBorder}`,
                  borderRadius: "4px",
                  fontSize: "14px",
                  background: c.inputBg,
                  color: c.inputColor,
                  outline: "none",
                }}
              />
              <select
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value)}
                style={{
                  padding: "8px",
                  border: `1px solid ${c.inputBorder}`,
                  borderRadius: "4px",
                  fontSize: "14px",
                  color: c.inputColor,
                  background: c.selectBg,
                  outline: "none",
                }}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleShare}
                style={{
                  background: c.sendBtnBg,
                  color: c.sendBtnColor,
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Send
              </button>
            </div>

            <h3
              style={{
                fontSize: "0.9rem",
                color: c.modalLabel,
                marginBottom: "12px",
                fontWeight: "500",
              }}
            >
              People with access
            </h3>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                maxHeight: "180px",
                overflowY: "auto",
              }}
            >
              {sharedWithList.length === 0 ? (
                <li style={{ color: c.modalLabel, fontSize: "0.9rem" }}>
                  Only you have access
                </li>
              ) : (
                sharedWithList.map((perm) => {
                  const email = perm.userEmail || perm;
                  const role = perm.role || "editor";
                  return (
                    <li
                      key={email}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        marginBottom: "12px",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          background: getColorFromString(email),
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                          flexShrink: 0,
                        }}
                      >
                        {email.charAt(0).toUpperCase()}
                      </div>
                      <span
                        style={{
                          color: c.modalTitle,
                          fontSize: "0.9rem",
                          flex: 1,
                        }}
                      >
                        {email}
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "10px",
                          fontWeight: "600",
                          background:
                            role === "editor"
                              ? isDark
                                ? "#1a3a6b"
                                : "#e8f0fe"
                              : isDark
                                ? "#2d3748"
                                : "#f1f3f4",
                          color:
                            role === "editor"
                              ? isDark
                                ? "#8ab4f8"
                                : "#1a73e8"
                              : isDark
                                ? "#9aa0a6"
                                : "#5f6368",
                        }}
                      >
                        {role}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>

            <div
              style={{
                marginTop: "24px",
                paddingTop: "16px",
                borderTop: `1px solid ${c.modalBorder}`,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <button
                onClick={copyRoomLink}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "transparent",
                  border: `1px solid ${c.copyLinkBorder}`,
                  padding: "8px 16px",
                  borderRadius: "24px",
                  color: c.copyLinkColor,
                  cursor: "pointer",
                  fontWeight: "500",
                }}
              >
                <Share2 size={16} /> Copy link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <header
        className="docs-header"
        style={{
          background: c.headerBg,
          borderBottom: `1px solid ${c.headerBorder}`,
        }}
      >
        <div className="header-left">
          <div className="docs-logo">
            <img
              src="https://cdn.worldvectorlogo.com/logos/svg-2.svg"
              alt="logo"
              width="36"
              style={{ cursor: "pointer" }}
              onClick={() => (window.location.href = "/dashboard")}
            />
          </div>
          <div className="title-section">
            <input
              type="text"
              className="docs-title-input"
              placeholder="Untitled document"
              value={title}
              onChange={(e) =>
                userRole !== "viewer" && setTitle(e.target.value)
              }
              onBlur={(e) =>
                userRole !== "viewer" && updateTitle(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && userRole !== "viewer") {
                  updateTitle(e.target.value);
                  e.target.blur();
                }
              }}
              readOnly={userRole === "viewer"}
              title={userRole === "viewer" ? "You have view-only access" : ""}
              style={{
                fontSize: "18px",
                border: "none",
                outline: "none",
                background: "transparent",
                color: title === "" ? c.titlePlaceholder : c.titleColor,
                cursor: userRole === "viewer" ? "default" : "text",
              }}
            />
          </div>
        </div>

        <div
          className="header-right"
          style={{ display: "flex", alignItems: "center", gap: "16px" }}
        >
          {/* Active user avatars */}
          <div style={{ display: "flex", flexDirection: "row-reverse" }}>
            {activeUsers.map((u, i) => (
              <div
                key={u.user.id || i}
                title={u.user.name}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  backgroundColor:
                    u.user.color || getColorFromString(u.user.name),
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "14px",
                  marginLeft: i > 0 ? "-8px" : "0",
                  border: `2px solid ${c.headerBg}`,
                  zIndex: activeUsers.length - i,
                }}
              >
                {u.user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          {/* Connection status */}
          <div className="status-container">
            <span
              className={`status-dot ${connectionStatus === "connected" ? "online" : "offline"}`}
              style={{
                color:
                  connectionStatus === "connected"
                    ? c.statusOnline
                    : c.statusOffline,
              }}
            >
              ●
            </span>
            <span className="status-text" style={{ color: c.statusText }}>
              {connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "connecting"
                  ? "Connecting"
                  : "Offline"}
            </span>
          </div>

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
              flexShrink: 0,
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            className="docs-share-button"
            onClick={() => setIsShareModalOpen(true)}
            style={{ background: c.shareBtnBg, color: c.shareBtnColor }}
          >
            <Share2 size={18} /> Share
          </button>
        </div>
      </header>

      {/* ── TOOLBAR ──────────────────────────────────────────────────────── */}
      <div
        className="toolbar-wrapper"
        style={{
          background: c.toolbarBg,
          borderTop: `1px solid ${isDark ? "#374151" : "#e0e0e0"}`,
        }}
      >
        <div
          className="google-toolbar"
          style={{ backgroundColor: c.toolbarPillBg }}
        >
          {/* Undo / Redo */}
          {[
            {
              action: () => editor.chain().focus().undo().run(),
              icon: <Undo size={18} />,
              title: "Undo",
            },
            {
              action: () => editor.chain().focus().redo().run(),
              icon: <Redo size={18} />,
              title: "Redo",
            },
          ].map((btn) => (
            <button
              key={btn.title}
              onClick={btn.action}
              title={btn.title}
              style={{ color: c.toolbarBtn }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = c.toolbarHover)
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              {btn.icon}
            </button>
          ))}

          <div className="toolbar-divider" style={{ background: c.divider }} />

          {/* Font selector */}
          <select
            onChange={(e) =>
              editor.chain().focus().setFontFamily(e.target.value).run()
            }
            className="font-select"
            defaultValue="Arial"
            style={{
              background: c.fontSelectBg,
              color: c.fontSelectColor,
              border: `1px solid transparent`,
            }}
          >
            <option value="Arial">Arial</option>
            <option value="Courier New">Courier New</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Verdana">Verdana</option>
          </select>

          <div className="toolbar-divider" style={{ background: c.divider }} />

          {/* Text style buttons */}
          {[
            {
              action: () => editor.chain().focus().toggleBold().run(),
              icon: <Bold size={18} />,
              active: editor.isActive("bold"),
            },
            {
              action: () => editor.chain().focus().toggleItalic().run(),
              icon: <Italic size={18} />,
              active: editor.isActive("italic"),
            },
            {
              action: () => editor.chain().focus().toggleStrike().run(),
              icon: <Strikethrough size={18} />,
              active: editor.isActive("strike"),
            },
          ].map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              className={btn.active ? "active" : ""}
              style={{
                color: btn.active ? c.toolbarActiveColor : c.toolbarBtn,
                background: btn.active ? c.toolbarActive : "transparent",
              }}
              onMouseOver={(e) =>
                !btn.active &&
                (e.currentTarget.style.background = c.toolbarHover)
              }
              onMouseOut={(e) =>
                !btn.active &&
                (e.currentTarget.style.background = "transparent")
              }
            >
              {btn.icon}
            </button>
          ))}

          <div className="toolbar-divider" style={{ background: c.divider }} />

          {/* Alignment */}
          {[
            {
              action: () => editor.chain().focus().setTextAlign("left").run(),
              icon: <AlignLeft size={18} />,
              align: "left",
            },
            {
              action: () => editor.chain().focus().setTextAlign("center").run(),
              icon: <AlignCenter size={18} />,
              align: "center",
            },
            {
              action: () => editor.chain().focus().setTextAlign("right").run(),
              icon: <AlignRight size={18} />,
              align: "right",
            },
            {
              action: () =>
                editor.chain().focus().setTextAlign("justify").run(),
              icon: <AlignJustify size={18} />,
              align: "justify",
            },
          ].map((btn) => {
            const active = editor.isActive({ textAlign: btn.align });
            return (
              <button
                key={btn.align}
                onClick={btn.action}
                className={active ? "active" : ""}
                style={{
                  color: active ? c.toolbarActiveColor : c.toolbarBtn,
                  background: active ? c.toolbarActive : "transparent",
                }}
                onMouseOver={(e) =>
                  !active && (e.currentTarget.style.background = c.toolbarHover)
                }
                onMouseOut={(e) =>
                  !active && (e.currentTarget.style.background = "transparent")
                }
              >
                {btn.icon}
              </button>
            );
          })}

          <div className="toolbar-divider" style={{ background: c.divider }} />

          {/* Headings + Lists */}
          {[
            {
              action: () =>
                editor.chain().focus().toggleHeading({ level: 1 }).run(),
              label: "H1",
              active: editor.isActive("heading", { level: 1 }),
            },
            {
              action: () =>
                editor.chain().focus().toggleHeading({ level: 2 }).run(),
              label: "H2",
              active: editor.isActive("heading", { level: 2 }),
            },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className={btn.active ? "active" : ""}
              style={{
                color: btn.active ? c.toolbarActiveColor : c.toolbarBtn,
                background: btn.active ? c.toolbarActive : "transparent",
              }}
              onMouseOver={(e) =>
                !btn.active &&
                (e.currentTarget.style.background = c.toolbarHover)
              }
              onMouseOut={(e) =>
                !btn.active &&
                (e.currentTarget.style.background = "transparent")
              }
            >
              {btn.label}
            </button>
          ))}

          {[
            {
              action: () => editor.chain().focus().toggleBulletList().run(),
              icon: <List size={18} />,
              active: editor.isActive("bulletList"),
            },
            {
              action: () => editor.chain().focus().toggleOrderedList().run(),
              icon: <ListOrdered size={18} />,
              active: editor.isActive("orderedList"),
            },
            {
              action: () =>
                editor.chain().focus().liftListItem("listItem").run(),
              icon: <Outdent size={18} />,
              active: false,
              title: "Outdent",
            },
            {
              action: () =>
                editor.chain().focus().sinkListItem("listItem").run(),
              icon: <Indent size={18} />,
              active: false,
              title: "Indent",
            },
            {
              action: () => editor.chain().focus().toggleCodeBlock().run(),
              icon: <Code size={18} />,
              active: editor.isActive("codeBlock"),
            },
          ].map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              title={btn.title || ""}
              className={btn.active ? "active" : ""}
              style={{
                color: btn.active ? c.toolbarActiveColor : c.toolbarBtn,
                background: btn.active ? c.toolbarActive : "transparent",
              }}
              onMouseOver={(e) =>
                !btn.active &&
                (e.currentTarget.style.background = c.toolbarHover)
              }
              onMouseOut={(e) =>
                !btn.active &&
                (e.currentTarget.style.background = "transparent")
              }
            >
              {btn.icon}
            </button>
          ))}

          <div className="toolbar-divider" style={{ background: c.divider }} />

          {/* Media */}
          <button
            onClick={() => {
              const url = window.prompt("Paste image URL:");
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}
            style={{ color: c.toolbarBtn }}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = c.toolbarHover)
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <ImageIcon size={18} />
          </button>
          <button
            onClick={() => document.getElementById("fileInput").click()}
            style={{ color: c.toolbarBtn }}
            onMouseOver={(e) =>
              (e.currentTarget.style.background = c.toolbarHover)
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <Upload size={18} />
          </button>
          <input
            type="file"
            id="fileInput"
            style={{ display: "none" }}
            accept="image/*"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* ── CANVAS ───────────────────────────────────────────────────────── */}
      <main className="docs-canvas" style={{ background: c.canvasBg }}>
        {!loading && editor ? (
          <div
            className={`page-container${isDark ? " dark-page" : ""}`}
            style={{
              background: c.pageBg,
              color: c.pageText,
              boxShadow: isDark
                ? "0 1px 8px rgba(0,0,0,0.4)"
                : "0 1px 3px rgba(0,0,0,0.1)",
            }}
          >
            <EditorContent editor={editor} />
          </div>
        ) : (
          <div
            className="loading-state"
            style={{
              textAlign: "center",
              marginTop: "50px",
              color: c.statusText,
            }}
          >
            <p>Establishing secure sync...</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: "10px",
                padding: "5px 10px",
                cursor: "pointer",
                background: c.sendBtnBg,
                color: c.sendBtnColor,
                border: "none",
                borderRadius: "4px",
              }}
            >
              Click to Refresh
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Editor;
