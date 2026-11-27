// Decorative hero illustration (leaves, floating cards). Purely visual, hidden from assistive tech.
function HeroArt() {
  return (
    <div className="relative w-full h-full min-h-[240px]" aria-hidden="true">
      <svg viewBox="0 0 460 300" className="absolute inset-0 w-full h-full">
        <circle cx="330" cy="150" r="118" fill="#C6E5CF" opacity="0.55" />
        <circle cx="408" cy="48" r="26" fill="#B7DCC3" opacity="0.7" />
        {/* big leaves */}
        <g>
          <path d="M96 288C60 232 66 168 120 120c40 44 38 110-24 168Z" fill="#235347" />
          <path d="M96 288c-6-52 4-100 24-168" stroke="#DAF1DE" strokeWidth="2" fill="none" opacity="0.6" />
          <path d="M150 292c-30-40-26-92 12-136 34 34 30 92-12 136Z" fill="#8EB69B" />
          <path d="M360 292c26-44 16-98-26-136-36 40-26 96 26 136Z" fill="#8EB69B" />
          <path d="M412 292c20-38 12-84-22-118-30 34-22 82 22 118Z" fill="#235347" />
        </g>
        {/* desk + laptop */}
        <rect x="170" y="238" width="170" height="10" rx="5" fill="#163832" />
        <rect x="206" y="176" width="100" height="62" rx="8" fill="#163832" />
        <rect x="214" y="184" width="84" height="46" rx="5" fill="#235347" />
        <path d="M256 198c-9 0-14 6-14 12 6 0 12-3 14-9 2 6 8 9 14 9 0-6-5-12-14-12Z" fill="#DAF1DE" />
        {/* person */}
        <circle cx="236" cy="132" r="19" fill="#F3D9C4" />
        <path d="M216 128c2-16 14-22 26-20 12 2 17 12 14 24-8-10-20-12-40-4Z" fill="#0B2B26" />
        <path d="M206 176c4-22 18-30 32-30s26 8 30 30Z" fill="#8EB69B" />
      </svg>

      <div className="absolute left-0 top-2 bg-white rounded-xl shadow-md px-3 py-2 flex items-center gap-2.5 border border-sage/30">
        <span className="w-8 h-8 rounded-lg bg-mint text-primary flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></svg>
        </span>
        <span className="text-xs font-semibold text-ink leading-tight">Great Jobs<br />Better Future</span>
      </div>

      <div className="absolute right-0 top-10 bg-white rounded-xl shadow-md px-3 py-2.5 border border-sage/30 text-xs text-ink">
        {['Your Skills', 'Your Goals', 'Your Match'].map((t) => (
          <div key={t} className="flex items-center gap-2 py-0.5">
            <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
            </span>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

export default HeroArt;
