import { useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { blobErrorMessage, filenameFromHeaders, saveBlob } from '../coverletter/letterUtils';

/** Downloads the PDF report of one saved analysis (GET /resume-analysis/:id/export?format=pdf). */
function ExportPdfButton({ id, className = '', label = 'Download PDF report' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await axiosClient.get(`/resume-analysis/${id}/export`, { params: { format: 'pdf' }, responseType: 'blob' });
      saveBlob(res.data, filenameFromHeaders(res.headers, 'Resume-Analysis.pdf'));
    } catch (err) {
      const msg = await blobErrorMessage(err);
      setError(msg.replace('the letter', 'the report'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className={`focus-ring inline-flex items-center gap-1.5 rounded-lg border border-sage/60 text-primary hover:bg-mint disabled:opacity-50 ${className || 'px-4 py-2 text-sm font-medium'}`}
      >
        {busy ? 'Preparing PDF...' : label}
      </button>
      {error && <span role="alert" className="text-xs text-red-600 mt-1">{error}</span>}
    </span>
  );
}

export default ExportPdfButton;
