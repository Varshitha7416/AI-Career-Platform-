// Deterministic classification + scoring (v2). Pure functions: no AI, no DB.
const { findSkillInText, snippetFor, textHasSkill } = require('../ai/skillSynonyms');
const { evidenceVerified, normText } = require('../ai/common');
const { weightOf } = require('./requirements');

const SCORE_METHOD = 'v2';
const LEVEL_FACTOR = { beginner: 0.6, intermediate: 0.85, advanced: 1.0 };
const NO_LEVEL_FACTOR = 0.8;
const PARTIAL_FACTOR = 0.5; // resume mode: skill is declared / mentioned but practical use is not shown

// ---------------------------------------------------------------------------------------------------------------
// Resume classification (resume mode only; manual entries never go through this).
//   matched  = the skill appears in a USAGE line: a project / work / achievement sentence that shows it being used.
//   partial  = the skill is only DECLARED (skills list or skills section) or merely mentioned without practical use.
//   missing  = the skill does not appear in the resume.
// Every quote is a real slice of the resume and is verified against it. The AI has no say in any of this.
// ---------------------------------------------------------------------------------------------------------------
const SKILLS_HEADER = /^(?:technical\s+|key\s+|core\s+|professional\s+|relevant\s+)?(?:skills?|competenc(?:y|ies)|expertise|technologies|tech\s*stack|tools?(?:\s*(?:&|and)\s*technologies)?|skills?\s*(?:&|and)\s*tools?)\s*:?$/i;
const OTHER_HEADER = /^(?:work\s+|professional\s+|relevant\s+|internship\s+)?(?:experience|employment(?:\s+history)?|projects?|academic\s+projects?|personal\s+projects?|education|summary|profile|objective|achievements?|certifications?|internships?|awards|publications|volunteering|references|training)\s*:?$/i;
const USAGE_SECTION = /^(?:work\s+|professional\s+|relevant\s+|internship\s+)?(?:experience|employment(?:\s+history)?|projects?|academic\s+projects?|personal\s+projects?|internships?|achievements?)\s*:?$/i;
const INLINE_SKILL_LABEL = /^[-*•\s]*(?:technical\s+|key\s+)?(?:skills?|technologies|languages|frameworks|libraries|databases|tools|tech\s*stack|competenc(?:y|ies))\s*[:\-–]/i;
const STACK_LABEL = /^[-*•\s]*(?:tech(?:nologies)?(?:\s+used)?|stack|environment|tools(?:\s+used)?)\s*:/i;
const ACTION_VERB = /\b(?:built|build|building|developed?|developing|designed?|designing|implemented?|implementing|created?|creating|used|using|deployed?|deploying|wrote|written|writing|led|leading|managed?|managing|maintained?|maintaining|optimi[sz]ed?|integrated?|integrating|automated?|automating|tested|testing|migrated?|configured?|configuring|analy[sz]ed?|analy[sz]ing|delivered?|launched?|architected|engineered|supported|contributed|improved?|reduced?|increased?|collaborated|shipped|refactored|debugged|set\s+up|worked\s+(?:on|with)|responsible\s+for|experience\s+(?:in|with)|containeri[sz]ed|trained|visuali[sz]ed|queried|scraped|presented|mentored|coordinated|resolved|handled|produced|published|researched|prototyped|administered|monitored)\b/i;

const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const separators = (s) => (s.match(/[,;|•·]/g) || []).length;
const stripBullet = (s) => String(s || '').replace(/^[-*•·]\s+/, '').trim();

