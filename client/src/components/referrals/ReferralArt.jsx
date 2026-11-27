// Decorative handshake illustration (inline SVG, theme-aware via the colour tokens).
function ReferralArt({ className = '' }) {
  return (
    <svg viewBox="0 0 320 180" className={className} fill="none" aria-hidden="true">
      <path d="M0 150C40 120 80 135 130 110S230 60 320 90V180H0Z" className="fill-sage/40" />
      <path d="M20 170C60 140 120 150 180 130S280 110 320 125V180H20Z" className="fill-sage/30" />
      <g className="stroke-primary" strokeWidth="3" strokeLinecap="round">
        <path d="M150 28l-6 14M170 22v16M190 28l8 13" />
      </g>
      <g transform="rotate(-12 160 105)">
        <rect x="40" y="78" width="46" height="56" rx="6" className="fill-primary" />
        <rect x="234" y="78" width="46" height="56" rx="6" className="fill-primary" />
        <path d="M86 90h40l22-8 34 10 20-6 32 8v36l-30 8-26-4-20 14-24-10-18 8-30-14Z" className="fill-mint stroke-primary" strokeWidth="3" strokeLinejoin="round" />
        <path d="M120 112l22 8M142 106l24 12M164 112l20 14" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      </g>
      <path d="M60 60c10-14 26-14 34-6-8 12-24 14-34 6Z" className="fill-accent/60" />
      <path d="M268 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" className="fill-accent" />
    </svg>
  );
}

export default ReferralArt;
