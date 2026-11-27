import { UserIcon } from '../Icons';
import { SectionCard, TextField, Field } from './ui';
import { inputClass, useSectionForm } from './formKit';

const toDraft = (u) => ({ phone: u.phone || '', location: u.location || '', headline: u.headline || '', bio: u.bio || '', linkedinUrl: u.linkedinUrl || '', githubUrl: u.githubUrl || '', portfolioUrl: u.portfolioUrl || '' });

function PersonalSection({ user, onSaved }) {
  const form = useSectionForm(user, toDraft, (d) => d, onSaved);
  const { draft, errors, set } = form;
  return (
    <SectionCard id="personal" icon={UserIcon} title="Personal Details" subtitle="How you appear on CareerNest. Everything here is optional." form={form}>
      <div className="grid sm:grid-cols-2 gap-4">
        <TextField label="Phone number" type="tel" value={draft.phone} onChange={(v) => set({ phone: v })} error={errors.phone} placeholder="+91 98765 43210" maxLength={20} autoComplete="tel" />
        <TextField label="Location" value={draft.location} onChange={(v) => set({ location: v })} error={errors.location} placeholder="City, Country" maxLength={100} autoComplete="address-level2" />
        <div className="sm:col-span-2">
          <TextField label="Headline" value={draft.headline} onChange={(v) => set({ headline: v })} error={errors.headline} placeholder="e.g. Full Stack Developer who loves clean UIs" maxLength={120} />
        </div>
        <div className="sm:col-span-2">
          <Field label="About you" htmlFor="profile-bio" error={errors.bio} hint={`${draft.bio.length}/600`}>
            <textarea id="profile-bio" rows={4} value={draft.bio} maxLength={600} onChange={(e) => set({ bio: e.target.value })} className={`${inputClass} resize-y`} placeholder="A few lines about your background and goals" />
          </Field>
        </div>
        <TextField label="LinkedIn" type="url" value={draft.linkedinUrl} onChange={(v) => set({ linkedinUrl: v })} error={errors.linkedinUrl} placeholder="https://linkedin.com/in/..." />
        <TextField label="GitHub" type="url" value={draft.githubUrl} onChange={(v) => set({ githubUrl: v })} error={errors.githubUrl} placeholder="https://github.com/..." />
        <div className="sm:col-span-2">
          <TextField label="Portfolio / website" type="url" value={draft.portfolioUrl} onChange={(v) => set({ portfolioUrl: v })} error={errors.portfolioUrl} placeholder="https://" />
        </div>
      </div>
    </SectionCard>
  );
}

export default PersonalSection;
