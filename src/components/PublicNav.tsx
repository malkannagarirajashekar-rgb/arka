import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";

export function PublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="public-nav">
      <Brand />
      <nav className={open ? "mobile-open" : ""}>
        <a href="#method" onClick={() => setOpen(false)}>Method</a>
        <a href="#blueprint" onClick={() => setOpen(false)}>Blueprint</a>
        <a href="#surfaces" onClick={() => setOpen(false)}>Surfaces</a>
        <a href="#trace" onClick={() => setOpen(false)}>Trace</a>
      </nav>
      <div className="nav-actions">
        <ThemeToggle />
        <Link className="text-link" to="/login">Sign in</Link>
        <Link className="button button-outline desktop-only" to="/login">Enter Arka <span>→</span></Link>
        <button className="mobile-menu" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}
