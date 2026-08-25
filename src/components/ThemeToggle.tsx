import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem("trinetra-theme");
    return stored ? stored === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("trinetra-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button className="icon-button" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
