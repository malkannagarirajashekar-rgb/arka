import { Link } from "react-router-dom";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} to="/" aria-label="Trinetra home">
      <img
        className="brand-mark"
        src="/brand/trinetra-logo.png"
        alt="Trinetra"
        draggable="false"
      />
      <span className="brand-wordmark">
        <strong>TRINETRA</strong>
        {!compact && <small>CYBER DEFENSE</small>}
      </span>
    </Link>
  );
}
