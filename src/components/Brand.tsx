import { Link } from "react-router-dom";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} to="/" aria-label="Sarv home">
      <span className="brand-mark" aria-hidden="true" />
      <span className="brand-wordmark">
        <strong>Sarv</strong>
        {!compact && <small>CYBER DEFENSE</small>}
      </span>
    </Link>
  );
}
