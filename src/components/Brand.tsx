import { Link } from "react-router-dom";
import { SarvLogo } from "./SarvLogo";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brand ${compact ? "brand-compact" : ""}`} to="/" aria-label="Sarv home">
      <SarvLogo className="brand-mark" decorative />
      <span className="brand-wordmark">
        <strong>Sarv</strong>
        {!compact && <small>CYBER DEFENSE</small>}
      </span>
    </Link>
  );
}
