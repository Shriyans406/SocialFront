// client/src/Editor.jsx
/******************************************************************
 * REAL-TIME COLLABORATION FLOW
 *
 * User types → Tiptap updates Yjs document
 * Yjs document → Hocuspocus WebSocket
 * WebSocket → Other connected clients
 * Other clients → Instantly update editor
 *
 * No refresh required.
 * All changes are CRDT-based (conflict-free).
 ******************************************************************/

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

import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ListOrdered,
  Outdent,
  Indent,
  Type,
} from "lucide-react";

import {
  Bold,
  Italic,
  Strikethrough,
  Undo,
  Redo,
  List,
  Heading1,
  Heading2,
  Code,
  Minus,
  Image as ImageIcon,
  Upload,
  Share2,
  X,
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

import { Extension } from "@tiptap/core";

import { useParams } from "react-router-dom";

const getRandomColor = () => colors[Math.floor(Math.random() * colors.length)];

const getColorFromString = (str) => {
  if (!str) return "#958DF1";

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

/*************  ✨ Windsurf Command ⭐  *************/
/**
 * The Editor component is the core of the application. It provides a
 * text editing interface for users to collaborate on documents.
 *
 * It uses the Tiptap library to render the editor and handle user
 * input. It also uses the Hocuspocus library to establish a secure
 * connection between clients and the server.
 *
 * The component takes a single prop, `documentId`, which is used to
 * identify the document to be edited. If no `documentId` is provided,
 * the component will render a message indicating that it is missing.
 *
 * The component also renders a loading state while the connection to
 * the server is being established. If the connection fails to
 * establish, the component will render an error message and provide
 * a button to refresh the page.
 */
/*******  0076e54f-0809-4635-956d-4cb1f4211cfa  *******/
/******************************************************************
 * Custom Caret Renderer
 * Renders a thin vertical pipe + username label (Google Docs style)
 ******************************************************************/
const customCaretRenderer = (caretUser) => {
  const wrapper = document.createElement("span");
  wrapper.style.position = "relative";

  // Thin vertical pipe
  const cursor = document.createElement("span");
  cursor.style.borderLeft = `2px solid ${caretUser.color}`;
  cursor.style.height = "1em";
  cursor.style.marginLeft = "-1px";
  cursor.style.marginRight = "-1px";
  cursor.style.display = "inline-block";
  cursor.style.verticalAlign = "text-bottom";

  // Username label
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
};

const Editor = () => {
  // This hook pulls the ID directly from the URL path (/document/:documentId)
  const { documentId } = useParams();
  //if (!documentId) {
  //return <div className="editor-container">Missing documentId</div>;
  //}

  const [provider, setProvider] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState("offline");

  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("editor"); // editor | viewer
  const [sharedWithList, setSharedWithList] = useState([]);
  const [userRole, setUserRole] = useState("owner"); // current user's role on this doc

  /******************************************************************
   * Firebase Auth Listener
   * Keeps track of logged-in user for cursor identity
   ******************************************************************/
  const [user, setUser] = useState(null);

  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });

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
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ documentId, title: newTitle }),
      });
      if (!response.ok) {
        throw new Error("Failed to save title");
      }
    } catch (err) {
      console.error("Save failed", err);
      alert("Failed to save document title.");
    }
  };

  // 1️⃣ Create Yjs document + Hocuspocus provider
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

    // Track active users
    wsProvider.awareness.on("update", () => {
      const states = Array.from(wsProvider.awareness.getStates().values());
      // Filter out users that don't have user info (or ourselves if we only want others, but usually we show all)
      const validUsers = states.filter(state => state.user && state.user.name);

      // Deduplicate by user id or name if one user has multiple tabs open
      const uniqueUsers = Array.from(new Map(validUsers.map(item => [item.user.id || item.user.name, item])).values());
      setActiveUsers(uniqueUsers);
    });

    // Existing Status Listener
    wsProvider.on("status", ({ status }) => {
      console.log("WebSocket Status Update:", status);
      setConnectionStatus(status);

      if (status === "connected") {
        console.log("Forcing loading to false via status");
        setLoading(false);
      }
    });

    // --- ADD THIS SECTION HERE ---
    wsProvider.on("synced", () => {
      console.log("Sync complete! Data loaded from MongoDB.");
      setLoading(false); // This is the line that clears your loading screen
    });
    // -----------------------------

    setProvider(wsProvider);

    return () => {
      wsProvider.off("status");
      wsProvider.off("synced"); // Clean up the listener
      wsProvider.destroy();
      ydoc.destroy();
    };
  }, [documentId]);

  // Fetch document metadata (title, role, permissions)
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!user || !documentId) return;
      try {
        const token = await user.getIdToken();
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(
          `${API_URL}/api/documents/metadata/${documentId}`,
          { headers: { "Authorization": `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          setTitle(data.title === "Untitled document" ? "" : (data.title || ""));
          setUserRole(data.userRole || "viewer");
          // Build sharedWith list from permissions array
          const perms = (data.permissions || []).filter(p => p.role !== "owner");
          setSharedWithList(perms);
        }
      } catch (err) {
        console.error("Error fetching metadata:", err);
      }
    };
    fetchMetadata();
  }, [documentId, user]);
  // 2️⃣ Build extensions (StarterKit ALWAYS present)
  // const extensions = useMemo(() => {
  //   const baseExtensions = [
  //     StarterKit.configure({ history: false }),
  //     ImageResize,
  //   ];

  //   if (!provider) {
  //     return baseExtensions;
  //   }

  //   if (!provider.wsconnected) {
  //     return baseExtensions;
  //   }

  //   return [
  //     ...baseExtensions,

  //     Collaboration.configure({
  //       document: provider.doc,
  //       field: "content",
  //     }),

  //     CollaborationCursor.configure({
  //       provider: provider,
  //       user: {
  //         name: "Dev B",
  //         color: getRandomColor(),
  //       },
  //     }),
  //   ];
  // }, [provider, provider?.wsconnected]);

  const extensions = useMemo(() => {
    const baseExtensions = [
      StarterKit.configure({ history: false }),
      Image,
      ImageResize,
      TextStyle,
      FontFamily,
      TextAlign.configure({
        types: ["heading", "paragraph"], // Allows alignment on these blocks
      }),
    ];

    // 1. SAFETY: Check if the provider OR its document is missing.
    // This prevents the "getXmlFragment" crash while the page loads.
    if (!provider || !provider.doc) {
      return baseExtensions;
    }

    // 2. THE BRIDGE: Now that doc exists, we can safely add collaboration.
    // We DO NOT check wsconnected here anymore.
    return [
      ...baseExtensions,
      Collaboration.configure({
        document: provider.doc, // Connects the editor to the server's data
        field: "content", // Matches standard Hocuspocus configuration
      }),
      CollaborationCaret.configure({
        provider: provider,
        user: {
          name: "Dev B",
          color: getRandomColor(),
        },
      }),
    ];
  }, [provider]); // Re-run only when provider changes

  const editorKey = provider?.document ? "ready" : "loading";

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Image,
        ImageResize,
        TextStyle,
        FontFamily,
        TextAlign.configure({ types: ["heading", "paragraph"] }),

        // Custom Enter behavior
        Extension.create({
          name: "customEnter",
          addKeyboardShortcuts() {
            return {
              Enter: () => this.editor.commands.setHardBreak(),
            };
          },
        }),

        // Collaboration (only added once provider is ready)
        ...(provider && user
          ? [
            Collaboration.configure({
              document: provider.document,
            }),

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

  // 4️⃣ Loading state
  if (!editor || !provider) {
    return <div className="editor-container">Connecting...</div>;
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    /*

    const localUrl = URL.createObjectURL(file);
    editor.chain().focus().setImage({ src: localUrl }).run();
    
    */

    // 1. Create a "FormData" package to send the file
    const formData = new FormData();
    formData.append("image", file);

    try {
      // 2. Send the file to Developer A's API
      // Note: Use http://localhost:3000/upload (or whatever port Dev A uses)
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();

        // 3. Insert the image into Tiptap using the URL returned by the server
        // The server usually returns { url: "http://..." }
        editor.chain().focus().setImage({ src: data.url }).run();
      } else {
        console.error("Upload failed");
        alert("Failed to upload image to server.");
      }
    } catch (error) {
      console.error("Error uploading:", error);
      alert("Server not responding. Is the Backend running?");
    }
  };

  const copyRoomLink = () => {
    // 1. Get the current URL from the address bar
    const url = window.location.href;

    // 2. Copy it to the clipboard
    navigator.clipboard
      .writeText(url)
      .then(() => {
        // 3. Show a little message so the user knows it worked
        alert("Room link copied to clipboard! Share it with a friend.");
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
      });
  };

  const handleShare = async () => {
    if (!shareEmail.trim() || !user) return;
    try {
      const token = await user.getIdToken();
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const response = await fetch(`${API_URL}/api/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ email: shareEmail, role: shareRole }),
      });
      if (response.ok) {
        setSharedWithList(prev => {
          const existing = prev.filter(p => p.userEmail !== shareEmail.toLowerCase());
          return [...existing, { userEmail: shareEmail.toLowerCase(), role: shareRole }];
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
    <div className="google-docs-app">
      {/* SHARE MODAL */}
      {isShareModalOpen && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", justifyContent: "center", alignItems: "center"
        }}>
          <div style={{
            background: "white", padding: "24px", borderRadius: "8px",
            width: "440px", maxWidth: "90%", boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#202124" }}>Share document</h2>
              <button onClick={() => setIsShareModalOpen(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#5F6368" }}>
                <X size={20} />
              </button>
            </div>

            {/* Email + Role selector row */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <input
                type="email"
                placeholder="Add people by email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid #DADCE0", borderRadius: "4px", fontSize: "14px" }}
              />
              <select
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value)}
                style={{ padding: "8px", border: "1px solid #DADCE0", borderRadius: "4px", fontSize: "14px", color: "#202124" }}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleShare}
                style={{ background: "#1A73E8", color: "white", border: "none", padding: "8px 16px", borderRadius: "4px", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                Send
              </button>
            </div>

            <h3 style={{ fontSize: "0.9rem", color: "#5F6368", marginBottom: "12px", fontWeight: "500" }}>People with access</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: "180px", overflowY: "auto" }}>
              {sharedWithList.length === 0 ? (
                <li style={{ color: "#70757A", fontSize: "0.9rem" }}>Only you have access</li>
              ) : (
                sharedWithList.map(perm => {
                  const email = perm.userEmail || perm;
                  const role = perm.role || "editor";
                  return (
                    <li key={email} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                      <div style={{
                        width: "32px", height: "32px", borderRadius: "50%", background: getColorFromString(email),
                        color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", flexShrink: 0,
                      }}>
                        {email.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ color: "#202124", fontSize: "0.9rem", flex: 1 }}>{email}</span>
                      <span style={{
                        fontSize: "11px", padding: "2px 8px", borderRadius: "10px", fontWeight: "600",
                        background: role === "editor" ? "#e8f0fe" : "#f1f3f4",
                        color: role === "editor" ? "#1a73e8" : "#5f6368",
                      }}>
                        {role}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>

            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #DADCE0", display: "flex", justifyContent: "space-between" }}>
              <button
                onClick={copyRoomLink}
                style={{ display: "flex", alignItems: "center", gap: "8px", background: "transparent", border: "1px solid #DADCE0", padding: "8px 16px", borderRadius: "24px", color: "#1A73E8", cursor: "pointer", fontWeight: "500" }}
              >
                <Share2 size={16} /> Copy link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. THE TOP HEADER: Title and Share Button */}
      <header className="docs-header">
        <div className="header-left">
          <div className="docs-logo">
            {/* Official Google Docs Icon for similarity */}
            <img
              src="https://cdn.worldvectorlogo.com/logos/svg-2.svg"
              alt="logo"
              width="36"
              style={{ cursor: "pointer" }}
              onClick={() => window.location.href = "/dashboard"}
            />
          </div>
          <div className="title-section">
            <input
              type="text"
              className="docs-title-input"
              placeholder="Untitled document"
              value={title}
              onChange={(e) => userRole !== "viewer" && setTitle(e.target.value)}
              onBlur={(e) => userRole !== "viewer" && updateTitle(e.target.value)}
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
                color: title === "" ? "#999" : "#202124",
                cursor: userRole === "viewer" ? "default" : "text",
              }}
            />
          </div>
        </div>

        <div className="header-right" style={{ display: "flex", alignItems: "center", gap: "16px" }}>

          {/* Active Users Avatars */}
          <div style={{ display: "flex", flexDirection: "row-reverse" }}>
            {activeUsers.map((u, i) => (
              <div
                key={u.user.id || i}
                title={u.user.name}
                style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  backgroundColor: u.user.color || getColorFromString(u.user.name),
                  color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: "bold", fontSize: "14px", marginLeft: i > 0 ? "-8px" : "0",
                  border: "2px solid white", zIndex: activeUsers.length - i
                }}
              >
                {u.user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>

          <div className="status-container">
            <span
              className={`status-dot ${connectionStatus === "connected" ? "online" : "offline"}`}
            >
              ●
            </span>
            <span className="status-text">
              {connectionStatus === "connected"
                ? "Connected"
                : connectionStatus === "connecting"
                  ? "Connecting"
                  : "Offline"}
            </span>
          </div>
          <button className="docs-share-button" onClick={() => setIsShareModalOpen(true)}>
            <Share2 size={18} /> Share
          </button>
        </div>
      </header>

      {/* 2. THE TOOLBAR: Pill-shaped icon bar */}
      <div className="toolbar-wrapper">
        <div className="google-toolbar">
          {/* 1. Existing History Group */}
          <button
            onClick={() => editor.chain().focus().undo().run()}
            title="Undo"
          >
            <Undo size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            title="Redo"
          >
            <Redo size={18} />
          </button>
          <div className="toolbar-divider" />

          {/* 2. NEW: Font Family Dropdown */}
          <select
            onChange={(e) =>
              editor.chain().focus().setFontFamily(e.target.value).run()
            }
            className="font-select"
            defaultValue="Arial"
          >
            <option value="Arial">Arial</option>
            <option value="Courier New">Courier New</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Verdana">Verdana</option>
          </select>
          <div className="toolbar-divider" />

          {/* 3. Existing Text Style Group */}
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "active" : ""}
          >
            <Bold size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "active" : ""}
          >
            <Italic size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive("strike") ? "active" : ""}
          >
            <Strikethrough size={18} />
          </button>
          <div className="toolbar-divider" />

          {/* 4. NEW: Alignment Group (from your image_e3f238.png) */}
          <button
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={editor.isActive({ textAlign: "left" }) ? "active" : ""}
          >
            <AlignLeft size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={editor.isActive({ textAlign: "center" }) ? "active" : ""}
          >
            <AlignCenter size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={editor.isActive({ textAlign: "right" }) ? "active" : ""}
          >
            <AlignRight size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            className={
              editor.isActive({ textAlign: "justify" }) ? "active" : ""
            }
          >
            <AlignJustify size={18} />
          </button>
          <div className="toolbar-divider" />

          {/* 5. Existing Heading & Bullet List Group */}
          <button
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            className={editor.isActive("heading", { level: 1 }) ? "active" : ""}
          >
            H1
          </button>
          <button
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={editor.isActive("heading", { level: 2 }) ? "active" : ""}
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "active" : ""}
          >
            <List size={18} />
          </button>

          {/* 6. NEW: Ordered List & Indentation (from your image_e3f238.png) */}
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "active" : ""}
          >
            <ListOrdered size={18} />
          </button>
          <button
            onClick={() =>
              editor.chain().focus().liftListItem("listItem").run()
            }
            title="Outdent"
          >
            <Outdent size={18} />
          </button>
          <button
            onClick={() =>
              editor.chain().focus().sinkListItem("listItem").run()
            }
            title="Indent"
          >
            <Indent size={18} />
          </button>

          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive("codeBlock") ? "active" : ""}
          >
            <Code size={18} />
          </button>
          <div className="toolbar-divider" />

          {/* 7. Existing Media Group */}
          <button
            onClick={() => {
              const url = window.prompt("Paste image URL:");
              if (url) editor.chain().focus().setImage({ src: url }).run();
            }}
          >
            <ImageIcon size={18} />
          </button>
          <button onClick={() => document.getElementById("fileInput").click()}>
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

      {/* 3. THE CANVAS: White paper on gray background */}
      <main className="docs-canvas">
        {/* Switch from checking provider properties to checking your local state */}
        {!loading && editor ? (
          <div className="page-container">
            <EditorContent editor={editor} />
          </div>
        ) : (
          <div
            className="loading-state"
            style={{ textAlign: "center", marginTop: "50px" }}
          >
            <p>Establishing secure sync...</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: "10px",
                padding: "5px 10px",
                cursor: "pointer",
              }}
            >
              Click to Refresh
            </button>
          </div>
        )}
      </main>

      {/* <input
        type="text"
        className="docs-title-input"
        placeholder="Untitled document"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        // Trigger save when you click away
        onBlur={(e) => updateTitle(e.target.value)}
        // Trigger save when you press Enter
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            updateTitle(e.target.value);
            e.target.blur(); // This removes the cursor from the box
          }
        }}
      /> */}
    </div>
  );
};

export default Editor;
