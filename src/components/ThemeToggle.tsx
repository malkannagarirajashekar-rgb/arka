import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("arka-theme");
    return stored ? stored === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.localStorage.setItem("arka-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => setDark((value) => !value)}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
