import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { getErrorMessage } from '../utils/errors';
import { validateJobForm } from '../utils/adminValidation';
import { AdminPage, AvailabilityBadge, inputClass, btnPrimary, btnGhost } from '../components/admin/AdminNav';
import { Skeleton, ErrorMessage, SuccessMessage } from '../components/Feedback';

const EMPTY = {
  title: '', company: '', city: '', country: 'India', category: '', jobDescription: '',
  experienceLevel: 'experienced', experienceMinYears: '', experienceMaxYears: '',
  employmentType: 'full-time', workMode: 'onsite',
  salaryMin: '', salaryMax: '', salaryCurrency: 'INR', salaryPeriod: 'year',
  skills: '', preferredSkills: '', responsibilities: '', requirements: '',
  applyUrl: '', applicationDeadline: '',
};
const LIST_FIELDS = ['skills', 'preferredSkills', 'responsibilities', 'requirements'];

const toForm = (job) => {
  const f = { ...EMPTY };
  for (const k of Object.keys(EMPTY)) {
    const v = job[k];
    if (v === undefined || v === null) continue;
    f[k] = LIST_FIELDS.includes(k) ? v.join('\n') : String(v);
  }
  f.company = job.company?._id || job.company || '';
  f.applicationDeadline = job.applicationDeadline ? String(job.applicationDeadline).slice(0, 10) : '';
  return f;
};

const toPayload = (f) => {
  const p = { ...f };
  for (const k of ['experienceMinYears', 'experienceMaxYears', 'salaryMin', 'salaryMax']) if (p[k] === '') delete p[k];
  p.applicationDeadline = f.applicationDeadline || null;
  return p;
};

