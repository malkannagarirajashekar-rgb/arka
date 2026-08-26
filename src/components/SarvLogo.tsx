type SarvLogoProps = {
  className?: string;
  decorative?: boolean;
  tone?: "light" | "gold";
};

export function SarvLogo({
  className = "",
  decorative = false,
  tone = "light",
}: SarvLogoProps) {
  return (
    <img
      className={`${className} sarv-logo sarv-logo-${tone}`}
      src={tone === "gold" ? "/brand/sarv-logo-gold.svg" : "/brand/sarv-logo.svg"}
      alt={decorative ? "" : "Sarv"}
      aria-hidden={decorative ? true : undefined}
      draggable="false"
    />
  );
}
