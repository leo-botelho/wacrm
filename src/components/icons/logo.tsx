/**
 * Brand mark: a lightning bolt (the "Zap" in MetaZap), reusing the same
 * glyph as the Macros button (lucide's Zap icon) so the logo and the
 * in-app iconography read as one family.
 */

interface LogoProps {
  className?: string;
}

/** Full lockup — rounded-square background + bolt. Used for the sidebar
 *  brand mark and as the source for the favicon. */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="7" fill="#7c3aed" />
      <path
        d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"
        transform="translate(7 7) scale(0.75)"
        fill="#ffffff"
      />
    </svg>
  );
}

/** Bolt only, no background — for spots that already provide their own
 *  badge/circle (e.g. the login card) and just need the glyph in
 *  `currentColor`. */
export function LogoMark({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
