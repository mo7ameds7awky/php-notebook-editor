import { APP_NAME } from "../../theme/appIdentity";
import markUrl from "../../assets/brand/logo-mark.svg";
import markSmallUrl from "../../assets/brand/logo-mark-small.svg";
import horizontalUrl from "../../assets/brand/logo-horizontal.svg";
import horizontalTaglineUrl from "../../assets/brand/logo-horizontal-with-tagline.svg";
import monochromeUrl from "../../assets/brand/logo-monochrome.svg";

export type LogoVariant =
  | "mark"
  | "markSmall"
  | "horizontal"
  | "horizontalTagline"
  | "monochrome";

const SOURCES: Record<LogoVariant, string> = {
  mark: markUrl,
  markSmall: markSmallUrl,
  horizontal: horizontalUrl,
  horizontalTagline: horizontalTaglineUrl,
  monochrome: monochromeUrl,
};

/** The single component for rendering the brand logo anywhere in the app. */
export function LogoMark({
  size = 28,
  variant = "mark",
  className = "",
}: {
  size?: number;
  variant?: LogoVariant;
  className?: string;
}) {
  return (
    <img
      src={SOURCES[variant]}
      style={{ height: size, width: "auto" }}
      className={`shrink-0 ${className}`}
      alt={`${APP_NAME} logo`}
      draggable={false}
    />
  );
}
