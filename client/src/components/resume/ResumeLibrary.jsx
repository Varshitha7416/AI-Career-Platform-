import { useState, useEffect, useRef, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { getErrorMessage } from '../../utils/errors';
import { ErrorMessage, SuccessMessage, Skeleton } from '../Feedback';
import { CheckIcon, CloseIcon } from '../Icons';

function CloudUploadIcon({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.9 8.2 4.8 4.8 0 0 1 17 18" />
      <path d="M12 20v-8m0 0-3 3m3-3 3 3" />
    </svg>
  );
}
import ModalShell from '../interviews/ModalShell';
import ResumePreviewModal from './ResumePreviewModal';
import { validateResumeFile, formatSize, formatDate } from './resumeUtils';

const DISPLAY_NAME = (r) => r.name || r.fileName;

/**
 * Shared resume library: list, upload (drag/drop + button), select, and (allowManage) rename / set default / delete.
 * Props: { selectedId, onSelect(resume|null), onResumesChange?(list), compact?, allowManage? }
 */
function ResumeLibrary({ selectedId, onSelect, onResumesChange, compact = false, allowManage = false }) {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null); // null = idle, 0-100 = uploading
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null); // resume pending delete confirmation
  const [previewing, setPreviewing] = useState(null); // resume whose extracted text is shown in the preview modal
  const closePreview = useCallback(() => setPreviewing(null), []);
  const inputRef = useRef(null);

  // Keep latest callbacks/selection in refs so the loader stays stable.
  const cbRef = useRef({ onSelect, onResumesChange, selectedId });
  useEffect(() => {
    cbRef.current = { onSelect, onResumesChange, selectedId };
  });

  const applyList = useCallback((list, preferId) => {
    setResumes(list);
    const { onSelect: sel, onResumesChange: change, selectedId: current } = cbRef.current;
    if (change) change(list);
    let stored = '';
    try { stored = localStorage.getItem('resumeId') || ''; } catch { /* storage unavailable */ }
    const pick =
      list.find((r) => r._id === preferId) ||
      list.find((r) => r._id === current) ||
      list.find((r) => r._id === stored) ||
      list.find((r) => r.isDefault) ||
      list[0] ||
      null;
    try {
      if (pick) localStorage.setItem('resumeId', pick._id);
      else localStorage.removeItem('resumeId');
    } catch { /* ignore */ }
    if ((pick?._id || '') !== (current || '') || !pick) sel(pick);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await axiosClient.get('/resumes');
      applyList(res.data.resumes || []);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your resumes.'));
    } finally {
      setLoading(false);
    }
  }, [applyList]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  // If the parent selects a different id (e.g. from a URL param), remember it.
  useEffect(() => {
    if (selectedId && resumes.some((r) => r._id === selectedId)) {
      try { localStorage.setItem('resumeId', selectedId); } catch { /* ignore */ }
    }
  }, [selectedId, resumes]);

  const upload = async (file) => {
    setError('');
    setSuccess('');
    const problem = validateResumeFile(file);
    if (problem) return setError(problem);
    const form = new FormData();
    form.append('resumeFile', file);
    setProgress(0);
    try {
      const res = await axiosClient.post('/resumes', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
        },
      });
      const created = res.data.resume;
      const listRes = await axiosClient.get('/resumes');
      applyList(listRes.data.resumes || [created], created._id);
      setSuccess('Resume uploaded and ready to use.');
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed. Please try again.'));
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (progress !== null) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) upload(f);
  };

  const choose = (resume) => {
    try { localStorage.setItem('resumeId', resume._id); } catch { /* ignore */ }
    onSelect(resume);
  };

  const startRename = (r) => {
    setRenamingId(r._id);
    setRenameValue(DISPLAY_NAME(r));
    setError('');
  };

  const saveRename = async (r) => {
    const name = renameValue.trim();
    if (!name) return setError('Please enter a name.');
    if (name === DISPLAY_NAME(r)) return setRenamingId(null);
    setBusyId(r._id);
    try {
      const res = await axiosClient.put(`/resumes/${r._id}`, { name });
      const list = resumes.map((x) => (x._id === r._id ? { ...x, ...res.data.resume } : x));
      setResumes(list);
      if (onResumesChange) onResumesChange(list);
      if (selectedId === r._id) onSelect({ ...r, ...res.data.resume });
      setRenamingId(null);
      setSuccess('Resume renamed.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not rename the resume.'));
    } finally {
      setBusyId(null);
    }
  };

  const makeDefault = async (r) => {
    setBusyId(r._id);
    setError('');
    setSuccess('');
    try {
      await axiosClient.put(`/resumes/${r._id}`, { isDefault: true });
      const listRes = await axiosClient.get('/resumes');
      applyList(listRes.data.resumes || [], selectedId);
      setSuccess(`"${DISPLAY_NAME(r)}" is now your default resume.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not set the default resume.'));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const r = deleting;
    setBusyId(r._id);
    setError('');
    setSuccess('');
    try {
      const res = await axiosClient.delete(`/resumes/${r._id}`);
      setDeleting(null);
      const listRes = await axiosClient.get('/resumes');
      applyList(listRes.data.resumes || [], selectedId === r._id ? undefined : selectedId);
      const kept = (res.data.analysesKept || 0) + (res.data.coverLettersKept || 0);
      setSuccess(kept ? 'Resume deleted. Your analysis and cover letter history was kept.' : 'Resume deleted.');
    } catch (err) {
      setDeleting(null);
      setError(getErrorMessage(err, 'Could not delete the resume.'));
    } finally {
      setBusyId(null);
    }
  };

  const uploading = progress !== null;

  return (
    <div className="flex flex-col gap-3">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed text-center transition ${compact ? 'p-4' : 'p-6'} ${dragging ? 'border-accent bg-mint' : 'border-sage/60 bg-white'}`}
      >
        <div className="mx-auto mb-2 w-12 h-12 text-primary flex items-center justify-center">
          <CloudUploadIcon size={compact ? 34 : 44} />
        </div>
        <p className="text-sm font-medium text-ink">{dragging ? 'Drop your resume here' : 'Drag & drop your resume here'}</p>
        <p className="text-xs text-ink/60 mt-1">or</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="sr-only"
          id="resume-file-input"
          disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
        />
        <label
          htmlFor="resume-file-input"
          className={`focus-within:outline-2 inline-block mt-2 px-8 py-2.5 rounded-full text-sm font-semibold bg-primary text-white hover:bg-primary-dark transition ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        >
          {uploading ? 'Uploading...' : 'Choose File'}
        </label>
        <p className="text-xs text-ink/60 mt-3">Supported formats: PDF, DOCX, TXT (Max 5MB)</p>
        {uploading && (
          <div className="mt-3" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Upload progress">
            <div className="h-2 rounded-full bg-sage/30 overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-ink/60 mt-1">{progress < 99 ? `${progress}% uploaded` : 'Reading your resume...'}</p>
          </div>
        )}
      </div>

      {error && <ErrorMessage message={error} />}
      {success && <SuccessMessage message={success} />}

      {/* Library */}
      {loading ? (
        <div className="flex flex-col gap-2" aria-label="Loading resumes">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : loadError ? (
        <ErrorMessage message={loadError} onRetry={load} />
      ) : resumes.length === 0 ? (
        <p className="text-sm text-ink/60 text-center py-2">No resumes yet. Upload one to get started.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Your resumes">
          {resumes.map((r) => {
            const selected = r._id === selectedId;
            const renaming = renamingId === r._id;
            const busy = busyId === r._id;
            return (
              <li
                key={r._id}
                className={`rounded-xl border bg-white p-3 ${selected ? 'border-accent ring-1 ring-accent' : 'border-sage/40'}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => choose(r)}
                    aria-pressed={selected}
                    aria-label={`Use ${DISPLAY_NAME(r)}`}
                    className={`focus-ring mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center ${selected ? 'bg-accent border-accent text-white' : 'border-sage'}`}
                  >
                    {selected && <CheckIcon size={12} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    {renaming ? (
                      <form
                        onSubmit={(e) => { e.preventDefault(); saveRename(r); }}
                        className="flex flex-wrap gap-2"
                      >
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          maxLength={120}
                          aria-label="Resume name"
                          className="border border-sage/60 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[140px]"
                        />
                        <button type="submit" disabled={busy} className="focus-ring text-sm px-3 py-1.5 rounded-lg bg-primary text-white disabled:opacity-50">Save</button>
                        <button type="button" onClick={() => setRenamingId(null)} className="focus-ring text-sm px-3 py-1.5 rounded-lg text-primary hover:bg-mint">Cancel</button>
                      </form>
                    ) : (
                      <button type="button" onClick={() => choose(r)} className="focus-ring text-left w-full rounded">
                        <span className="block font-medium text-ink text-sm truncate">{DISPLAY_NAME(r)}</span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink/60 mt-0.5">
                          <span className="uppercase">{r.fileType}</span>
                          {r.fileSize ? <span>{formatSize(r.fileSize)}</span> : null}
                          <span>Uploaded {formatDate(r.createdAt)}</span>
                          {r.isDefault && <span className="px-2 py-0.5 rounded-full bg-mint text-primary font-semibold">Default</span>}
                          {r.roleAssigned && <span className="px-2 py-0.5 rounded-full border border-sage text-primary font-semibold">Role: {r.targetRole}</span>}
                          {selected && <span className="px-2 py-0.5 rounded-full bg-accent text-white font-semibold">Selected</span>}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                {!renaming && (
                  <div className="flex flex-wrap gap-1 mt-2 pl-8 text-xs">
                    <button type="button" onClick={() => setPreviewing(r)} className="focus-ring px-2 py-1 rounded-md text-primary hover:bg-mint">Preview</button>
                    {allowManage && (
                      <>
                        <button type="button" onClick={() => startRename(r)} disabled={busy} className="focus-ring px-2 py-1 rounded-md text-primary hover:bg-mint disabled:opacity-50">Rename</button>
                        {!r.isDefault && (
                          <button type="button" onClick={() => makeDefault(r)} disabled={busy} className="focus-ring px-2 py-1 rounded-md text-primary hover:bg-mint disabled:opacity-50">Set as default</button>
                        )}
                        <button type="button" onClick={() => setDeleting(r)} disabled={busy} className="focus-ring px-2 py-1 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50">Delete</button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {previewing && <ResumePreviewModal resume={previewing} onClose={closePreview} />}

      {deleting && (
        <ModalShell title="Delete this resume?" onClose={() => setDeleting(null)} labelId="delete-resume-title">
          <p className="text-sm text-ink mt-3">
            <strong>{DISPLAY_NAME(deleting)}</strong> will be removed from your library.
          </p>
          <p className="text-sm text-ink/70 mt-2">
            Your past analyses and cover letters that used it are kept. They will show the resume as deleted, and you will not be able to run new analyses with it.
          </p>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={() => setDeleting(null)} className="focus-ring px-4 py-2 rounded-lg text-sm text-primary hover:bg-mint inline-flex items-center gap-1">
              <CloseIcon size={14} /> Keep it
            </button>
            <button type="button" onClick={confirmDelete} disabled={busyId === deleting._id} className="focus-ring px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
              {busyId === deleting._id ? 'Deleting...' : 'Delete resume'}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

export default ResumeLibrary;
