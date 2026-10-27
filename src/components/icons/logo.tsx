/**
 * FlowJob brand mark: a monogram "F" drawn as one continuous flow line,
 * ending in a node. Source files live in public/brand/ (SVG + PNG).
 */

interface LogoProps {
  className?: string;
}

/** Full lockup — rounded-square background + monogram. Used for the
 *  sidebar brand mark and mirrors src/app/icon.svg. */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="14" fill="#7c3aed" />
      <path
        d="M22 48V20h20M22 33h14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="20" r="4.5" fill="#c4b5fd" />
    </svg>
  );
}

/** Monogram only, no background — for spots that already provide their
 *  own badge/circle (e.g. the login card) and just need the glyph in
 *  `currentColor`. */
export function LogoMark({ className }: LogoProps) {
  return (
    <svg
      viewBox="12 10 44 44"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22 48V20h20M22 33h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="20" r="4.5" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
