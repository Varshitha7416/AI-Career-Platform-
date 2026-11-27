// Rule-based (NOT AI) job recommendation engine. Pure functions: no DB access, no caching, so every request reflects
// the user's current roles, resumes, skills and preferences.
//
// Per-role scoring (max 100): target role vs job title (40), skills from the role's resume or profile skills vs job
// skills (up to 40), experience fit (10), preferred city (10), work mode (5), employment type (5).
const { escapeRegex } = require('../middleware/validate');

const STOP = new Set(['and', 'or', 'the', 'a', 'an', 'of', 'for', 'in', 'at', 'to', 'with', 'senior', 'junior', 'lead']);
const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1 && !STOP.has(w));

const containsSkill = (text, skill) => {
  const esc = escapeRegex(String(skill).toLowerCase());
  return new RegExp(`(^|[^a-z0-9+#.])${esc}($|[^a-z0-9+#])`).test(text);
};

const cap = (s) => `${s[0].toUpperCase()}${s.slice(1)}`;

/**
 * Scores one job. `signals`:
 *   roleWords: string[]               words of the role being matched ([] = no role signal)
 *   skillSource: { kind:'resume', text, label } | { kind:'profile', skills:[string] } | null
 *   user: preferences/experience of the user
 * Returns { score, reasons, titleHit, skillHit }.
 */
const scoreJob = (job, { roleWords = [], skillSource = null, user = {} }) => {
  let score = 0;
  const reasons = [];
  let titleHit = false;
  let skillHit = false;

  if (roleWords.length) {
    const titleWords = new Set(words(job.title));
    const hits = roleWords.filter((w) => titleWords.has(w)).length;
    if (hits) {
      titleHit = true;
      score += Math.round((hits / roleWords.length) * 40);
      reasons.push(hits === roleWords.length ? 'Job title matches your target role' : 'Job title partly matches your target role');
    }
  }
  if (skillSource && job.skills?.length) {
    const found = skillSource.kind === 'resume'
      ? job.skills.filter((s) => containsSkill(skillSource.text, s))
      : job.skills.filter((s) => skillSource.skills.some((k) => k.toLowerCase() === String(s).toLowerCase()));
    if (found.length) {
      skillHit = true;
      score += Math.min(found.length, 5) * 8;
      reasons.push(skillSource.kind === 'resume'
        ? `Skills found in ${skillSource.label}: ${found.slice(0, 4).join(', ')}`
        : `Skills from your profile match: ${found.slice(0, 4).join(', ')}`);
    }
  }
  const years = user.experienceYears;
  if (years !== undefined && years !== null && job.experienceMinYears !== undefined) {
    if (years >= job.experienceMinYears && years <= (job.experienceMaxYears ?? 99)) {
      score += 10;
      reasons.push(`Fits your ${years} year${years === 1 ? '' : 's'} of experience`);
    } else if (Math.abs(years - job.experienceMinYears) <= 1 || Math.abs(years - (job.experienceMaxYears ?? years)) <= 1) {
      score += 5;
      reasons.push('Close to your experience level');
    }
  }
  if (user.preferredLocation && job.city && job.city.toLowerCase().includes(user.preferredLocation.toLowerCase())) {
    score += 10;
    reasons.push(`Located in ${job.city}`);
  }
  if (user.preferredWorkMode && job.workMode === user.preferredWorkMode) {
    score += 5;
    reasons.push(`${cap(job.workMode)} work, as you prefer`);
  }
  if (user.preferredEmploymentType && job.employmentType === user.preferredEmploymentType) {
    score += 5;
    reasons.push(`${job.employmentType} role, as you prefer`);
  }
  return { score: Math.min(score, 100), reasons, titleHit, skillHit };
};

const byScore = (a, b) => b.matchScore - a.matchScore || new Date(b.postedAt || b.createdAt || 0) - new Date(a.postedAt || a.createdAt || 0);

/**
 * Decides which resume / skills back a career interest. Never reuses an unrelated resume silently: a role without its
 * own resume falls back to the DEFAULT resume and says so (source 'default-fallback'); with no resume at all it uses
 * the profile skills, else only the role title.
 *   resumes: [{_id,name,isDefault,targetRoleKey,resumeText,createdAt}]
 */
