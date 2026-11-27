// Decorative botanical SVGs for the Dashboard. Purely visual (aria-hidden).

export function HeroIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 440 300" className={className} aria-hidden="true" focusable="false">
      <circle cx="300" cy="150" r="124" fill="var(--color-sage)" opacity="0.28" />
      <circle cx="392" cy="52" r="26" fill="var(--color-sage)" opacity="0.45" />
      <circle cx="70" cy="70" r="14" fill="var(--color-sage)" opacity="0.4" />

      {/* left plant */}
      <path d="M92 292c-6-60 2-118 30-170" stroke="var(--color-accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M122 122c-34-6-58-30-60-62 34 4 58 28 60 62Z" fill="var(--color-accent)" />
      <path d="M112 168c32-8 54-32 54-64-32 6-52 30-54 64Z" fill="var(--color-sage)" />
      <path d="M100 214c-30-4-50-24-54-52 30 2 50 22 54 52Z" fill="var(--color-primary)" />
      <path d="M104 252c26-6 46-24 50-48-26 4-44 22-50 48Z" fill="var(--color-sage)" />

      {/* right plant */}
      <path d="M378 292c8-52 0-104-26-150" stroke="var(--color-accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M352 142c30-4 52-24 56-54-30 4-52 24-56 54Z" fill="var(--color-primary)" />
      <path d="M362 190c-30-6-50-28-52-58 30 6 50 28 52 58Z" fill="var(--color-sage)" />
      <path d="M372 238c28-4 46-22 50-46-28 2-46 20-50 46Z" fill="var(--color-accent)" />

      {/* desk + laptop */}
      <rect x="150" y="248" width="170" height="10" rx="5" fill="var(--color-primary)" />
      <rect x="186" y="182" width="100" height="66" rx="8" fill="var(--color-primary)" />
      <rect x="194" y="190" width="84" height="50" rx="5" fill="var(--color-accent)" />
      <path d="M236 202c-9 0-14 6-14 12 6 0 12-3 14-9 2 6 8 9 14 9 0-6-5-12-14-12Z" fill="var(--color-mint)" />

      {/* person */}
      <circle cx="236" cy="136" r="19" fill="#F3D9C4" />
      <path d="M216 132c2-16 14-22 26-20 12 2 17 12 14 24-8-10-20-12-40-4Z" fill="var(--color-forest)" />
      <path d="M206 182c4-22 18-30 32-30s26 8 30 30Z" fill="var(--color-sage)" />
    </svg>
  );
}

// Faint corner leaves used as card ornaments.
export function LeafCorner({ className = '', flip = false }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M118 118C62 112 18 74 10 10c58 6 102 44 108 108Z" fill="currentColor" opacity="0.5" />
      <path d="M118 118C84 92 52 60 10 10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.7" />
    </svg>
  );
}

// Forest-green card backdrop (Career Progress): overlapping leaves.
export function ForestLeaves({ className = '' }) {
  // Fixed colours (not theme tokens): the Career Progress card is the same dark surface in both themes.
  return (
    <svg viewBox="0 0 260 200" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMaxYMax slice">
      <path d="M260 200C180 196 112 150 100 70c80 6 150 50 160 130Z" fill="#235347" opacity="0.5" />
      <path d="M260 200C206 168 150 128 100 70" stroke="#8EB69B" strokeWidth="2" fill="none" opacity="0.3" />
      <path d="M200 200c-50-6-88-38-96-92 52 4 92 38 96 92Z" fill="#8EB69B" opacity="0.14" />
      <path d="M260 120c-34 0-60-18-72-46 34 0 62 18 72 46Z" fill="#8EB69B" opacity="0.2" />
    </svg>
  );
}

// Themed tile for program cards: theme = forest | sage | mint | moss.
// Fixed colours (not theme tokens) so the tiles stay legible in both light and dark mode.
const THEMES = {
  forest: { bg: 'bg-[#0B2B26]', text: 'text-[#DAF1DE]', leaf: 'text-[#8EB69B]' },
  sage: { bg: 'bg-[#8EB69B]', text: 'text-[#051F20]', leaf: 'text-[#0B2B26]' },
  mint: { bg: 'bg-[#DAF1DE]', text: 'text-[#163832]', leaf: 'text-[#235347]' },
  moss: { bg: 'bg-[#235347]', text: 'text-[#DAF1DE]', leaf: 'text-[#DAF1DE]' },
};

export function ProgramVisual({ theme = 'forest', children, className = '' }) {
  const t = THEMES[theme] || THEMES.forest;
  return (
    <div className={`relative overflow-hidden rounded-xl ${t.bg} ${t.text} ${className}`}>
      <LeafCorner className={`absolute -right-3 -bottom-3 w-24 h-24 ${t.leaf}`} />
      <LeafCorner className={`absolute -left-4 -top-4 w-14 h-14 rotate-180 ${t.leaf} opacity-70`} />
      <div className="relative">{children}</div>
    </div>
  );
}
