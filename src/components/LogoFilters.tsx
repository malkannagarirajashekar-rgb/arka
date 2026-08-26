export function LogoFilters() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute", pointerEvents: "none" }}
    >
      <defs>
        <filter id="sarv-logo-transparent" colorInterpolationFilters="sRGB">
          {/* Input is black geometry on white. Make luminance drive alpha:
              black => opaque, white => transparent. */}
          <feColorMatrix
            type="matrix"
            values="
              0 0 0 0 1
              0 0 0 0 1
              0 0 0 0 1
              -1 -1 -1 0 3
            "
          />
        </filter>
      </defs>
    </svg>
  );
}
