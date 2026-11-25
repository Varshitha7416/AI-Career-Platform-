import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { FileTextIcon, CloseIcon } from '../Icons';
import { Skeleton } from '../Feedback';
import ModalShell from '../interviews/ModalShell';
import { validateResumeFile, formatSize, formatDate } from '../resume/resumeUtils';
import { SectionCard } from './ui';
import { btnGhost, parseApiError } from './formKit';

const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const nameOf = (r) => r.name || r.fileName;

function ResumeMeta({ r }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink/60">
      <span className="uppercase">{r.fileType}</span>
      {r.fileSize ? <span>{formatSize(r.fileSize)}</span> : null}
      <span>Uploaded {formatDate(r.createdAt)}</span>
    </span>
  );
}

function ResumesSection({ user, version, onChanged }) {
  const interests = user.careerInterests || [];
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState(null);
  const fileRef = useRef(null);
  const pendingRole = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await axiosClient.get('/resumes');
      setResumes(res.data.resumes || []);
      setLoadError('');
    } catch (err) {
      setLoadError(parseApiError(err, 'Could not load your resumes.').message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and when roles change
    load();
  }, [load, version]);

  const after = async (text) => {
    await load();
    if (onChanged) onChanged();
    if (text) setNotice(text);
  };

  const fail = (err, fallback) => { setError(parseApiError(err, fallback).message); setNotice(''); };

  const chooseFile = (role) => {
    pendingRole.current = role;
    setError('');
    setNotice('');
    fileRef.current?.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = validateResumeFile(file);
    if (problem) return setError(problem);
    const role = pendingRole.current;
    const form = new FormData();
    form.append('resumeFile', file);
    if (role) form.append('targetRole', role);
    setBusy(`upload:${role || ''}`);
    try {
      const res = await axiosClient.post('/resumes', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const rep = res.data.replaced;
      await after(role
        ? `Uploaded for ${role}.${rep ? ` "${rep.name}" was un-assigned and stays in your library.` : ''}`
        : 'Resume added to your library.');
    } catch (err) {
      fail(err, 'Upload failed. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const assign = async (resume, role) => {
    setBusy(resume._id);
    setError('');
    setNotice('');
    try {
      const res = await axiosClient.put(`/resumes/${resume._id}`, { targetRole: role });
      const rep = res.data.replaced;
      await after(role
        ? `"${nameOf(resume)}" is now your ${role} resume.${rep ? ` "${rep.name}" was un-assigned and stays in your library.` : ''}`
        : `"${nameOf(resume)}" is no longer assigned to a role. It stays in your library.`);
    } catch (err) {
      fail(err, 'Could not update the resume.');
    } finally {
      setBusy('');
    }
  };

  const makeDefault = async (resume) => {
    setBusy(resume._id);
    setError('');
    try {
      await axiosClient.put(`/resumes/${resume._id}`, { isDefault: true });
      await after(`"${nameOf(resume)}" is now your default resume.`);
    } catch (err) {
      fail(err, 'Could not set the default resume.');
    } finally {
      setBusy('');
    }
  };

  const remove = async (resume) => {
    setBusy(resume._id);
    setError('');
    setNotice('');
    try {
      const res = await axiosClient.delete(`/resumes/${resume._id}`);
      setDeleting(null);
      const kept = (res.data.analysesKept || 0) + (res.data.coverLettersKept || 0);
      await after(kept ? 'Resume deleted. Your analysis and cover letter history was kept.' : 'Resume deleted.');
    } catch (err) {
      setDeleting(null);
      fail(err, 'Could not delete the resume.');
    } finally {
      setBusy('');
    }
  };

  const askDelete = (r) => {
    // The server enforces the minimum-one rule (LAST_RESUME); a single resume goes straight to it for the explanation.
    if (resumes.length <= 1) remove(r);
    else setDeleting(r);
  };

  const def = resumes.find((r) => r.isDefault);
  const uploadingFor = (role) => busy === `upload:${role || ''}`;
  const assignable = (key) => resumes.filter((r) => norm(r.targetRole) !== key);

  return (
    <SectionCard id="resumes" icon={FileTextIcon} title="Resumes" subtitle="One resume per career interest gives sharper job matches. Your other resumes stay in your library." form={null}>
      <input ref={fileRef} type="file" className="sr-only" tabIndex={-1} aria-label="Choose resume file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={onFile} />

      <p className="text-xs text-ink/60 mb-4 rounded-lg bg-mint/60 px-3 py-2">
        CareerNest stores only the text extracted from your resume (PDF, DOCX or TXT, up to 5 MB), never the original file. The same resumes are used by <Link to="/resume" className="underline text-primary">Resume AI</Link> and the Cover Letter generator.
      </p>

      {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}
      {notice && <p role="status" className="text-sm text-primary bg-mint rounded-lg px-3 py-2 mb-3">{notice}</p>}

      {loading ? (
        <div className="grid gap-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
      ) : loadError ? (
        <p role="alert" className="text-sm text-red-600">{loadError} <button type="button" onClick={load} className="underline">Retry</button></p>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-ink mb-2">Role resumes</h3>
          {interests.length === 0 ? (
            <p className="text-sm text-ink/60 mb-4">Add and save at least one career interest above to create a role resume slot. You can still keep resumes in your library below.</p>
          ) : (
            <ul className="grid md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-3 mb-4" aria-label="Role resume slots">
              {interests.map((i) => {
                const assigned = resumes.find((r) => norm(r.targetRole) === i.roleKey);
                const others = assignable(i.roleKey);
                return (
                  <li key={i.roleKey} className="rounded-xl border border-sage/40 bg-bg/40 p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-ink truncate">{i.role}</span>
                      {norm(user.primaryRole) === i.roleKey && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent text-white">Primary</span>}
                    </div>
                    {assigned ? (
                      <div className="rounded-lg bg-white border border-sage/30 px-3 py-2">
                        <p className="text-sm font-medium text-ink truncate">{nameOf(assigned)}</p>
                        <ResumeMeta r={assigned} />
                      </div>
                    ) : (
                      <p className="text-xs text-ink/65">
                        {def
                          ? <>No resume assigned. Recommendations for this role use your default resume (<strong>{nameOf(def)}</strong>) as a fallback.</>
                          : 'No resume yet. Upload one to match jobs for this role.'}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      <button type="button" onClick={() => chooseFile(i.role)} disabled={Boolean(busy)} className={btnGhost}>
                        {uploadingFor(i.role) ? 'Uploading...' : assigned ? 'Replace with new file' : 'Upload for this role'}
                      </button>
                      {assigned && <button type="button" onClick={() => assign(assigned, null)} disabled={Boolean(busy)} className={btnGhost}>Unassign</button>}
                    </div>
                    {others.length > 0 && (
                      <label className="text-xs text-ink/70">
                        <span className="sr-only">Assign an existing resume to {i.role}</span>
                        <select
                          aria-label={`Assign an existing resume to ${i.role}`}
                          value=""
                          disabled={Boolean(busy)}
                          onChange={(e) => { const r = resumes.find((x) => x._id === e.target.value); if (r) assign(r, i.role); }}
                          className="focus-ring w-full bg-white border border-sage/50 rounded-xl px-3 py-2.5 text-sm text-ink"
                        >
                          <option value="">{assigned ? 'Use a different existing resume...' : 'Use an existing resume...'}</option>
                          {others.map((r) => <option key={r._id} value={r._id}>{nameOf(r)}</option>)}
                        </select>
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-ink">All resumes ({resumes.length})</h3>
            <button type="button" onClick={() => chooseFile(null)} disabled={Boolean(busy)} className={btnGhost}>{uploadingFor(null) ? 'Uploading...' : 'Upload to library'}</button>
          </div>
          {resumes.length === 0 ? (
            <p className="text-sm text-ink/60">No resumes yet. Upload one to unlock match checks and recommendations.</p>
          ) : (
            <ul className="flex flex-col gap-2" aria-label="Resume library">
              {resumes.map((r) => (
                <li key={r._id} className="rounded-xl border border-sage/40 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{nameOf(r)}</p>
                      <ResumeMeta r={r} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.isDefault && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-mint text-primary">Default</span>}
                      {r.roleAssigned
                        ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-accent text-white">Role: {r.targetRole}</span>
                        : <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-sage text-ink/70">Unassigned</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2 text-xs">
                    {!r.isDefault && <button type="button" onClick={() => makeDefault(r)} disabled={Boolean(busy)} className="focus-ring px-3 py-2 rounded-lg text-primary hover:bg-mint disabled:opacity-50">Set as default</button>}
                    {r.roleAssigned && <button type="button" onClick={() => assign(r, null)} disabled={Boolean(busy)} className="focus-ring px-3 py-2 rounded-lg text-primary hover:bg-mint disabled:opacity-50">Unassign</button>}
                    <button type="button" onClick={() => askDelete(r)} disabled={Boolean(busy)} className="focus-ring px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink/55 mt-3">You always keep at least one resume: the last remaining resume cannot be deleted. Upload another first.</p>
        </>
      )}

      {deleting && (
        <ModalShell title="Delete this resume?" onClose={() => setDeleting(null)} labelId="profile-delete-resume">
          <p className="text-sm text-ink mt-3"><strong>{nameOf(deleting)}</strong> will be removed from your library{deleting.roleAssigned ? ` and your ${deleting.targetRole} slot will be empty` : ''}.</p>
          <p className="text-sm text-ink/70 mt-2">Past analyses and cover letters that used it are kept.</p>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" onClick={() => setDeleting(null)} className={btnGhost}><CloseIcon size={14} /> Keep it</button>
            <button type="button" onClick={() => remove(deleting)} disabled={busy === deleting._id} className="focus-ring min-h-10 px-4 py-2 rounded-xl text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">{busy === deleting._id ? 'Deleting...' : 'Delete resume'}</button>
          </div>
        </ModalShell>
      )}
    </SectionCard>
  );
}

export default ResumesSection;