const pickBasis = (interest, resumes, profileSkills) => {
  const own = resumes.filter((r) => r.targetRoleKey && r.targetRoleKey === interest.roleKey).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const def = resumes.find((r) => r.isDefault) || [...resumes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const asRef = (r, source) => ({ _id: r._id, name: r.name || r.fileName || 'Resume', source });
  if (own) return { basis: 'role-resume', resume: asRef(own, 'role'), source: { kind: 'resume', text: String(own.resumeText || '').toLowerCase(), label: `your "${own.name || own.fileName || 'role'}" resume` } };
  if (def) return { basis: 'default-resume', resume: asRef(def, 'default-fallback'), source: { kind: 'resume', text: String(def.resumeText || '').toLowerCase(), label: `your default resume "${def.name || def.fileName || 'resume'}"` } };
  if (profileSkills.length) return { basis: 'profile-skills', resume: null, source: { kind: 'profile', skills: profileSkills } };
  return { basis: 'role-only', resume: null, source: null };
};

/**
 * Builds the recommendation payload.
 *   input: { user (lean, with effective `interests` & `primaryKey`), interests, primaryKey, resumes, candidates, limit }
 */
const buildRecommendations = ({ user, interests, primaryKey, resumes, candidates, limit }) => {
  const profileSkills = (Array.isArray(user.skills) ? user.skills : []).map((s) => s && s.name).filter(Boolean);
  const context = {
    interestCount: interests.length,
    resumeCount: resumes.length,
    roleResumeCount: resumes.filter((r) => r.targetRoleKey && interests.some((i) => i.roleKey === r.targetRoleKey)).length,
    profileSkillCount: profileSkills.length,
  };
  const hasPrefs = Boolean(user.preferredLocation || user.preferredWorkMode || user.preferredEmploymentType || (user.experienceYears !== undefined && user.experienceYears !== null));
  const latest = () => [...candidates].sort((a, b) => new Date(b.postedAt || b.createdAt) - new Date(a.postedAt || a.createdAt)).slice(0, limit);
  const latestResponse = (message) => ({ personalized: false, basis: 'latest', message, context, groups: [], jobs: latest() });

  if (!interests.length && !resumes.length && !profileSkills.length && !hasPrefs) {
    return latestResponse('Showing the latest jobs. Add a target role and preferences in your Profile, or upload a resume, to get matched recommendations.');
  }

  const groups = [];
  const merged = new Map(); // job id -> best scored copy

  const run = (interest) => {
    const picked = pickBasis(interest || { roleKey: '' }, resumes, profileSkills);
    const roleWords = interest ? words(interest.role) : [];
    const scored = [];
    for (const job of candidates) {
      const r = scoreJob(job, { roleWords, skillSource: picked.source, user });
      // With a role (or a skills source) require a real role/skill signal; preferences alone do not make a match.
      const relevant = interest || picked.source ? (r.titleHit || r.skillHit) : r.reasons.length > 0;
      if (!relevant) continue;
      scored.push({
        ...job,
        matchScore: r.score,
        matchReasons: r.reasons,
        matchedRole: interest ? interest.role : null,
        matchedResume: picked.resume,
      });
    }
    scored.sort(byScore);
    return { picked, scored };
  };

  for (const interest of interests) {
    const { picked, scored } = run(interest);
    groups.push({
      role: interest.role,
      roleKey: interest.roleKey,
      isPrimary: interest.roleKey === primaryKey,
      resume: picked.resume,
      basis: picked.basis,
      jobs: scored.slice(0, limit),
    });
    for (const j of scored) {
      const prev = merged.get(String(j._id));
      if (!prev || j.matchScore > prev.matchScore) merged.set(String(j._id), j);
    }
  }
  if (!interests.length) {
    // No career interests: resume text / profile skills / preferences still drive a single list (no groups).
    const { scored } = run(null);
    for (const j of scored) merged.set(String(j._id), j);
  }

  const jobs = [...merged.values()].sort(byScore).slice(0, limit);
  if (!jobs.length) {
    const r = latestResponse('No close matches for your current profile yet, so these are the latest jobs.');
    r.groups = groups;
    return r;
  }
  return {
    personalized: true,
    basis: 'profile',
    signals: { targetRole: interests.length > 0, resumeSkills: resumes.length > 0, preferences: hasPrefs },
    message: 'Matched using your career interests, resume skills and preferences (simple rule-based matching, not AI).',
    context,
    groups,
    jobs,
  };
};

module.exports = { words, containsSkill, scoreJob, pickBasis, buildRecommendations };