// Splits the resume into lines tagged with the kind of section they sit in.
const tagLines = (text) => {
  let section = 'other'; // 'skills' | 'usage' | 'other'
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bare = line.replace(/[*_#]+/g, '').trim();
    if (bare.length <= 45 && SKILLS_HEADER.test(bare)) { section = 'skills'; continue; }
    if (bare.length <= 45 && OTHER_HEADER.test(bare)) { section = USAGE_SECTION.test(bare) ? 'usage' : 'other'; continue; }
    out.push({ line, section });
  }
  return out;
};

// kind of one line for a skill mention: 'usage' (shows practical use) | 'declared' (skills list / section / label) | 'mention'
const lineKind = ({ line, section }) => {
  const verb = ACTION_VERB.test(line);
  const words = wordCount(line);
  const declaredLabel = INLINE_SKILL_LABEL.test(line);
  if (STACK_LABEL.test(line) && section === 'usage') return 'usage'; // "Tech used: Node.js, Express" under a job/project
  if (declaredLabel) return 'declared';
  const listLike = separators(line) >= 2 && !/[.!?]\s*$/.test(line) && !(verb && words >= 8);
  if (listLike) return 'declared';
  if (verb && words >= 5) return 'usage';
  if (section === 'skills') return 'declared';
  if (section === 'usage' && words >= 6) return 'usage';
  return 'mention';
};

const quoteOf = (line, skill) => stripBullet(snippetFor(line, skill) || line).slice(0, 160);

const classifyResume = (requirements, resumeText) => {
  const text = String(resumeText || '');
  const pre = normText(text);
  const lines = tagLines(text);
  return requirements.map((req) => {
    const hits = lines.filter((l) => textHasSkill(l.line, req.skill)).map((l) => ({ l, kind: lineKind(l) }));
    const whole = hits.length ? null : findSkillInText(text, req.skill); // ambiguous names that need cross-line context
    if (!hits.length && !whole) return { req, status: 'missing' };

    const verified = (q) => (q && evidenceVerified(q, text, pre) ? q : null);
    const usage = hits.find((h) => h.kind === 'usage');
    if (usage) {
      const ev = verified(quoteOf(usage.l.line, req.skill)) || verified(stripBullet(usage.l.line).slice(0, 160));
      if (ev) return { req, status: 'matched', evidence: ev, mention: 'usage' };
    }
    const declaredHit = hits.find((h) => h.kind === 'declared') || hits[0];
    const ev = declaredHit
      ? (verified(quoteOf(declaredHit.l.line, req.skill)) || verified(stripBullet(declaredHit.l.line).slice(0, 160)))
      : (verified(snippetFor(text, req.skill)) || verified(whole.alias));
    if (!ev) return { req, status: 'missing' };
    return { req, status: 'partial', evidence: ev, mention: declaredHit && declaredHit.kind === 'declared' ? 'skills-list' : 'mention' };
  });
};

// Manual mode: a requirement is matched when the user listed the same canonical skill. Level only if the user chose one.
const classifyManual = (requirements, manualSkills) => {
  const byKey = new Map(manualSkills.map((s) => [s.key, s]));
  return requirements.map((req) => {
    const m = byKey.get(req.key);
    return m ? { req, status: 'matched', level: m.level } : { req, status: 'missing' };
  });
};

const coverage = (item, mode) => {
  if (item.status === 'missing') return 0;
  if (mode === 'resume') return item.status === 'matched' ? 1 : PARTIAL_FACTOR;
  if (item.status !== 'matched') return 0; // partial is not used in manual mode
  return item.level ? LEVEL_FACTOR[item.level] : NO_LEVEL_FACTOR;
};

const pct = (num, den) => (den > 0 ? Math.round((100 * num) / den) : null);

// score = round(100 * sum(w*c) / sum(w)); requiredCoverage / preferredCoverage weighted the same way (null if none).
const computeScore = (items, mode) => {
  let num = 0; let den = 0; let rNum = 0; let rDen = 0; let pNum = 0; let pDen = 0;
  const counts = { required: 0, preferred: 0, matched: 0, partial: 0, missing: 0 };
  for (const it of items) {
    const w = weightOf(it.req);
    const c = coverage(it, mode);
    num += w * c; den += w;
    if (it.req.kind === 'required') { rNum += w * c; rDen += w; counts.required += 1; }
    if (it.req.kind === 'preferred') { pNum += w * c; pDen += w; counts.preferred += 1; }
    counts[it.status] += 1;
  }
  return {
    value: pct(num, den) === null ? 0 : pct(num, den),
    method: SCORE_METHOD,
    requiredCoverage: pct(rNum, rDen),
    preferredCoverage: pct(pNum, pDen),
    counts,
  };
};

module.exports = { SCORE_METHOD, LEVEL_FACTOR, NO_LEVEL_FACTOR, PARTIAL_FACTOR, lineKind, tagLines, classifyResume, classifyManual, coverage, computeScore };
