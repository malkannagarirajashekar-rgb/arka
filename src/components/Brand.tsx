import { Link } from "react-router-dom";

export function Brand({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""} ${className}`.trim()} to="/" aria-label="Arka home">
      <span className="brand-mark" aria-hidden="true">
        <img src="/brand/arka-logo-transparent.png" alt="" draggable="false" />
      </span>
      <span className="brand-wordmark">
        <strong>Arka</strong>
        {!compact && <small>SECURITY SYSTEMS</small>}
      </span>
    </Link>
  );
}
