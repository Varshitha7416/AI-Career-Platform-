import { useEffect, useRef } from 'react';

// Minimal accessible modal: Esc closes, focus moves to the first action.
export default function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onCancel, extraAction }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-ink/50" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="bg-white text-ink rounded-2xl border border-sage/40 shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-display text-xl text-primary">{title}</h2>
        <div className="mt-3 text-sm text-ink/80 space-y-2">{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="focus-ring px-4 py-2 rounded-lg border border-sage/50 text-sm text-ink hover:bg-mint">
            {cancelLabel}
          </button>
          {extraAction}
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`focus-ring px-4 py-2 rounded-lg text-sm text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700 dark:text-[#2A1013]' : 'bg-primary hover:bg-primary-dark'}`}
          >
            {busy ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
