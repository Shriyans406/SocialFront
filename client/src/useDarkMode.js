import { useState, useEffect } from "react";

const useDarkMode = () => {
  const [isDark, setIsDark] = useState(() => {
    // Default: light mode. Only go dark if user explicitly chose it before.
    const saved = localStorage.getItem("socialfront-dark-mode");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("socialfront-dark-mode", isDark);
    // Apply a class to <html> so SCSS can also pick it up
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);

  return [isDark, toggle];
};

export default useDarkMode;
