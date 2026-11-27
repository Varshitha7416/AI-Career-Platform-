import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { ErrorMessage } from '../components/Feedback';
import IntroPanel from '../components/coverletter/IntroPanel';
import GenerateForm from '../components/coverletter/GenerateForm';
import LetterPanel, { NeedsInfo } from '../components/coverletter/LetterPanel';
import LetterHistory from '../components/coverletter/LetterHistory';
import ConfirmDialog from '../components/coverletter/ConfirmDialog';
import {
  aiErrorMessage, blobErrorMessage, copyText, filenameFromHeaders, jobLabel, saveBlob,
} from '../components/coverletter/letterUtils';
import { getErrorMessage } from '../utils/errors';

const EMPTY_MANUAL = { title: '', company: '', description: '' };

function CoverLetter() {
  const [sp] = useSearchParams();
  const urlJob = sp.get('job') || '';
  const urlResume = sp.get('resume') || '';
  const urlAnalysis = sp.get('analysis') || '';
  const urlLetter = sp.get('letter') || '';

  const [form, setForm] = useState({
    jobMode: 'catalog',
    jobId: urlJob,
    manual: EMPTY_MANUAL,
    userFacts: '',
    instructions: '',
    tone: 'professional',
    length: 'standard',
    useAnalysis: !!urlAnalysis,
  });
  const [resumeId, setResumeId] = useState(urlResume);
  const [analysisEntry, setAnalysisEntry] = useState(null); // {key, data}

  const [letter, setLetter] = useState(null);
  const [text, setText] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(null); // {id, opts}
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(null); // NEEDS_INFO questions from a failed generate/regenerate
  const panelRef = useRef(null);

  const patch = useCallback((obj) => setForm((f) => ({ ...f, ...obj })), []);
  const dirty = !!letter && text !== (letter.currentText ?? '');

  // ----- history -----
  const upsertHistory = useCallback((dto) => {
    setHistory((prev) => {
      const summary = { ...dto };
      delete summary.versions;
      const rest = prev.filter((h) => h._id !== dto._id);
      const existing = prev.find((h) => h._id === dto._id);
      return [{ ...existing, ...summary }, ...rest];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axiosClient.get('/cover-letters');
        if (!cancelled) setHistory(res.data.coverLetters || []);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load your cover letters'));
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ----- analysis for this resume + job (optional insights) -----
  const analysisKey = resumeId && form.jobMode === 'catalog' && form.jobId ? `${resumeId}:${form.jobId}` : '';
  useEffect(() => {
    if (!analysisKey) return undefined;
    let cancelled = false;
    const [rid, jid] = analysisKey.split(':');
    (async () => {
      try {
        const res = await axiosClient.get('/resume-analysis', { params: { resumeId: rid, jobId: jid, limit: 1 } });
        if (!cancelled) setAnalysisEntry({ key: analysisKey, data: res.data.analyses?.[0] || null });
      } catch {
        if (!cancelled) setAnalysisEntry({ key: analysisKey, data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [analysisKey]);
  const analysis = analysisKey && analysisEntry?.key === analysisKey ? analysisEntry.data : null;

  // ----- letters -----
  const applyLetterToForm = useCallback((l) => {
    const o = l.options || {};
    setForm((f) => {
      const next = {
        ...f,
        tone: o.tone || 'professional',
        length: o.length || 'standard',
        instructions: o.instructions || '',
        userFacts: o.userFacts || '',
        useAnalysis: !!o.useAnalysis,
      };
      if (l.job?._id) return { ...next, jobMode: 'catalog', jobId: l.job._id };
      if (l.jobSnapshot) {
        return { ...next, jobMode: 'manual', jobId: '', manual: { title: l.jobSnapshot.title || '', company: l.jobSnapshot.company || '', description: '' } };
      }
      return next;
    });
    if (l.resume?._id) setResumeId(l.resume._id);
  }, []);

  const fetchLetter = useCallback(async (id) => {
    const res = await axiosClient.get(`/cover-letters/${id}`);
    return res.data.coverLetter;
  }, []);

  const showLetter = useCallback((l) => {
    setLetter(l);
    setText(l.currentText ?? l.generatedText ?? '');
    upsertHistory(l);
  }, [upsertHistory]);

  const openLetter = useCallback(async (idOrLetter, { scroll = true } = {}) => {
    const id = typeof idOrLetter === 'string' ? idOrLetter : idOrLetter._id;
    if (dirty && letter && letter._id !== id && !window.confirm('You have unsaved changes in the current letter. Open another letter and discard them?')) return null;
    setError('');
    setNotice('');
    try {
      const full = await fetchLetter(id);
      setLetter(full);
      setText(full.currentText ?? full.generatedText ?? '');
      applyLetterToForm(full);
      if (scroll) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return full;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not open that letter'));
      return null;
    }
  }, [dirty, letter, fetchLetter, applyLetterToForm]);

  useEffect(() => {
    if (!urlLetter) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deep link: load the requested letter once
    openLetter(urlLetter, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the URL param
  }, [urlLetter]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const manualReady = form.manual.title.trim() && form.manual.company.trim();
  const useCatalog = form.jobMode === 'catalog' && !!form.jobId;
  const jobReady = useCatalog || !!manualReady;
  const canGenerate = !!resumeId && jobReady;

  const handleGenerate = async (factsOverride) => {
    const facts = typeof factsOverride === 'string' ? factsOverride : form.userFacts;
    setPending(null);
    if (dirty && !window.confirm('You have unsaved changes in the current letter. Generate a new letter and discard them?')) return;
    setError('');
    setNotice('');
    setGenerating(true);
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const body = {
      resumeId,
      tone: form.tone,
      length: form.length,
      instructions: form.instructions.trim() || undefined,
      userFacts: facts.trim() || undefined,
    };
    if (form.jobMode === 'catalog' && form.jobId) body.jobId = form.jobId;
    else body.manualJob = { title: form.manual.title.trim(), company: form.manual.company.trim(), description: form.manual.description.trim() || undefined };
    const aId = analysis?._id || (urlAnalysis && form.useAnalysis ? urlAnalysis : '');
    if (form.useAnalysis && aId) { body.analysisId = aId; body.useAnalysis = true; }
    try {
      const res = await axiosClient.post('/cover-letters', body);
      let full = res.data.coverLetter;
      if (!Array.isArray(full.versions)) full = await fetchLetter(full._id);
      showLetter(full);
    } catch (err) {
      if (err.response?.data?.code === 'NEEDS_INFO' && err.response.data.needsInfo?.length) {
        setPending({ questions: err.response.data.needsInfo, kind: 'generate' });
      } else {
        setError(aiErrorMessage(err, 'Failed to generate the cover letter'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const saveText = useCallback(async () => {
    if (!letter) return null;
    setSaving(true);
    setError('');
    try {
      const res = await axiosClient.put(`/cover-letters/${letter._id}`, { text });
      let full = res.data.coverLetter;
      if (!Array.isArray(full.versions) || full.versions.some((v) => typeof v.text !== 'string')) full = await fetchLetter(letter._id);
      setLetter(full);
      setText(full.currentText ?? text);
      upsertHistory(full);
      setNotice('Saved.');
      return full;
    } catch (err) {
      setError(getErrorMessage(err, 'Could not save your changes'));
      return null;
    } finally {
      setSaving(false);
    }
  }, [letter, text, fetchLetter, upsertHistory]);

  const handleCopy = async () => {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadById = async (id, format, fallbackName) => {
    const res = await axiosClient.get(`/cover-letters/${id}/download`, { params: { format }, responseType: 'blob' });
    saveBlob(res.data, filenameFromHeaders(res.headers, `${fallbackName}.${format}`));
  };

  const handleDownload = async (format) => {
    if (!letter) return;
    setError('');
    setDownloading(format);
    try {
      if (dirty) {
        const saved = await saveText();
        if (!saved) return; // save failed, error already shown
      }
      await downloadById(letter._id, format, 'Cover-Letter');
    } catch (err) {
      setError(await blobErrorMessage(err));
    } finally {
      setDownloading('');
    }
  };

  const handleHistoryDownload = async (l, format) => {
    setError('');
    setDownloadingId(l._id);
    try {
      await downloadById(l._id, format, 'Cover-Letter');
    } catch (err) {
      setError(await blobErrorMessage(err));
    } finally {
      setDownloadingId('');
    }
  };

  // ----- regenerate -----
  const currentOpts = () => ({
    tone: form.tone,
    length: form.length,
    instructions: form.instructions.trim() || undefined,
    userFacts: form.userFacts.trim() || undefined,
    resumeId: resumeId || undefined,
  });

  const runRegenerate = async (id, opts, force) => {
    setError('');
    setNotice('');
    setRegenerating(true);
    setConfirmRegen(null);
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const res = await axiosClient.post(`/cover-letters/${id}/regenerate`, { ...opts, force: force || undefined });
      let full = res.data.coverLetter;
      if (!Array.isArray(full.versions) || full.versions.some((v) => typeof v.text !== 'string')) full = await fetchLetter(id);
      showLetter(full);
      setNotice('New version generated. Your earlier text is kept in version history.');
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.code === 'HAS_EDITS') {
        setConfirmRegen({ id, opts });
      } else if (err.response?.data?.code === 'NEEDS_INFO' && err.response.data.needsInfo?.length) {
        setPending({ questions: err.response.data.needsInfo, kind: 'regenerate', id, opts });
      } else {
        setError(aiErrorMessage(err, 'Failed to regenerate the cover letter'));
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!letter) return;
    if (dirty) {
      const saved = await saveText(); // keep the user's edits in version history before replacing
      if (!saved) return;
    }
    runRegenerate(letter._id, currentOpts(), false);
  };

  const handleHistoryRegenerate = async (l) => {
    const full = await openLetter(l, { scroll: false });
    if (!full) return;
    const o = full.options || {};
    runRegenerate(full._id, {
      tone: o.tone, length: o.length, instructions: o.instructions || undefined, userFacts: o.userFacts || undefined,
      resumeId: full.resume?._id || resumeId || undefined,
    }, false);
  };

  const handleAnswerNeedsInfo = (answers) => {
    if (!letter) return;
    const userFacts = [form.userFacts.trim(), answers].filter(Boolean).join('\n');
    patch({ userFacts });
    const proceed = async () => {
      if (dirty) {
        const saved = await saveText();
        if (!saved) return;
      }
      runRegenerate(letter._id, { ...currentOpts(), userFacts }, false);
    };
    proceed();
  };

  const handleRestore = async (versionNumber) => {
    if (!letter) return;
    if (dirty && !window.confirm('Restoring replaces your unsaved edits (the current saved text stays in history). Continue?')) return;
    setRestoring(true);
    setError('');
    try {
      await axiosClient.post(`/cover-letters/${letter._id}/restore`, { versionNumber });
      const full = await fetchLetter(letter._id);
      showLetter(full);
      setNotice(`Version ${versionNumber} restored as a new version.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not restore that version'));
    } finally {
      setRestoring(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await axiosClient.delete(`/cover-letters/${confirmDelete._id}`);
      setHistory((prev) => prev.filter((h) => h._id !== confirmDelete._id));
      if (letter?._id === confirmDelete._id) { setLetter(null); setText(''); setNotice(''); }
      setConfirmDelete(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete that letter'));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const deleteLabel = confirmDelete ? jobLabel(confirmDelete) : null;

  return (
    <div className="min-h-screen bg-bg px-4 sm:px-6 py-6">
      <div className="max-w-[1500px] mx-auto">
        <div className="grid gap-5 grid-cols-1 lg:grid-cols-[minmax(230px,25%)_minmax(0,1fr)_minmax(0,1fr)] items-stretch lg:items-start">
          <IntroPanel />
          <GenerateForm
            form={form}
            patch={patch}
            resumeId={resumeId}
            onResumeSelect={(r) => setResumeId(r?._id || '')}
            analysis={analysis}
            canGenerate={canGenerate}
            generating={generating}
            onGenerate={handleGenerate}
            hasLetter={!!letter}
          />
          <div ref={panelRef} className="scroll-mt-20 space-y-3">
            {error && <ErrorMessage message={error} />}
            {pending && !generating && !regenerating && (
              <NeedsInfo
                items={pending.questions}
                busy={false}
                onSubmit={(answers) => {
                  const facts = [form.userFacts.trim(), answers].filter(Boolean).join('\n');
                  patch({ userFacts: facts });
                  if (pending.kind === 'generate') handleGenerate(facts);
                  else { const p = pending; setPending(null); runRegenerate(p.id, { ...p.opts, userFacts: facts }, false); }
                }}
              />
            )}
            <LetterPanel
              letter={letter}
              generating={generating}
              regenerating={regenerating}
              text={text}
              setText={setText}
              dirty={dirty}
              saving={saving}
              onSave={saveText}
              onCopy={handleCopy}
              copied={copied}
              onDownload={handleDownload}
              downloading={downloading}
              onRegenerate={handleRegenerate}
              onRestore={handleRestore}
              restoring={restoring}
              onAnswerNeedsInfo={handleAnswerNeedsInfo}
              notice={notice}
            />
          </div>
        </div>

        <LetterHistory
          letters={history}
          loading={historyLoading}
          activeId={letter?._id}
          downloadingId={downloadingId}
          onOpen={openLetter}
          onDownload={handleHistoryDownload}
          onRegenerate={handleHistoryRegenerate}
          onDelete={setConfirmDelete}
        />
      </div>

      {confirmRegen && (
        <ConfirmDialog
          title="Replace your edited letter?"
          confirmLabel="Regenerate anyway"
          onCancel={() => setConfirmRegen(null)}
          onConfirm={() => runRegenerate(confirmRegen.id, confirmRegen.opts, true)}
        >
          <p>This letter has edits that differ from the AI version. Regenerating makes a new letter the current text.</p>
          <p>Your edited text is not lost: it stays in version history and you can restore it at any time.</p>
        </ConfirmDialog>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this cover letter?"
          confirmLabel="Delete"
          danger
          busy={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleDelete}
        >
          <p>
            The letter for {deleteLabel.title}{deleteLabel.company ? ` at ${deleteLabel.company}` : ''} and all of its versions will be deleted. This cannot be undone.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default CoverLetter;
