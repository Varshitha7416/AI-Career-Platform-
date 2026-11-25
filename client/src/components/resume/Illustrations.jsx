// Decorative botanical illustrations for the Resume Analyzer intro panel (aria-hidden, theme tokens only).

export function UploadArt({ className = '' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="30" fill="var(--color-mint)" />
      <path d="M20 46c0-10 4-18 12-24" stroke="var(--color-accent)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M32 22c-8 0-13-4-14-10 7 0 13 4 14 10Z" fill="var(--color-sage)" />
      <path d="M32 28c7 0 12-4 13-9-7 0-12 4-13 9Z" fill="var(--color-accent)" />
      <rect x="30" y="34" width="20" height="16" rx="3" fill="var(--color-primary)" />
      <path d="M40 46v-8m0 0-3 3m3-3 3 3" stroke="var(--color-mint)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AnalysisArt({ className = '' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="30" fill="var(--color-mint)" />
      <rect x="18" y="14" width="28" height="36" rx="4" fill="var(--color-primary)" />
      <path d="M24 24h16M24 30h16M24 36h9" stroke="var(--color-mint)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="44" cy="44" r="8" fill="var(--color-sage)" />
      <path d="m40.5 44 2.5 2.5 4.5-5" stroke="var(--color-forest)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function GrowthArt({ className = '' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="30" fill="var(--color-mint)" />
      <path d="M32 54V26" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M32 36c-9 0-14-5-15-12 8 0 14 5 15 12Z" fill="var(--color-sage)" />
      <path d="M32 30c8 0 13-5 14-11-8 0-13 5-14 11Z" fill="var(--color-accent)" />
      <path d="M32 24c-5-2-6-7-5-11 5 1 7 6 5 11Z" fill="var(--color-primary)" />
      <path d="M22 54h20" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IntroBanner({ className = '' }) {
  return (
    <svg viewBox="0 0 300 150" className={className} aria-hidden="true" focusable="false">
      <circle cx="210" cy="80" r="64" fill="var(--color-sage)" opacity="0.3" />
      <path d="M40 150c-4-34 2-66 22-96" stroke="var(--color-accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M62 54c-22-4-36-18-38-38 22 2 36 16 38 38Z" fill="var(--color-accent)" />
      <path d="M54 92c20-4 34-18 34-38-20 4-32 18-34 38Z" fill="var(--color-sage)" />
      <path d="M48 124c-18-2-30-14-32-30 18 2 30 12 32 30Z" fill="var(--color-primary)" />
      <rect x="150" y="34" width="86" height="104" rx="8" fill="var(--color-primary)" />
      <rect x="158" y="42" width="70" height="88" rx="5" fill="var(--color-mint)" />
      <circle cx="193" cy="66" r="10" fill="var(--color-sage)" />
      <path d="M170 98h46M170 108h46M170 118h28" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
      <path d="M262 150c4-30-2-58-18-80" stroke="var(--color-accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M244 70c18-2 30-14 32-30-18 2-30 12-32 30Z" fill="var(--color-sage)" />
      <path d="M252 106c-16-4-26-16-26-30 16 4 26 14 26 30Z" fill="var(--color-accent)" />
    </svg>
  );
}

// Sprig + soft circle for the dark intro panel (fixed colours: the panel is dark green in both themes).
export function PanelSprig({ className = '' }) {
  return (
    <svg viewBox="0 0 260 150" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMinYMax meet">
      <circle cx="190" cy="190" r="120" fill="#235347" opacity="0.55" />
      <path d="M50 150c-2-28 4-52 18-72" stroke="#8EB69B" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M68 78c-16-3-26-14-28-28 16 2 27 12 28 28Z" fill="#8EB69B" />
      <path d="M62 104c15-3 25-14 26-28-15 3-25 13-26 28Z" fill="#DAF1DE" />
      <path d="M56 128c-13-2-22-11-24-23 13 2 22 10 24 23Z" fill="#8EB69B" opacity="0.8" />
      <path d="M58 118c12-3 20-11 22-21-12 2-20 9-22 21Z" fill="#235347" />
    </svg>
  );
}

// Empty-state art for the results card: a document with a score ring and leaves.
export function ReadyArt({ className = '' }) {
  return (
    <svg viewBox="0 0 260 150" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="130" cy="138" rx="110" ry="5" fill="var(--color-sage)" opacity="0.35" />
      <path d="M40 138c-3-26 2-50 16-68M52 138c4-18 12-30 26-38" stroke="var(--color-sage)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M56 70c-14-2-22-12-24-24 14 2 23 10 24 24Z" fill="var(--color-sage)" />
      <path d="M78 100c12-4 20-12 22-24-12 4-20 12-22 24Z" fill="var(--color-accent)" opacity="0.7" />
      <rect x="88" y="20" width="76" height="106" rx="8" fill="var(--color-mint)" stroke="var(--color-primary)" strokeWidth="3" />
      <circle cx="108" cy="42" r="8" fill="var(--color-sage)" />
      <path d="M122 38h28M122 46h20M98 66h56M98 76h56M98 86h40" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="176" cy="96" r="28" fill="var(--color-bg)" />
      <circle cx="176" cy="96" r="22" fill="none" stroke="var(--color-sage)" strokeOpacity="0.35" strokeWidth="6" />
      <circle cx="176" cy="96" r="22" fill="none" stroke="var(--color-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray="138" strokeDashoffset="21" transform="rotate(-90 176 96)" />
      <path d="M170 92l5 5 9-10" stroke="var(--color-primary)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M214 138c4-22 0-40-10-54" stroke="var(--color-sage)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M204 84c12-1 20-8 22-18-12 1-20 8-22 18Z" fill="var(--color-sage)" />
    </svg>
  );
}
