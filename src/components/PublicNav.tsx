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
        <a href="#solutions" onClick={() => setOpen(false)}>Solutions</a>
        <a href="#architecture" onClick={() => setOpen(false)}>Architecture</a>
        <a href="#platform" onClick={() => setOpen(false)}>Platform</a>
        <a href="#about" onClick={() => setOpen(false)}>About</a>
      </nav>
      <div className="nav-actions">
        <ThemeToggle />
        <Link className="text-link" to="/login">Sign in</Link>
        <Link className="button button-outline desktop-only" to="/login">Request Demo <span>→</span></Link>
        <button className="mobile-menu" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}
