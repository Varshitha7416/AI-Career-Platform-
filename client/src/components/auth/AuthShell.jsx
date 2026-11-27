import AuthIllustration from './AuthIllustration';

function BrandMark({ size = 40 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl bg-sidebar shadow-sm ring-1 ring-leaf-muted/30"
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.64} height={size * 0.64} viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 29V16" stroke="#DAF1DE" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 17C16 10 11 5 4 5c0 7 4 12 12 12Z" fill="#8EB69B" />
        <path d="M16 15c0-6.5 4.5-11 11-11 0 6.5-4 11-11 11Z" fill="#DAF1DE" />
      </svg>
    </span>
  );
}

function PageLeaf({ className = '', flip = false }) {
  return (
    <svg viewBox="0 0 120 200" className={className} aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M60 196C60 150 58 100 70 20" stroke="#8EB69B" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M66 70C30 62 14 34 18 6c34 6 52 30 48 64Z" fill="#8EB69B" />
      <path d="M68 128C104 118 118 92 112 64c-34 8-50 34-44 64Z" fill="#8EB69B" />
      <path d="M62 176C34 170 20 150 22 126c28 4 42 24 40 50Z" fill="#8EB69B" />
    </svg>
  );
}

// Shared two-column card: form on the left, illustration on the right (hidden on phones, shortened on tablets).
export default function AuthShell({ children, title = 'Your career journey, all in one nest.', subtitle = "Discover opportunities, strengthen your profile, and prepare for what's next with AI." }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg bg-gradient-to-br from-mint/80 via-bg to-sage/30 px-3 py-6 sm:px-6 sm:py-10 lg:flex lg:items-center lg:justify-center lg:px-10">
      <PageLeaf className="pointer-events-none absolute -left-8 top-1/3 hidden h-56 opacity-25 xl:block" />
      <PageLeaf flip className="pointer-events-none absolute -right-8 top-[55%] hidden h-56 opacity-25 xl:block" />

      <main className="relative mx-auto grid w-full max-w-[1180px] overflow-hidden rounded-[28px] bg-white shadow-xl ring-1 ring-sage/30 lg:grid-cols-2">
        <section className="flex flex-col justify-center px-5 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
          <div className="mx-auto w-full max-w-[440px] lg:mx-0">
            <div className="flex items-center gap-3">
              <BrandMark />
              <span className="font-display text-[26px] font-semibold leading-none text-primary">CareerNest</span>
            </div>
            <h1 className="mt-6 font-display text-[26px] font-semibold leading-tight text-balance text-primary sm:text-[30px]">
              {title}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
              {subtitle}
            </p>
            <div className="mt-6">{children}</div>
          </div>
        </section>

        <aside className="hidden items-center justify-center bg-mint/60 px-4 py-6 md:flex lg:px-6">
          <AuthIllustration className="h-[360px] w-full lg:h-auto lg:max-h-[640px]" />
        </aside>
      </main>
    </div>
  );
}
