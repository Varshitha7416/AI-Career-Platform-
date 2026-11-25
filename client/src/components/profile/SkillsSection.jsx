import { TagIcon } from '../Icons';
import { SectionCard, TagInput } from './ui';
import { useSectionForm } from './formKit';

const toDraft = (u) => ({ skills: (u.skills || []).map((s) => ({ ...s })), domains: (u.domains || []).map((name) => ({ name })) });
const toPayload = (d) => ({ skills: d.skills, domains: d.domains.map((x) => x.name) });

const SKILL_IDEAS = ['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'Java', 'Communication', 'Figma'];
const DOMAIN_IDEAS = ['Fintech', 'Healthcare', 'E-commerce', 'EdTech', 'SaaS', 'Gaming'];

function SkillsSection({ user, onSaved }) {
  const form = useSectionForm(user, toDraft, toPayload, onSaved);
  return (
    <SectionCard id="skills" icon={TagIcon} title="Skills & Domain" subtitle="Skills are used for job matching when a role has no resume of its own." form={form}>
      <div className="grid gap-5">
        <TagInput label="Skills" items={form.draft.skills} onChange={(skills) => form.set({ skills })} max={40} maxLen={40} placeholder="Type a skill and press Enter" suggestions={SKILL_IDEAS} error={form.errors.skills} hint="Up to 40 skills." />
        <TagInput label="Domains you work in" items={form.draft.domains} onChange={(domains) => form.set({ domains })} max={10} maxLen={50} placeholder="e.g. Fintech" suggestions={DOMAIN_IDEAS} error={form.errors.domains} hint="Up to 10 domains." />
      </div>
    </SectionCard>
  );
}

export default SkillsSection;
