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
      await fetch(`http://localhost:3000/api/documents/update-title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, title: newTitle }),
      });
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  // 1️⃣ Create Yjs document + Hocuspocus provider
  useEffect(() => {
    const ydoc = new Y.Doc();

    const wsProvider = new HocuspocusProvider({
      url: "ws://localhost:1234",
      name: documentId || "default-room",
      document: ydoc,
      connect: true,
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

  // This is the new "pipe" specifically for the Title
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!documentId) return;
      try {
        const response = await fetch(
          `http://localhost:3000/api/documents/metadata/${documentId}`,
        );
        if (response.ok) {
          const data = await response.json();
          // If the DB has a title, set it; otherwise keep "Untitled document"
          setTitle(data.title || "Untitled document" ? "" : data.title);
        }
      } catch (err) {
        console.error("Error fetching title:", err);
      }
    };
    fetchMetadata();
  }, [documentId]);
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
      const response = await fetch("http://localhost:3000/upload", {
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

  return (
    <div className="google-docs-app">
      {/* 1. THE TOP HEADER: Title and Share Button */}
      <header className="docs-header">
        <div className="header-left">
          <div className="docs-logo">
            {/* Official Google Docs Icon for similarity */}
            <img
              src="https://cdn.worldvectorlogo.com/logos/svg-2.svg"
              alt="logo"
              width="36"
            />
          </div>
          <div className="title-section">
            <input
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
              style={{
                fontSize: "18px",
                border: "none",
                outline: "none",
                background: "transparent",
                // Add this to make the placeholder look like the Google Docs watermark
                color: title === "" ? "#999" : "#202124",
              }}
            />
          </div>
        </div>

        <div className="header-right">
          <div className="status-container">
            <span
              className={`status-dot ${connectionStatus === "connected" ? "online" : "offline"}`}
            >
              ●
            </span>
            <span className="status-text">
              {connectionStatus === "connected"
                ? "Saved to Drive"
                : "Reconnecting..."}
            </span>
          </div>
          <button className="docs-share-button" onClick={copyRoomLink}>
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
