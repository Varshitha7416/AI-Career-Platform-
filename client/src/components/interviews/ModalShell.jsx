import { useEffect, useRef } from 'react';
import { CloseIcon } from '../Icons';

// Accessible modal: backdrop click / Escape close it, focus moves into the dialog.
function ModalShell({ title, onClose, children, labelId = 'modal-title', wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/50"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-xl' : 'max-w-md'} max-h-[92vh] overflow-y-auto p-6 relative`}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="focus-ring absolute top-3 right-3 p-1.5 rounded-lg text-ink/60 hover:bg-mint">
          <CloseIcon size={18} />
        </button>
        <h2 id={labelId} className="font-display text-xl font-bold text-primary pr-8">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default ModalShell;
