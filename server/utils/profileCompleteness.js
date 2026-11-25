const { effectiveInterests } = require('./roles');

// Single source of truth for "Profile Complete %". Weights add up to 100.
const PARTS = [
  { key: 'name', weight: 10, label: 'Add your name', link: '/profile', has: (u) => typeof u.name === 'string' && u.name.trim().length >= 2 },
  { key: 'seekingRole', weight: 15, label: 'Add your target role', link: '/profile', has: (u) => effectiveInterests(u).interests.length > 0 },
  { key: 'experienceYears', weight: 10, label: 'Add your years of experience', link: '/profile', has: (u) => u.experienceYears !== undefined && u.experienceYears !== null },
  { key: 'preferredLocation', weight: 10, label: 'Add your preferred city', link: '/profile', has: (u) => Boolean(u.preferredLocation && u.preferredLocation.trim()) },
  { key: 'preferredWorkMode', weight: 10, label: 'Choose a preferred work mode', link: '/profile', has: (u) => Boolean(u.preferredWorkMode) },
  { key: 'preferredEmploymentType', weight: 10, label: 'Choose a preferred employment type', link: '/profile', has: (u) => Boolean(u.preferredEmploymentType) },
  { key: 'resume', weight: 35, label: 'Upload your resume', link: '/resume', has: (u, resumeCount) => resumeCount > 0 },
];

function computeProfileCompleteness(user, resumeCount = 0) {
  let percent = 0;
  const missing = [];
  for (const p of PARTS) {
    if (p.has(user || {}, resumeCount)) percent += p.weight;
    else missing.push({ key: p.key, label: p.label, link: p.link });
  }
  return { percent, missing };
}

module.exports = { computeProfileCompleteness, PARTS };
