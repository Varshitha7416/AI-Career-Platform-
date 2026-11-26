const TABS = [
  { id: 'analyze', label: 'Analyze' },
  { id: 'progress', label: 'My progress' },
  { id: 'history', label: 'History' },
];

/** Accessible tab list; panels are rendered by the page with aria-labelledby={`sg-tab-${id}`}. */
function Tabs({ value, onChange }) {
  const onKey = (e) => {
    const i = TABS.findIndex((t) => t.id === value);
    if (e.key === 'ArrowRight') onChange(TABS[(i + 1) % TABS.length].id);
    if (e.key === 'ArrowLeft') onChange(TABS[(i + TABS.length - 1) % TABS.length].id);
  };
  return (
    <div role="tablist" aria-label="Skill gap sections" onKeyDown={onKey} className="inline-flex max-w-full overflow-x-auto rounded-full border border-sage/50 bg-white p-1">
      {TABS.map((t) => (
        <button
          key={t.id}
          id={`sg-tab-${t.id}`}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          aria-controls="sg-panel"
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          className={`focus-ring whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition ${value === t.id ? 'bg-primary text-white' : 'text-ink hover:bg-mint'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
