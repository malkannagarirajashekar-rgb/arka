import { Link } from "react-router-dom";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} to="/" aria-label="Sarv home">
      <img
        className="brand-mark"
        src="/brand/sarv-logo.png"
        alt="Sarv"
        draggable="false"
      />
      <span className="brand-wordmark">
        <strong>SARV</strong>
        {!compact && <small>CYBER DEFENSE</small>}
      </span>
    </Link>
  );
}
