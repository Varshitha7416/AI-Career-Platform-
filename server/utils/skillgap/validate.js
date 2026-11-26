// Strict validation of the AI output. The AI can only: add role-relevant requirements, reclassify a skill to
// "partial" (with verified resume evidence), and add explanatory text. It can never supply a percentage, upgrade a
// missing skill to matched, or contradict the resume / manual input.
const { aiError } = require('../../config/gemini');
const { str, oneOf, arr, normText, evidenceVerified } = require('../ai/common');
const { canonicalKey, canonicalName, findSkillInText } = require('../ai/skillSynonyms');
const { MAX_AI_ADDED, MIN_EXPLICIT } = require('./requirements');

const KINDS = ['required', 'preferred', 'recommended'];
const IMPORTANCE = ['high', 'medium', 'low'];
const MAX_JOB_TEXT_ADDED = 8;

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} +#./&()'-]*$/u;
const plausibleSkillName = (name) => {
  if (!name || name.length > 60 || !NAME_RE.test(name)) return false;
  if (name.split(' ').length > 6) return false;
  if (/https?:|www\.|ignore|instruction|system prompt|previous/i.test(name)) return false;
  return true;
};

// Drops sentences that state a percentage (the AI may not invent one).
const stripPercentSentences = (text) => {
  const parts = String(text || '').split(/(?<=[.!?])\s+/);
  return parts.filter((s) => !/\d\s*%|\d+\s*\/\s*100|\bpercent\b/i.test(s)).join(' ').trim();
};
const cleanText = (v, max) => stripPercentSentences(str(v, max * 2)).slice(0, max).trim();

/*
 ctx: { mode, resumeText, jdText, baseReqs, targetKind }
 returns { extraReqs, assessments: Map(key -> {status, evidence, reason, why, suggestion, priority, category}),
           additional, summary, dropped }
*/
const validateAiOutput = (raw, ctx) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw aiError(502, 'AI_BAD_RESPONSE', 'The AI returned an unusable response. Please try again.');
  }
  const dropped = [];
  const seen = new Set(ctx.baseReqs.map((r) => r.key));
  const jdText = ctx.jdText || '';

  // ---- extra requirements ----
  const jobText = [];
  const roleTyp = [];
  for (const item of arr(raw.requirements, 60)) {
    if (!item || typeof item !== 'object') { dropped.push('requirement:not-object'); continue; }
    const name = str(item.skill, 80);
    const kind = oneOf(item.kind, KINDS, null);
    if (!plausibleSkillName(name) || !kind) { dropped.push(`requirement:${name}`); continue; }
    const key = canonicalKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = {
      skill: canonicalName(name), key, kind,
      importance: oneOf(item.importance, IMPORTANCE, 'medium'),
      category: str(item.category, 60) || undefined,
    };
    if (jdText && findSkillInText(jdText, name)) {
      jobText.push({ ...entry, kind: kind === 'recommended' ? 'preferred' : kind, source: 'job-text' });
    } else {
      roleTyp.push({ ...entry, source: 'ai-role' }); // claimed from text but not in it, or a typical role skill
    }
  }
  const acceptedJobText = jobText.slice(0, MAX_JOB_TEXT_ADDED);
  const explicit = ctx.baseReqs.length + acceptedJobText.length;
  const roleAllowed = ctx.targetKind === 'role-only' || explicit < MIN_EXPLICIT;
  const acceptedRole = roleAllowed ? roleTyp : [];
  const extraReqs = [...acceptedJobText, ...acceptedRole].slice(0, MAX_AI_ADDED);

  // ---- assessments ----
  const assessments = new Map();
  const resumeNorm = ctx.mode === 'resume' ? normText(ctx.resumeText) : '';
  for (const item of arr(raw.assessments, 100)) {
    if (!item || typeof item !== 'object') continue;
    const name = str(item.skill, 80);
    if (!name) continue;
    const key = canonicalKey(name);
    if (assessments.has(key)) continue;
    const status = oneOf(item.status, ['partial', 'missing', 'matched'], null);
    if (!status) continue;
    if (ctx.mode === 'manual' && status !== 'missing') continue; // manual mode never partial / evidence
    let evidence = '';
    if (status === 'partial') {
      const quote = str(item.evidence, 300);
      if (quote && evidenceVerified(quote, ctx.resumeText, resumeNorm)) evidence = quote;
      else if (quote) dropped.push(`evidence:${name}`);
    }
    assessments.set(key, {
      status,
      evidence,
      reason: cleanText(item.reason, 300),
      why: cleanText(item.why, 300),
      suggestion: cleanText(item.suggestion, 400),
      priority: oneOf(item.priority, IMPORTANCE, null),
      category: str(item.category, 60) || undefined,
    });
  }

  // ---- additional (resume mode only; must really be in the resume) ----
  const additional = [];
  if (ctx.mode === 'resume') {
    const used = new Set();
    for (const item of arr(raw.additional, 30)) {
      if (!item || typeof item !== 'object') continue;
      const name = str(item.skill, 80);
      if (!plausibleSkillName(name)) continue;
      const key = canonicalKey(name);
      if (seen.has(key) || used.has(key)) continue;
      if (!findSkillInText(ctx.resumeText, name)) { dropped.push(`additional:${name}`); continue; }
      used.add(key);
      additional.push({ skill: canonicalName(name), key, note: cleanText(item.note, 200) });
      if (additional.length >= 15) break;
    }
  }

  return { extraReqs, assessments, additional, summary: cleanText(raw.summary, 1200), dropped };
};

module.exports = { validateAiOutput, plausibleSkillName, stripPercentSentences, MAX_JOB_TEXT_ADDED };
