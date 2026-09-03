type ArkaLogoProps = {
  className?: string;
  decorative?: boolean;
  tone?: "light" | "gold";
};

export function SarvLogo({ className = "", decorative = false }: ArkaLogoProps) {
  return (
    <img
      className={`${className} arka-logo`}
      src="/brand/arka-logo-transparent.png"
      alt={decorative ? "" : "Arka"}
      aria-hidden={decorative ? true : undefined}
      draggable="false"
    />
  );
}
