import { useState, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { validateCompanyForm } from '../utils/adminValidation';
import { AdminPage, AvailabilityBadge, inputClass, btnPrimary, btnGhost } from '../components/admin/AdminNav';
import { Skeleton, ErrorMessage, SuccessMessage, EmptyState } from '../components/Feedback';
import Pagination from '../components/Pagination';

const EMPTY = { name: '', industry: '', location: '', size: '', website: '', logoUrl: '', description: '' };

function CompanyForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, initial?.[k] || ''])) });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const found = validateCompanyForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      const res = initial?._id ? await axiosClient.put(`/admin/companies/${initial._id}`, form) : await axiosClient.post('/admin/companies', form);
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
        ? <textarea rows={3} className={inputClass} value={form[key]} onChange={set(key)} />
        : <input className={inputClass} value={form[key]} onChange={set(key)} placeholder={extra.placeholder} />}
      {errors[key] && <span role="alert" className="block text-xs text-red-600 mt-1">{errors[key]}</span>}
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="bg-white rounded-2xl border border-sage/30 p-5 grid sm:grid-cols-2 gap-4 mb-6" aria-label={initial?._id ? 'Edit company' : 'New company'}>
      <div className="sm:col-span-2"><ErrorMessage message={error} /></div>
      {field('Name *', 'name')}
      {field('Industry', 'industry')}
      {field('Location', 'location')}
      {field('Size', 'size', { placeholder: 'e.g. 50-200' })}
      {field('Website', 'website', { placeholder: 'https://' })}
      {field('Logo URL', 'logoUrl', { placeholder: 'https://' })}
      {field('Description', 'description', { wide: true, area: true })}
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Saving...' : initial?._id ? 'Save changes' : 'Create company'}</button>
        <button type="button" className={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function AdminCompanies() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [applied, setApplied] = useState({ q: '', status: 'all' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | company
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const params = { page, limit: 10 };
      if (applied.q) params.q = applied.q;
      if (applied.status !== 'all') params.status = applied.status;
      const res = await axiosClient.get('/admin/companies', { params });
      setData(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [applied, page]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const act = async (company, action) => {
    if (action === 'archive' && !window.confirm(`Archive ${company.name}? It can no longer be chosen for new jobs. Existing jobs are kept.`)) return;
    if (action === 'delete' && !window.confirm(`Permanently delete ${company.name}? This cannot be undone.`)) return;
    setBusyId(company._id);
    setNotice('');
    setError('');
    try {
      const res = action === 'delete' ? await axiosClient.delete(`/admin/companies/${company._id}`) : await axiosClient.post(`/admin/companies/${company._id}/${action}`);
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
      title="Companies"
      subtitle="Companies with jobs are archived, not deleted."
      actions={<button type="button" className={btnPrimary} onClick={() => { setEditing('new'); setNotice(''); }}>New company</button>}
    >
      {editing && (
        <CompanyForm
          key={editing === 'new' ? 'new' : editing._id}
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setNotice(msg); load(); }}
        />
      )}
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied({ q, status }); }} className="bg-white rounded-2xl border border-sage/30 p-4 flex flex-wrap gap-3 mb-5" role="search" aria-label="Filter companies">
        <input aria-label="Search companies" placeholder="Name, industry, location" value={q} onChange={(e) => setQ(e.target.value)} className={`${inputClass} sm:w-72`} />
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} sm:w-44`}>
          <option value="all">All</option><option value="active">Active</option><option value="archived">Archived</option>
        </select>
        <button type="submit" className={btnPrimary}>Search</button>
      </form>

      <ErrorMessage message={error} onRetry={load} />
      <SuccessMessage message={notice} />
      {!data && !error && <Skeleton className="h-48" />}
      {data && data.companies.length === 0 && <EmptyState title="No companies found" />}
      {data && data.companies.length > 0 && (
        <>
          <ul className="space-y-3">
            {data.companies.map((c) => (
              <li key={c._id} className="bg-white rounded-2xl border border-sage/30 p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-primary">{c.name}</span>
                    <AvailabilityBadge value={c.isActive ? 'active' : 'archived'} />
                  </div>
                  <p className="text-sm text-ink/70 mt-1">
                    {[c.industry, c.location, c.size].filter(Boolean).join(' · ') || 'No details yet'} · {c.jobCount} job{c.jobCount === 1 ? '' : 's'}
                  </p>
                  {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">{c.website}</a>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={btnGhost} onClick={() => { setEditing(c); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                  {c.isActive
                    ? <button type="button" className={btnGhost} disabled={busyId === c._id} onClick={() => act(c, 'archive')}>Archive</button>
                    : <button type="button" className={btnGhost} disabled={busyId === c._id} onClick={() => act(c, 'restore')}>Restore</button>}
                  {c.jobCount === 0 && <button type="button" className={btnGhost} disabled={busyId === c._id} onClick={() => act(c, 'delete')}>Delete</button>}
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

export default AdminCompanies;
