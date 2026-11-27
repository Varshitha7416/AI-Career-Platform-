// Career-role taxonomy: a small curated list powering the searchable role selector (GET /auth/roles?q=).
// Custom roles are always allowed; the taxonomy is only a suggestion list. Keys are lower-cased, whitespace-collapsed.
const ROLES = [
  ['Frontend Developer', ['front end', 'react developer', 'ui developer', 'web developer']],
  ['Backend Developer', ['back end', 'node developer', 'api developer', 'server side']],
  ['Full Stack Developer', ['fullstack', 'full-stack', 'mern', 'web developer']],
  ['Software Engineer', ['sde', 'software developer', 'programmer']],
  ['Senior Software Engineer', ['sde 2', 'sde ii', 'senior developer']],
  ['Mobile App Developer', ['android developer', 'ios developer', 'flutter', 'react native']],
  ['DevOps Engineer', ['sre', 'site reliability', 'infrastructure', 'platform engineer']],
  ['Cloud Engineer', ['aws', 'azure', 'gcp', 'cloud architect']],
  ['Data Analyst', ['business analyst', 'analytics', 'bi analyst']],
  ['Data Scientist', ['ml scientist', 'statistician']],
  ['Data Engineer', ['etl', 'big data', 'pipeline engineer']],
  ['Machine Learning Engineer', ['ml engineer', 'ai engineer', 'deep learning']],
  ['AI Engineer', ['llm', 'generative ai', 'prompt engineer']],
  ['Business Analyst', ['ba', 'systems analyst']],
  ['Product Manager', ['pm', 'product owner']],
  ['Project Manager', ['program manager', 'scrum master', 'delivery manager']],
  ['Engineering Manager', ['tech lead', 'team lead', 'development manager']],
  ['UI/UX Designer', ['ux designer', 'ui designer', 'product designer', 'interaction designer']],
  ['Graphic Designer', ['visual designer', 'creative designer']],
  ['QA Engineer', ['tester', 'quality assurance', 'test engineer', 'sdet']],
  ['Automation Test Engineer', ['selenium', 'automation tester']],
  ['Cybersecurity Analyst', ['security engineer', 'infosec', 'soc analyst']],
  ['Database Administrator', ['dba', 'sql developer']],
  ['Network Engineer', ['network administrator', 'systems administrator']],
  ['Embedded Systems Engineer', ['firmware', 'iot engineer']],
  ['Digital Marketing Specialist', ['seo', 'performance marketing', 'social media manager']],
  ['Content Writer', ['copywriter', 'technical writer', 'content strategist']],
  ['Sales Executive', ['business development', 'account executive', 'sales representative']],
  ['Customer Success Manager', ['customer support', 'client success']],
  ['HR Executive', ['recruiter', 'talent acquisition', 'human resources']],
  ['Financial Analyst', ['finance executive', 'investment analyst']],
  ['Accountant', ['accounts executive', 'chartered accountant', 'auditor']],
  ['Operations Manager', ['operations executive', 'supply chain', 'logistics']],
  ['Mechanical Engineer', ['design engineer', 'cad engineer']],
  ['Electrical Engineer', ['electronics engineer']],
  ['Civil Engineer', ['site engineer', 'structural engineer']],
  ['Teacher', ['lecturer', 'tutor', 'trainer']],
  ['Healthcare Professional', ['nurse', 'medical officer', 'pharmacist']],
  ['Game Developer', ['unity developer', 'unreal developer']],
  ['Blockchain Developer', ['web3', 'solidity']],
  ['Technical Support Engineer', ['it support', 'help desk', 'support engineer']],
  ['Research Associate', ['research analyst', 'research scientist']],
].map(([role, aliases]) => ({ role, aliases, key: role.toLowerCase(), hay: [role, ...aliases].join(' | ').toLowerCase() }));

const ROLE_MAX = 80;

// Normalised comparison key: trimmed, lower-cased, inner whitespace collapsed.
const roleKey = (role) => String(role || '').trim().replace(/\s+/g, ' ').toLowerCase();
const cleanRole = (role) => String(role || '').trim().replace(/\s+/g, ' ');

// Up to `limit` role names whose name or alias matches every word of q (name matches first). No q -> the first roles.
const searchRoles = (q, limit = 15) => {
  const words = roleKey(q).split(' ').filter(Boolean);
  if (!words.length) return ROLES.slice(0, limit).map((r) => r.role);
  const hits = ROLES.filter((r) => words.every((w) => r.hay.includes(w)));
  hits.sort((a, b) => Number(b.key.includes(words.join(' '))) - Number(a.key.includes(words.join(' '))) || Number(words.every((w) => b.key.includes(w))) - Number(words.every((w) => a.key.includes(w))));
  return hits.slice(0, limit).map((r) => r.role);
};

// The user's CURRENT interests, derived on read (no migration): the stored list if there is one, otherwise a single
// interest taken from the legacy `seekingRole`. primaryRole is the stored one when it is still an interest, else the first.
const effectiveInterests = (user) => {
  const stored = Array.isArray(user && user.careerInterests) ? user.careerInterests.filter((i) => i && i.role) : [];
  let interests = stored.map((i) => ({ role: i.role, roleKey: i.roleKey || roleKey(i.role) }));
  if (!interests.length && user && typeof user.seekingRole === 'string' && cleanRole(user.seekingRole)) {
    const role = cleanRole(user.seekingRole).slice(0, ROLE_MAX);
    interests = [{ role, roleKey: roleKey(role) }];
  }
  const primary = interests.find((i) => user && user.primaryRole && i.roleKey === roleKey(user.primaryRole)) || interests[0] || null;
  return { interests, primaryRole: primary ? primary.role : '', primaryKey: primary ? primary.roleKey : '' };
};

module.exports = { ROLES, ROLE_MAX, roleKey, cleanRole, searchRoles, effectiveInterests };