function Field({ label, error, children, wide }) {
  return (
    <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="block text-sm font-medium text-ink mb-1">{label}</span>
      {children}
      {error && <span role="alert" className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  );
}

function AdminJobForm() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let alive = true;
    axiosClient.get('/admin/companies/options')
      .then((res) => { if (alive) setCompanies(res.data.companies || []); })
      .catch((err) => { if (alive) setError(getErrorMessage(err)); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (isNew) return undefined;
    let alive = true;
    axiosClient.get(`/admin/jobs/${id}`)
      .then((res) => { if (alive) { setOriginal(res.data.job); setForm(toForm(res.data.job)); } })
      .catch((err) => { if (alive) setError(getErrorMessage(err)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, isNew]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const found = validateJobForm(form, { originalDeadline: original?.applicationDeadline ? String(original.applicationDeadline).slice(0, 10) : '' });
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      if (isNew) {
        const res = await axiosClient.post('/admin/jobs', toPayload(form));
        navigate(`/admin/jobs/${res.data.job._id}`, { replace: true });
      } else {
        const res = await axiosClient.put(`/admin/jobs/${id}`, toPayload(form));
        setOriginal(res.data.job);
        setNotice('Job saved.');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // The current company may be archived (not in the options list): keep it selectable so the form stays valid.
  const options = [...companies];
  if (original?.company && !options.some((c) => c._id === original.company._id)) options.push({ _id: original.company._id, name: `${original.company.name} (archived)` });

  return (
    <AdminPage
      title={isNew ? 'New job' : 'Job details'}
      subtitle={isNew ? 'Fill in the listing. You can hide or close it later.' : 'View and edit this listing.'}
      actions={<Link to="/admin/jobs" className={btnGhost}>Back to jobs</Link>}
    >
      {loading ? <Skeleton className="h-64" /> : (
        <form onSubmit={save} noValidate className="bg-white rounded-2xl border border-sage/30 p-5 grid sm:grid-cols-2 gap-4">
          {!isNew && original && (
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3 text-sm text-ink/80">
              <AvailabilityBadge value={original.availability} />
              <span>{original.jobCode}</span>
              {original.closedAt && <span>Closed {new Date(original.closedAt).toLocaleDateString()}</span>}
              <span className="text-ink/60">Use Activate / Deactivate / Close on the jobs list to change visibility.</span>
            </div>
          )}
          <ErrorMessage message={error} />
          <SuccessMessage message={notice} />
          <Field label="Title *" error={errors.title}><input className={inputClass} value={form.title} onChange={set('title')} maxLength={200} /></Field>
          <Field label="Company *" error={errors.company}>
            <select className={inputClass} value={form.company} onChange={set('company')}>
              <option value="">Select a company</option>
              {options.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="City *" error={errors.city}><input className={inputClass} value={form.city} onChange={set('city')} /></Field>
          <Field label="Country"><input className={inputClass} value={form.country} onChange={set('country')} /></Field>
          <Field label="Category" error={errors.category}><input className={inputClass} value={form.category} onChange={set('category')} placeholder="e.g. Engineering" /></Field>
          <Field label="Application deadline" error={errors.applicationDeadline}><input type="date" className={inputClass} value={form.applicationDeadline} onChange={set('applicationDeadline')} /></Field>
          <Field label="Description *" error={errors.jobDescription} wide><textarea rows={5} className={inputClass} value={form.jobDescription} onChange={set('jobDescription')} /></Field>
          <Field label="Responsibilities (one per line)" wide><textarea rows={3} className={inputClass} value={form.responsibilities} onChange={set('responsibilities')} /></Field>
          <Field label="Requirements (one per line)" wide><textarea rows={3} className={inputClass} value={form.requirements} onChange={set('requirements')} /></Field>
          <Field label="Skills (comma or line separated)"><textarea rows={2} className={inputClass} value={form.skills} onChange={set('skills')} /></Field>
          <Field label="Preferred skills"><textarea rows={2} className={inputClass} value={form.preferredSkills} onChange={set('preferredSkills')} /></Field>
          <Field label="Experience level">
            <select className={inputClass} value={form.experienceLevel} onChange={set('experienceLevel')}><option value="fresher">Fresher</option><option value="experienced">Experienced</option></select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min years" error={errors.experienceMinYears}><input type="number" min="0" className={inputClass} value={form.experienceMinYears} onChange={set('experienceMinYears')} /></Field>
            <Field label="Max years" error={errors.experienceMaxYears}><input type="number" min="0" className={inputClass} value={form.experienceMaxYears} onChange={set('experienceMaxYears')} /></Field>
          </div>
          <Field label="Employment type">
            <select className={inputClass} value={form.employmentType} onChange={set('employmentType')}>
              {['full-time', 'part-time', 'contract', 'internship'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Work mode">
            <select className={inputClass} value={form.workMode} onChange={set('workMode')}>
              {['onsite', 'hybrid', 'remote'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Salary min" error={errors.salaryMin}><input type="number" min="0" className={inputClass} value={form.salaryMin} onChange={set('salaryMin')} /></Field>
            <Field label="Salary max" error={errors.salaryMax}><input type="number" min="0" className={inputClass} value={form.salaryMax} onChange={set('salaryMax')} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency"><select className={inputClass} value={form.salaryCurrency} onChange={set('salaryCurrency')}>{['INR', 'USD', 'EUR', 'GBP'].map((v) => <option key={v}>{v}</option>)}</select></Field>
            <Field label="Period"><select className={inputClass} value={form.salaryPeriod} onChange={set('salaryPeriod')}><option value="year">Per year</option><option value="month">Per month</option></select></Field>
          </div>
          <Field label="Apply URL (http or https)" error={errors.applyUrl} wide><input className={inputClass} value={form.applyUrl} onChange={set('applyUrl')} placeholder="https://" /></Field>
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className={btnPrimary} disabled={saving}>{saving ? 'Saving...' : isNew ? 'Create job' : 'Save changes'}</button>
            <Link to="/admin/jobs" className={btnGhost}>Cancel</Link>
          </div>
        </form>
      )}
    </AdminPage>
  );
}

export default AdminJobForm;
