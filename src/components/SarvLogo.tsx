type SarvLogoProps = {
  className?: string;
  decorative?: boolean;
  tone?: "light" | "gold";
};

export function SarvLogo({ className = "", decorative = false }: SarvLogoProps) {
  return (
    <img
      className={`${className} arka-logo`}
      src="/brand/arka-logo.png"
      alt={decorative ? "" : "Arka"}
      aria-hidden={decorative ? true : undefined}
      draggable="false"
    />
  );
}
