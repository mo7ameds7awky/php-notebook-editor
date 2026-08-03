import { APP_NAME } from "../../theme/appIdentity";
import { cellAccents, colors } from "../../theme/tokens";

/**
 * Placeholder logo mark: a rounded square holding three stacked cell bars in
 * the markdown, PHP, and HTTP accents, plus a play triangle.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={`${APP_NAME} logo`}
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="7"
        fill={colors.codeSurface}
        stroke={colors.border}
        strokeWidth="1.5"
      />
      {/* three stacked cells */}
      <rect x="7" y="8" width="13" height="4" rx="2" fill={cellAccents.markdown} />
      <rect x="7" y="14" width="13" height="4" rx="2" fill={cellAccents.php} />
      <rect x="7" y="20" width="13" height="4" rx="2" fill={cellAccents.http} />
      {/* play triangle */}
      <path d="M23 12.5 L28 16 L23 19.5 Z" fill={colors.primary} />
    </svg>
  );
}
