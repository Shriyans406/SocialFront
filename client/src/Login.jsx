import React, { useState } from "react";
import { auth } from "./firebase/config";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import useDarkMode from "./useDarkMode";

const Login = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [isDark, toggleDark] = useDarkMode();

  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  const bg = isDark ? "#1a1a2e" : "#f0f2f5";
  const cardBg = isDark ? "#16213e" : "white";
  const textPrimary = isDark ? "#e8eaed" : "#202124";
  const textSecondary = isDark ? "#9aa0a6" : "#5f6368";
  const inputBg = isDark ? "#0f3460" : "white";
  const inputBorder = isDark ? "#3c4043" : "#ddd";
  const inputColor = isDark ? "#e8eaed" : "#202124";
  const linkColor = isDark ? "#8ab4f8" : "#1a73e8";
  const btnBg = isDark ? "#8ab4f8" : "#1a73e8";
  const btnColor = isDark ? "#202124" : "white";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: bg,
        transition: "background 0.3s",
        position: "relative",
      }}
    >
      {/* Dark mode toggle — top right */}
      <button
        onClick={toggleDark}
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: isDark ? "#2d2d44" : "#e8eaed",
          border: "none",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isDark ? "#f9ab00" : "#5f6368",
          transition: "background 0.3s, color 0.3s",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        }}
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div
        style={{
          background: cardBg,
          padding: "40px",
          borderRadius: "12px",
          boxShadow: isDark
            ? "0 4px 24px rgba(0,0,0,0.5)"
            : "0 4px 12px rgba(0,0,0,0.1)",
          width: "350px",
          textAlign: "center",
          transition: "background 0.3s, box-shadow 0.3s",
        }}
      >
        <img
          src="https://cdn.worldvectorlogo.com/logos/svg-2.svg"
          width="50"
          alt="logo"
        />
        <h2
          style={{
            color: textPrimary,
            margin: "12px 0 4px",
            transition: "color 0.3s",
          }}
        >
          {isRegistering ? "Create Account" : "Sign In"}
        </h2>
        <p
          style={{
            color: textSecondary,
            margin: "0 0 20px",
            fontSize: "14px",
            transition: "color 0.3s",
          }}
        >
          to continue to Google Docs Clone
        </p>

        <form
          onSubmit={handleAuth}
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}
        >
          <input
            type="email"
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "10px",
              border: `1px solid ${inputBorder}`,
              borderRadius: "6px",
              background: inputBg,
              color: inputColor,
              fontSize: "14px",
              outline: "none",
              transition: "background 0.3s, border-color 0.3s, color 0.3s",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "10px",
              border: `1px solid ${inputBorder}`,
              borderRadius: "6px",
              background: inputBg,
              color: inputColor,
              fontSize: "14px",
              outline: "none",
              transition: "background 0.3s, border-color 0.3s, color 0.3s",
            }}
          />
          {error && (
            <p style={{ color: "#f28b82", fontSize: "12px", margin: 0 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            style={{
              padding: "10px",
              background: btnBg,
              color: btnColor,
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
              transition: "background 0.3s",
            }}
          >
            {isRegistering ? "Register" : "Login"}
          </button>
        </form>

        <p
          style={{
            marginTop: "20px",
            fontSize: "14px",
            cursor: "pointer",
            color: linkColor,
            transition: "color 0.3s",
          }}
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering
            ? "Already have an account? Sign in"
            : "New user? Create an account"}
        </p>
      </div>
    </div>
  );
};

export default Login;
