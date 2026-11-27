import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { AdminPage, AvailabilityBadge, inputClass, btnPrimary, btnGhost } from '../components/admin/AdminNav';
import { Skeleton, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';
import Pagination from '../components/Pagination';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const THEMES = ['forest', 'sage', 'mint', 'moss'];

const isHttpUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

// "Title | https://..." per line
const parseResources = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
  const i = line.lastIndexOf('|');
  return i === -1 ? { title: line, url: '' } : { title: line.slice(0, i).trim(), url: line.slice(i + 1).trim() };
});

function toForm(p) {
  return {
    title: p?.title || '',
    provider: p?.provider || '',
    description: p?.description || '',
    category: p?.category || '',
    level: p?.level || 'Beginner',
    duration: p?.duration || '',
    theme: p?.theme || 'forest',
    url: p?.url || '',
    skills: (p?.skills || []).join(', '),
    enrollmentInfo: p?.enrollmentInfo || '',
    resources: (p?.resources || []).map((r) => `${r.title} | ${r.url}`).join('\n'),
    milestones: (p?.milestones || []).map((m) => m.title).join('\n'),
  };
}

function validate(f) {
  const e = {};
  if (f.title.trim().length < 2) e.title = 'Title is required';
  if (!f.provider.trim()) e.provider = 'Provider is required';
  if (f.description.trim().length < 10) e.description = 'Description needs at least 10 characters';
  if (!f.category.trim()) e.category = 'Category is required';
  if (f.url.trim() && !isHttpUrl(f.url.trim())) e.url = 'Must be a valid http(s) link';
  const bad = parseResources(f.resources).find((r) => !r.title || !isHttpUrl(r.url));
  if (bad) e.resources = 'Each line needs a title and a valid http(s) link: Title | https://...';
  return e;
}

function ProgramForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(() => toForm(initial));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    // keep the existing order number of a milestone whose title is unchanged (learners' progress refers to it)
    const existing = new Map((initial?.milestones || []).map((m) => [m.title, m.order]));
    const used = new Set();
    const milestones = form.milestones.split('\n').map((l) => l.trim()).filter(Boolean).map((title) => {
      const order = existing.get(title);
      if (order !== undefined && !used.has(order)) { used.add(order); return { title, order }; }
      return { title };
    });
    const payload = {
      title: form.title.trim(),
      provider: form.provider.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      level: form.level,
      duration: form.duration.trim(),
      theme: form.theme,
      url: form.url.trim(),
      skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      enrollmentInfo: form.enrollmentInfo.trim(),
      resources: parseResources(form.resources),
      milestones,
    };
    setSaving(true);
    try {
      const res = initial?.id ? await axiosClient.put(`/admin/programs/${initial.id}`, payload) : await axiosClient.post('/admin/programs', payload);
      onSaved(res.data.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, extra = {}) => (
    <label className={`block ${extra.wide ? 'sm:col-span-2' : ''}`}>
      <span className="block text-sm font-medium text-ink mb-1">{label}</span>
      {extra.area
        ? <textarea rows={extra.rows || 3} className={inputClass} value={form[key]} onChange={set(key)} placeholder={extra.placeholder} />
        : <input className={inputClass} value={form[key]} onChange={set(key)} placeholder={extra.placeholder} />}
      {extra.hint && <span className="block text-xs text-ink/60 mt-1">{extra.hint}</span>}
      {errors[key] && <span role="alert" className="block text-xs text-red-600 mt-1">{errors[key]}</span>}
    </label>
  );
  const select = (label, key, options) => (
    <label className="block">
      <span className="block text-sm font-medium text-ink mb-1">{label}</span>
      <select className={inputClass} value={form[key]} onChange={set(key)}>{options.map((o) => <option key={o}>{o}</option>)}</select>
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="bg-white rounded-2xl border border-sage/30 p-5 grid sm:grid-cols-2 gap-4 mb-6" aria-label={initial?.id ? 'Edit program' : 'New program'}>
      <div className="sm:col-span-2"><ErrorMessage message={error} /></div>
      {field('Title *', 'title')}
      {field('Provider *', 'provider')}
      {field('Category *', 'category')}
      {field('Duration', 'duration', { placeholder: 'e.g. 8 weeks', hint: 'Used for the duration filter when it contains weeks, months or days.' })}
      {select('Level', 'level', LEVELS)}
      {select('Theme', 'theme', THEMES)}
      {field('Provider link', 'url', { placeholder: 'https://', wide: true })}
      {field('Description *', 'description', { wide: true, area: true })}
      {field('Skills', 'skills', { wide: true, hint: 'Comma separated.' })}
      {field('How to enrol (optional)', 'enrollmentInfo', { wide: true, area: true, rows: 2 })}
      {field('Resources (optional)', 'resources', { wide: true, area: true, placeholder: 'Syllabus | https://example.com/syllabus', hint: 'One per line: Title | link. Only links you enter are shown to learners.' })}
      {field('Milestones (optional)', 'milestones', { wide: true, area: true, rows: 4, hint: 'One per line. When set, learner progress is calculated from completed milestones. Keep a title unchanged to keep learners\' progress on it.' })}
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Saving...' : initial?.id ? 'Save changes' : 'Create program'}</button>
        <button type="button" className={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AdminPrograms() {
  const [q, setQ] = useState('');
  const [state, setState] = useState('all');
  const [applied, setApplied] = useState({ q: '', state: 'all' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const params = { page, limit: 10 };
      if (applied.q) params.q = applied.q;
      if (applied.state !== 'all') params.state = applied.state;
      const res = await axiosClient.get('/admin/programs', { params });
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [applied, page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const setProgramState = async (p, next) => {
    if (next === 'archived' && !window.confirm(`Archive ${p.title}? It is hidden from learners and roadmaps; people who saved it keep their record.`)) return;
    setBusyId(p.id);
    setNotice('');
    setError('');
    try {
      const res = await axiosClient.put(`/admin/programs/${p.id}/state`, { state: next });
      setNotice(res.data.message);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  return (
    <AdminPage
      title="Career Programs"
      subtitle="Programs are archived, never deleted, so learners keep their saved and in-progress records."
      actions={<button type="button" className={btnPrimary} onClick={() => { setEditing('new'); setNotice(''); }}>New program</button>}
    >
      {editing && (
        <ProgramForm
          key={editing === 'new' ? 'new' : editing.id}
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNotice(msg); load(); }}
        />
      )}
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied({ q, state }); }} className="bg-white rounded-2xl border border-sage/30 p-4 flex flex-wrap gap-3 mb-5" role="search" aria-label="Filter programs">
        <input aria-label="Search programs" placeholder="Title, provider, category" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputClass} sm:w-72`} />
        <select aria-label="State" value={state} onChange={(e) => setState(e.target.value)} className={`${inputClass} sm:w-44`}>
          <option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
        </select>
        <button type="submit" className={btnPrimary}>Search</button>
      </form>

      <ErrorMessage message={error} onRetry={load} />
      <SuccessMessage message={notice} />
      {!data && !error && <Skeleton className="h-48" />}
      {data && data.programs.length === 0 && <EmptyState title="No programs found" />}
      {data && data.programs.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.programs.map((p) => (
              <li key={p.id} className="bg-white rounded-2xl border border-sage/30 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-primary">{p.title}</span>
                    <AvailabilityBadge value={p.state} />
                  </div>
                  <p className="text-sm text-ink/70 mt-1">
                    {[p.provider, p.category, p.level, p.duration].filter(Boolean).join(' · ')}
                  </p>
                  <p className="text-xs text-ink/60 mt-1">
                    {p.enrollmentCounts.total} learner{p.enrollmentCounts.total === 1 ? '' : 's'}: {p.enrollmentCounts.saved} saved, {p.enrollmentCounts.inProgress} in progress, {p.enrollmentCounts.completed} completed
                    {p.milestones.length > 0 ? ` · ${p.milestones.length} milestones` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnGhost} onClick={() => { setEditing(p); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                  {p.state !== 'active' && <button type="button" className={btnGhost} disabled={busyId === p.id} onClick={() => setProgramState(p, 'active')}>{p.state === 'archived' ? 'Restore' : 'Activate'}</button>}
                  {p.state === 'active' && <button type="button" className={btnGhost} disabled={busyId === p.id} onClick={() => setProgramState(p, 'inactive')}>Deactivate</button>}
                  {p.state !== 'archived' && <button type="button" className={btnGhost} disabled={busyId === p.id} onClick={() => setProgramState(p, 'archived')}>Archive</button>}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </AdminPage>
  );
}

export default AdminPrograms;
