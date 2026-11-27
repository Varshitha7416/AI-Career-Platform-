import { ChevronLeft, ChevronRight } from './Icons';

// Numbered pagination with ellipses: 1 ... 4 5 [6] 7 8 ... 20
function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, 2, pages - 1, pages, page - 1, page, page + 1]);
  const list = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  list.forEach((n, i) => {
    if (i && n - list[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  const btn = 'focus-ring min-w-9 h-9 px-2 rounded-lg text-sm transition flex items-center justify-center';
  return (
    <nav className="flex items-center justify-center gap-1.5 mt-8" aria-label="Pagination">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label="Previous page" className={`${btn} border border-sage/50 bg-white text-primary disabled:opacity-40`}>
        <ChevronLeft size={16} />
      </button>
      {pageList(page, pages).map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="px-1 text-ink/50">…</span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`${btn} ${n === page ? 'bg-primary text-white font-semibold' : 'bg-white border border-sage/50 text-primary hover:bg-mint'}`}
          >
            {n}
          </button>
        )
      )}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} aria-label="Next page" className={`${btn} border border-sage/50 bg-white text-primary disabled:opacity-40`}>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export default Pagination;
