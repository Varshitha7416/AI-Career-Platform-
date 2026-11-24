import { useState } from 'react';

// Brand-neutral tiles in the CareerNest palette. Real third-party logos are not bundled (licensing, offline use),
// so every company gets a deterministic initials tile; a company logoUrl is used when present and valid.
const TILES = [
  ['#DAF1DE', '#163832'],
  ['#C6E5CF', '#0B2B26'],
  ['#B7DCC3', '#0B2B26'],
  ['#8EB69B', '#051F20'],
  ['#235347', '#DAF1DE'],
  ['#163832', '#DAF1DE'],
];

const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const initials = (name = '') => {
  const parts = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

function CompanyLogo({ company, size = 40, className = '' }) {
  const [broken, setBroken] = useState(false);
  const name = company?.name || 'Company';
  const [bg, fg] = TILES[hash(name) % TILES.length];
  const style = { width: size, height: size, backgroundColor: bg, color: fg, fontSize: Math.round(size * 0.38) };

  if (company?.logoUrl && !broken) {
    return (
      <img
        src={company.logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        className={`rounded-xl object-contain bg-white ${className}`}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${name} logo`}
      className={`shrink-0 rounded-xl flex items-center justify-center font-bold tracking-tight select-none ${className}`}
      style={style}
    >
      {initials(name)}
    </div>
  );
}

export default CompanyLogo;
