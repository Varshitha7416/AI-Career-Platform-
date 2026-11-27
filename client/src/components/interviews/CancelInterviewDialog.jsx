import ModalShell from './ModalShell';
import { formatDateTime, DANGER_FILLED_STYLE } from '../../utils/dashboard';

// Asks before cancelling an interview. A cancelled interview can be restored with "Reschedule".
function CancelInterviewDialog({ interview, busy, onConfirm, onClose }) {
  return (
    <ModalShell title="Cancel this interview?" onClose={onClose} labelId="cancel-interview-title">
      <p className="text-sm text-ink/80 mt-3">
        <strong>{interview.job?.title}</strong>{interview.company?.name ? ` at ${interview.company.name}` : ''}
        <br />
        {formatDateTime(interview.scheduledAt)}
      </p>
      <p className="text-sm text-ink/65 mt-3">
        It will move to your Past interviews as cancelled. You can restore it later with Reschedule.
      </p>
      <div className="flex flex-wrap gap-3 mt-5">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          style={DANGER_FILLED_STYLE}
          className="focus-ring rounded-xl px-5 py-2.5 text-sm font-medium hover:brightness-90 transition disabled:opacity-50"
        >
          {busy ? 'Cancelling…' : 'Yes, cancel interview'}
        </button>
        <button type="button" onClick={onClose} className="focus-ring border border-sage text-primary rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-mint transition">
          Keep interview
        </button>
      </div>
    </ModalShell>
  );
}

export default CancelInterviewDialog;
