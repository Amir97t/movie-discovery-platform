/**
 * Temporary abstract mark (film frame + lens). The FRAME name is a working
 * title only; the final brand and mark are undecided.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="3" y="3" width="26" height="26" rx="7" stroke="currentColor" strokeWidth="3" />
      <circle cx="16" cy="16" r="5.5" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}
