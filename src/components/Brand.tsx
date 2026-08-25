import { Link } from "react-router-dom";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} to="/">
      <span className="brand-mark">◈</span>
      <span>
        <strong>TRINETRA</strong>
        {!compact && <small>CYBER DEFENSE</small>}
      </span>
    </Link>
  );
}
