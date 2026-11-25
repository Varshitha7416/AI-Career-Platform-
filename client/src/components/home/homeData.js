// Static content for the Home page. Every `to` is an existing route in App.jsx.
export const SHORTCUTS = [
  { key: 'jobs', name: 'Job Discovery', hint: 'Find jobs that match your goals', to: '/jobs' },
  { key: 'dashboard', name: 'Dashboard', hint: 'Track your progress & applications', to: '/dashboard' },
  { key: 'resume', name: 'Resume Analyzer', hint: 'Get AI-powered resume feedback', to: '/resume' },
  { key: 'letter', name: 'Cover Letter Generator', hint: 'Create personalised cover letters', to: '/cover-letter' },
  { key: 'referrals', name: 'Referrals', hint: 'Find referral opportunities', to: '/referrals' },
];

export const MORE_LINKS = [
  { name: 'Saved Jobs', to: '/saved-jobs' },
  { name: 'Applications', to: '/applications' },
  { name: 'Interviews', to: '/interviews' },
  { name: 'Career Programs', to: '/programs' },
  { name: 'Settings', to: '/settings' },
];

export const FEATURES = [
  { key: 'jobs', name: 'Job Discovery', to: '/jobs', art: 'jobs', desc: 'Search, filter and save jobs, with recommendations based on your profile and resume.' },
  { key: 'dashboard', name: 'Dashboard', to: '/dashboard', art: 'dashboard', desc: 'See your applications, interviews, activity and career progress in one place.' },
  { key: 'resume', name: 'Resume Analyzer', to: '/resume', art: 'resume', ai: true, desc: 'Get AI feedback on your resume, in general or matched to a specific job.' },
  { key: 'letter', name: 'Cover Letter Generator', to: '/cover-letter', art: 'letter', ai: true, desc: 'Generate a cover letter from your resume and a job, then edit and export it.' },
  { key: 'referrals', name: 'Referrals', to: '/referrals', art: 'people', desc: 'Find employees at a company who may refer you, or manage requests you receive.' },
  { key: 'saved', name: 'Saved Jobs', to: '/saved-jobs', desc: 'Keep the jobs you like in one list and come back when you are ready to apply.' },
  { key: 'applications', name: 'Application Tracker', to: '/applications', desc: 'Record each application and follow its status from applied to offer.' },
  { key: 'interviews', name: 'Interviews', to: '/interviews', desc: 'Schedule interviews against your applications and see what is coming up.' },
  { key: 'programs', name: 'Career Programs', to: '/programs', desc: 'Browse curated learning programs and track the ones you save or start.' },
  { key: 'profile', name: 'Profile', to: '/profile', desc: 'Keep your details, target roles and resumes current so suggestions fit you.' },
];

export const WHY = [
  { key: 'ai', title: 'Powered by AI', text: 'AI feedback on your resume and tailored cover letters, based on your own resume.' },
  { key: 'all', title: 'All-in-One Platform', text: 'Jobs, applications, interviews, resume, cover letters and referrals in one place.' },
  { key: 'everyone', title: 'Built for Everyone', text: 'Whether you are a fresher or experienced, filter jobs to fit your level.' },
  { key: 'growth', title: 'Focused on Your Growth', text: 'Follow your progress and explore programs, not just the next application.' },
];

// Interests: new multi-role fields when the API provides them, else the single legacy target role.
export function interestsOf(me, stored) {
  const src = me || stored || {};
  const list = Array.isArray(src.careerInterests) ? src.careerInterests.map((i) => i?.role).filter(Boolean) : [];
  const primary = src.primaryRole || (list.length ? list[0] : '') || src.seekingRole || '';
  if (list.length) return { roles: list, primary };
  return { roles: src.seekingRole ? [src.seekingRole] : [], primary };
}

