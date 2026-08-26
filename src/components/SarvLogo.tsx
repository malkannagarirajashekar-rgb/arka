type SarvLogoProps = { className?: string; decorative?: boolean };

export function SarvLogo({ className = "", decorative = false }: SarvLogoProps) {
  return (
    <img
      className={className}
      src="/brand/sarv-logo.svg"
      alt={decorative ? "" : "Sarv"}
      aria-hidden={decorative ? true : undefined}
      draggable="false"
    />
  );
}
