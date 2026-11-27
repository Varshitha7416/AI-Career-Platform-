import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import { Skeleton } from '../Feedback';
import ModalShell from '../interviews/ModalShell';

// Shows the extracted text of a resume (GET /resumes/:id/preview, capped at 4,000 characters by the server).
// This is plain extracted text, not the original file, which CareerNest never stores.
const PREVIEW_LIMIT = 4000;

function ResumePreviewModal({ resume, onClose }) {
  const [state, setState] = useState({ status: 'loading', text: '', textLength: 0, error: '' });
  const title = resume.name || resume.fileName;

  const load = useCallback(async () => {
    setState({ status: 'loading', text: '', textLength: 0, error: '' });
    try {
      const res = await axiosClient.get(`/resumes/${resume._id}/preview`);
      setState({
        status: 'done',
        text: res.data.textPreview || '',
        textLength: res.data.resume?.textLength ?? 0,
        error: '',
      });
    } catch (err) {
      setState({ status: 'error', text: '', textLength: 0, error: getErrorMessage(err, 'Could not load the preview.') });
    }
  }, [resume._id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on open
    load();
  }, [load]);

  const { status, text, textLength, error } = state;
  const trimmed = text.trim();
  const truncated = textLength > PREVIEW_LIMIT || text.length >= PREVIEW_LIMIT;

  return (
    <ModalShell title={`Preview: ${title}`} onClose={onClose} labelId="resume-preview-title" wide>
      <p className="text-xs text-ink/60 mt-2">
        This is the text CareerNest extracted from your file, which is what the AI reads. The original file and its layout are not stored.
      </p>

      {status === 'loading' && (
        <div className="mt-4 flex flex-col gap-2" role="status" aria-label="Loading preview">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}{' '}
          <button type="button" onClick={load} className="underline focus-ring rounded">Retry</button>
        </div>
      )}

      {status === 'done' && !trimmed && (
        <p className="mt-4 text-sm text-ink/70 rounded-lg bg-mint/60 px-3 py-3">
          No readable text was stored for this resume. Try uploading it again, or use a text-based PDF, DOCX or TXT file.
        </p>
      )}

      {status === 'done' && trimmed && (
        <>
          <pre
            tabIndex={0}
            aria-label="Extracted resume text"
            className="mt-4 max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-sage/40 bg-bg/40 p-4 text-sm leading-relaxed text-ink font-sans focus-ring"
          >
            {text}
          </pre>
          {truncated && (
            <p className="text-xs text-ink/60 mt-2">
              Showing the first {PREVIEW_LIMIT.toLocaleString()} characters{textLength ? ` of ${textLength.toLocaleString()}` : ''}. The full text is still used for analysis and cover letters.
            </p>
          )}
        </>
      )}

      <div className="flex justify-end mt-5">
        <button type="button" onClick={onClose} className="focus-ring min-h-10 px-4 py-2 rounded-xl text-sm bg-primary text-white hover:bg-primary-dark">Close</button>
      </div>
    </ModalShell>
  );
}

export default ResumePreviewModal;
