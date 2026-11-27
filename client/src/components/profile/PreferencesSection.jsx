import { useState } from 'react';
import { SettingsIcon, UsersIcon } from '../Icons';
import { SectionCard, TextField, SelectField, TagInput } from './ui';
import { useSectionForm } from './formKit';

const prefDraft = (u) => ({ preferredLocation: u.preferredLocation || '', preferredWorkMode: u.preferredWorkMode || '', preferredEmploymentType: u.preferredEmploymentType || '' });

export function JobPreferences({ user, onSaved }) {
  const form = useSectionForm(user, prefDraft, (d) => d, onSaved);
  const { draft, errors, set } = form;
  return (
    <SectionCard id="preferences" icon={SettingsIcon} title="Job Preferences" subtitle="Used to match Recommended Jobs (simple rule-based matching, not AI). All optional." form={form}>
      <div className="grid sm:grid-cols-3 gap-4">
        <TextField label="Preferred city" value={draft.preferredLocation} onChange={(v) => set({ preferredLocation: v })} error={errors.preferredLocation} placeholder="e.g. Bengaluru" maxLength={100} />
        <SelectField label="Work mode" value={draft.preferredWorkMode} onChange={(v) => set({ preferredWorkMode: v })} error={errors.preferredWorkMode}>
          <option value="">Any work mode</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </SelectField>
        <SelectField label="Employment type" value={draft.preferredEmploymentType} onChange={(v) => set({ preferredEmploymentType: v })} error={errors.preferredEmploymentType}>
          <option value="">Any type</option>
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="internship">Internship</option>
        </SelectField>
      </div>
    </SectionCard>
  );
}

const refDraft = (u) => ({
  isReferrer: Boolean(u.isReferrer),
  currentCompany: u.currentCompany || '',
  currentCompanyRole: u.currentCompanyRole || '',
  referralCompanies: (u.referralCompanies || []).map((name) => ({ name })),
});
const refPayload = (d) => ({ isReferrer: d.isReferrer, currentCompany: d.currentCompany, currentCompanyRole: d.currentCompanyRole, referralCompanies: d.referralCompanies.map((c) => c.name) });

export function ReferralOptIn({ user, onSaved }) {
  const form = useSectionForm(user, refDraft, refPayload, onSaved);
  const { draft, errors, set } = form;
  const [localError, setLocalError] = useState('');
  const save = () => {
    if (draft.isReferrer && !draft.currentCompany.trim() && draft.referralCompanies.length === 0) {
      setLocalError('Add your current company or at least one company you can refer at.');
      return null;
    }
    setLocalError('');
    return form.save();
  };
  const wrapped = { ...form, save, status: localError ? { type: 'error', text: localError } : form.status };
  return (
    <SectionCard id="referral-settings" icon={UsersIcon} title="Referrals" subtitle="Let job seekers ask you for referrals at your company." form={wrapped}>
      <label className="flex items-center gap-3 text-sm font-medium text-ink min-h-10">
        <input type="checkbox" checked={draft.isReferrer} onChange={(e) => { set({ isReferrer: e.target.checked }); setLocalError(''); }} className="w-5 h-5 accent-emerald-800" />
        I am open to giving referrals
      </label>
      <div className="grid sm:grid-cols-2 gap-4 mt-3">
        <TextField label="Current company" value={draft.currentCompany} onChange={(v) => set({ currentCompany: v })} error={errors.currentCompany} maxLength={100} placeholder="e.g. Acme Corp" />
        <TextField label="Your role at the company" value={draft.currentCompanyRole} onChange={(v) => set({ currentCompanyRole: v })} error={errors.currentCompanyRole} maxLength={100} placeholder="e.g. Software Engineer" />
      </div>
      {draft.isReferrer && (
        <div className="mt-4">
          <TagInput label="Companies you can refer at" items={draft.referralCompanies} onChange={(referralCompanies) => set({ referralCompanies })} max={10} maxLen={80} placeholder="Type a company and press Enter" error={errors.referralCompanies} hint="Self-reported: CareerNest does not verify employment. If you add none, your current company is used." />
          <p className="text-xs text-ink/55 mt-3">Your profile never shows your email, but resume text attached to requests is shared as-is and may contain contact details. Recipients can read it while a request is pending, accepted or referred, not once declined or withdrawn.</p>
        </div>
      )}
    </SectionCard>
  );
}
