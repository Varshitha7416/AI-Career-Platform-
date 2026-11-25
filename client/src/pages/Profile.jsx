import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { getUser, updateStoredUser } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import { ErrorMessage, SuccessMessage, Skeleton } from '../components/Feedback';

const inputClass = 'border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary';

function Profile() {
  const stored = getUser();
  const [form, setForm] = useState(null);
  const [email, setEmail] = useState(stored?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [companyDraft, setCompanyDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    axiosClient
      .get('/auth/me')
      .then((res) => {
        const u = res.data.user;
        setEmail(u.email);
        setForm({
          name: u.name,
          seekingRole: u.seekingRole || '',
          isReferrer: u.isReferrer,
          referralCompanies: u.referralCompanies || [],
          currentCompany: u.currentCompany || '',
          currentCompanyRole: u.currentCompanyRole || '',
          preferredLocation: u.preferredLocation || '',
          preferredWorkMode: u.preferredWorkMode || '',
          preferredEmploymentType: u.preferredEmploymentType || '',
          experienceYears: u.experienceYears ?? '',
        });
        updateStoredUser(u);
      })
      .catch((err) => setError(getErrorMessage(err, 'Could not load your profile')))
      .finally(() => setLoading(false));
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const addCompany = (raw) => {
    const name = raw.trim().slice(0, 80);
    if (!name) return;
    setForm((f) => {
      if (f.referralCompanies.length >= 10 || f.referralCompanies.some((c) => c.toLowerCase() === name.toLowerCase())) return f;
      return { ...f, referralCompanies: [...f.referralCompanies, name] };
    });
    setCompanyDraft('');
  };
  const removeCompany = (name) => setForm((f) => ({ ...f, referralCompanies: f.referralCompanies.filter((c) => c !== name) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.name.trim().length < 2) return setError('Name must be at least 2 characters.');
    if (form.isReferrer && !form.currentCompany.trim() && form.referralCompanies.length === 0) return setError('Add your current company or at least one company you can refer at.');
    if (form.experienceYears !== '' && (Number(form.experienceYears) < 0 || Number(form.experienceYears) > 50)) return setError('Experience must be between 0 and 50 years.');
    if (newPassword && newPassword.length < 6) return setError('New password must be at least 6 characters.');

    setSaving(true);
    try {
      const payload = { ...form };
      const draft = companyDraft.trim().slice(0, 80);
      if (draft && !payload.referralCompanies.some((c) => c.toLowerCase() === draft.toLowerCase()) && payload.referralCompanies.length < 10) {
        payload.referralCompanies = [...payload.referralCompanies, draft];
      }
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      const res = await axiosClient.put('/auth/profile', payload);
      updateStoredUser(res.data.user);
      setCurrentPassword('');
      setNewPassword('');
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg px-6 py-12 flex justify-center">
      <div className="bg-white shadow-sm rounded-xl p-8 w-full max-w-md h-fit">
        <div className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4">
          {(form?.name || stored?.name)?.[0]?.toUpperCase() || 'U'}
        </div>
        <h1 className="text-xl font-semibold text-charcoal mb-1 text-center">{form?.name || stored?.name}</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">{email}</p>

        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !form ? (
          <ErrorMessage message={error || 'Could not load your profile'} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {error && <ErrorMessage message={error} />}
            {success && <SuccessMessage message={success} />}

            <label className="text-sm font-medium text-charcoal">
              Name
              <input type="text" value={form.name} onChange={set('name')} className={`${inputClass} mt-1 font-normal`} />
            </label>
            <label className="text-sm font-medium text-charcoal">
              Role you're looking for
              <input type="text" value={form.seekingRole} onChange={set('seekingRole')} placeholder="e.g. Frontend Developer" className={`${inputClass} mt-1 font-normal`} />
            </label>

            <div className="border-t border-gray-100 pt-4 grid gap-3">
              <div>
                <p className="text-sm font-medium text-charcoal">Job preferences</p>
                <p className="text-xs text-gray-500">Used to match Recommended Jobs (simple rule-based matching, not AI). All optional.</p>
              </div>
              <input type="text" value={form.preferredLocation} onChange={set('preferredLocation')} placeholder="Preferred city (e.g. Bangalore)" aria-label="Preferred city" className={inputClass} />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.preferredWorkMode} onChange={set('preferredWorkMode')} aria-label="Preferred work mode" className={inputClass}>
                  <option value="">Any work mode</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
                <select value={form.preferredEmploymentType} onChange={set('preferredEmploymentType')} aria-label="Preferred employment type" className={inputClass}>
                  <option value="">Any type</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
              <input type="number" min="0" max="50" step="0.5" value={form.experienceYears} onChange={set('experienceYears')} placeholder="Years of experience (0 for fresher)" aria-label="Years of experience" className={inputClass} />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-charcoal">
                <input type="checkbox" checked={form.isReferrer} onChange={set('isReferrer')} className="w-4 h-4 accent-emerald-800" />
                I’m open to giving referrals
              </label>
              <div className="grid gap-3 mt-3">
                <input type="text" value={form.currentCompany} onChange={set('currentCompany')} placeholder="Current company" aria-label="Current company" className={inputClass} />
                <input type="text" value={form.currentCompanyRole} onChange={set('currentCompanyRole')} placeholder="Your role at the company" aria-label="Your role at the company" className={inputClass} />
              </div>
              {form.isReferrer && (
                <div className="mt-3">
                  <label htmlFor="ref-companies" className="text-sm font-medium text-charcoal">Companies you can refer at</label>
                  <p className="text-xs text-gray-500 mb-2">Self-reported: CareerNest does not verify employment. If you add none, your current company is used. Your profile never shows your email, but resume text attached to requests is shared as-is and may contain contact details; recipients can read it while a request is pending, accepted or referred, not once declined or withdrawn.</p>
                  {form.referralCompanies.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5 mb-2">
                      {form.referralCompanies.map((c) => (
                        <li key={c} className="inline-flex items-center gap-1 text-xs pl-2.5 pr-1 py-1 rounded-full bg-mint text-primary font-medium">
                          {c}
                          <button type="button" onClick={() => removeCompany(c)} aria-label={`Remove ${c}`} className="focus-ring w-5 h-5 rounded-full hover:bg-sage/40 leading-none">&times;</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <input
                      id="ref-companies"
                      type="text"
                      value={companyDraft}
                      maxLength={80}
                      onChange={(e) => setCompanyDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCompany(companyDraft); } }}
                      placeholder={form.referralCompanies.length >= 10 ? 'Maximum 10 companies' : 'Type a company and press Enter'}
                      disabled={form.referralCompanies.length >= 10}
                      className={inputClass}
                    />
                    <button type="button" onClick={() => addCompany(companyDraft)} disabled={!companyDraft.trim() || form.referralCompanies.length >= 10} className="focus-ring shrink-0 px-4 rounded-lg border border-primary text-primary text-sm hover:bg-mint disabled:opacity-40">Add</button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 grid gap-3">
              <p className="text-sm font-medium text-charcoal">Change password (optional)</p>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className={inputClass} autoComplete="current-password" />
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 6 characters)" className={inputClass} autoComplete="new-password" />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-white py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Profile;
