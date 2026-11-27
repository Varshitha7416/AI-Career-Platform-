const syn = require('./skillSynonyms');
const { normText, numbersIn } = require('./common');

const UNITS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const BIG = { hundred: 100, thousand: 1000, million: 1000000, dozen: 12, dozens: 12 };

const UNIT_RE = Object.keys(UNITS).join('|');
const TENS_RE = Object.keys(TENS).join('|');
// number words (two.. , twenty-five, hundred ...); the bare word "one" is excluded (pronoun)
const NUMWORD = `(?:(?:${TENS_RE})(?:[- ](?:${UNIT_RE}))?|(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)|hundred|thousand|million|dozens?)`;
const NUMWORD_YEARS = `(?:${NUMWORD}|one)`;

const wordValue = (w) => {
  const parts = String(w).toLowerCase().split(/[- ]/);
  let total = 0;
  for (const p of parts) total += TENS[p] || UNITS[p] || BIG[p] || 0;
  return total;
};

const CERT_TERMS = [
  /\baws certified[\w\s-]{0,40}/i, /\bgoogle cloud (?:certified|professional)[\w\s-]{0,30}/i,
  /\bazure (?:certified|fundamentals|administrator|developer)[\w\s-]{0,30}/i,
  /\bpmp\b/i, /\bcissp\b/i, /\bccna\b/i, /\bccnp\b/i, /\bcka\b/i, /\bckad\b/i, /\bcspo\b/i,
  /\bscrum master\b/i, /\bsix sigma\b/i, /\bcomptia\b/i, /\bsecurity\+/i, /\bitil\b/i,
  /\b(?:solutions architect|certified (?:kubernetes|developer|professional))\b/i,
];

const DEGREE_TERMS = [
  { re: /\bph\.?d\b|\bdoctorate\b/i, key: /\bph\.?d\b|\bdoctorate\b|\bdoctor of\b/i },
  { re: /\bmba\b/i, key: /\bmba\b|master of business/i },
  { re: /\bmaster'?s\b|\bm\.?\s?tech\b|\bm\.?sc?\b(?=\s|\.|,|$)|\bmaster of\b/i, key: /\bmaster'?s\b|\bm\.?\s?tech\b|\bm\.?sc?\b|\bmaster of\b|\bmca\b/i },
  { re: /\bbachelor'?s\b|\bb\.?\s?tech\b|\bb\.?e\b(?=\s|\.|,|$)|\bb\.?sc?\b(?=\s|\.|,|$)|\bbachelor of\b/i, key: /\bbachelor'?s\b|\bb\.?\s?tech\b|\bb\.?e\b|\bb\.?sc?\b|\bbachelor of\b|\bundergraduate\b|\bbca\b/i },
];

const COMPANY_SUFFIX = '(?:Inc|Ltd|LLC|Corp|Corporation|Technologies|Solutions|Labs|Pvt|Consulting|Bank|University)';

const COMMON_CAPS = new Set([
  'dear', 'sincerely', 'regards', 'best', 'thank', 'hiring', 'team', 'i', 'my', 'the', 'this', 'your', 'our', 'a', 'an',
  'and', 'it', 'in', 'at', 'with', 'for', 'as', 'to', 'of', 'that', 'while', 'when', 'from', 'we', 'you', 'their', 'his',
  'her', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'january', 'february', 'march',
  'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'work', 'home', 'present',
]);

const PLURAL_STOP = new Set([
  'reasons', 'paragraphs', 'things', 'ways', 'areas', 'minutes', 'points', 'steps', 'key', 'main', 'sections', 'questions',
  'words', 'weeks', 'days', 'hours', 'months', 'years', 'percent',
]);

const LEARNING_RE = /\b(?:learn(?:ing)?|pick(?:ing)? up|ramp(?:ing)? up (?:on|with)|upskill(?:ing)? in)\s+(?:(?:to use|about|more about|the)\s+)?[A-Za-z0-9+#.\/ -]{1,50}?(?=[.;\n]|$| on (?:the|my) | quickly| as )/gi;

const wordNum = (s) => {
  const lower = String(s).toLowerCase();
  if (/^\d/.test(lower)) return lower.replace(/\+/g, '');
  const v = wordValue(lower);
  return v ? String(v) : lower;
};

const removeAll = (text, phrases) => {
  let out = text;
  for (const p of phrases.filter(Boolean)) {
    out = out.replace(new RegExp(syn.escapeRegex(String(p)), 'gi'), ' ');
  }
  return out;
};

const sourceHasWordNumber = (sourceNorm, value) => {
  const words = [...Object.entries(UNITS), ...Object.entries(TENS), ...Object.entries(BIG)]
    .filter(([, v]) => v === value)
    .map(([k]) => k);
  return words.some((w) => new RegExp(`\\b${w}\\b`).test(sourceNorm));
};

// Deterministic claim checker. Every concrete claim in `text` must be supported by resume + userFacts.
// Always allowed: the job's company name and title (the target) and the candidate's name.
// opts.skills=false / opts.placeholders=false relax those checks (used for analysis free text);
// opts.extraNumbersFrom lets numbers/years quoted from the job posting through.
const checkGrounding = ({ text, resumeText, userFacts, job, candidateName, opts = {} }) => {
  const useSkills = opts.skills !== false;
  const usePlaceholders = opts.placeholders !== false;
  const letter = String(text || '').replace(/[‘’]/g, String.fromCharCode(39));
  const source = `${resumeText || ''}\n${userFacts || ''}`;
  const sourceNorm = normText(source);
  const numberSource = `${source}\n${opts.extraNumbersFrom || ''}`;
  const issues = [];
  const add = (type, term, message) => {
    if (!issues.some((i) => i.type === type && i.term === term)) issues.push({ type, term, message });
  };

  const allowed = [job && job.company, job && job.title, candidateName];
  const body = removeAll(letter, allowed);

  // 1. placeholders left in the letter
  if (usePlaceholders) {
    const ph = body.match(/\[[^\]\n]{1,80}\]|\{\{[^}\n]{1,80}\}\}/g) || [];
    ph.forEach((p) => add('placeholder', p, `The letter still contains the placeholder ${p}.`));
  }

  // 2. technology / tool terms. Honest statements of intent ("learn TypeScript") are not claims.
  if (useSkills) {
    const claimBody = body.replace(LEARNING_RE, ' ');
    const vocab = [...syn.GROUPS.map((g) => g[0]), ...((job && job.skills) || []), ...((job && job.preferredSkills) || [])];
    const seen = new Set();
    for (const term of vocab) {
      const key = syn.canonicalKey(term);
      if (seen.has(key)) continue;
      seen.add(key);
      if (term.length < 1) continue;
      if (syn.textHasSkill(claimBody, term) && !syn.textHasSkill(source, term)) {
        add('skill', syn.canonicalName(term), `The text mentions "${syn.canonicalName(term)}" but it is not in the resume or the facts you provided.`);
      }
    }
  }

  // 3. years-of-experience claims (digits and words) and "decade" claims
  const yearsRe = new RegExp(`\\b(\\d{1,2}|${NUMWORD_YEARS})\\s*\\+?\\s*(?:-\\s*\\w+\\s+)?(?:years?|yrs?)\\b`, 'gi');
  const yearClaimTokens = new Set();
  let m;
  while ((m = yearsRe.exec(body))) {
    const n = wordNum(m[1]);
    yearClaimTokens.add(m[1].toLowerCase());
    const supported =
      new RegExp(`(?<![\\d.])${n}\\s*\\+?\\s*(?:years?|yrs?)`, 'i').test(numberSource) ||
      (!/^\d/.test(m[1]) && new RegExp(`\\b${m[1].toLowerCase()}[- ]?\\+?\\s*years?`, 'i').test(numberSource));
    if (!supported) add('years', m[0], `The text claims "${m[0]}" of experience, which the resume or your facts do not state.`);
  }
  const decadeRe = /\b(?:a|over a|more than a|nearly a|almost a|several|multiple|two|three)\s+decades?\b|\bdecades?\s+of\b/gi;
  while ((m = decadeRe.exec(body))) {
    if (!/\bdecades?\b/i.test(source)) add('years', m[0], `The text claims "${m[0]}" of experience, which the resume or your facts do not state.`);
  }

  // 4. numbers and percentages (digits)
  const srcNums = numbersIn(numberSource);
  const numRe = /\$?\d[\d,]*(?:\.\d+)?\s*%?/g;
  while ((m = numRe.exec(body))) {
    const raw = m[0].trim();
    const n = raw.replace(/[$,%\s]/g, '');
    if (yearClaimTokens.has(n) || srcNums.has(n)) continue;
    add('number', raw, `The number "${raw}" is not in the resume or the facts you provided.`);
  }

  // 4b. number words ("forty percent", "five engineers", "a hundred users")
  const wordNumRe = new RegExp(`\\b(${NUMWORD})\\b(?:\\s*\\+?\\s*(%|percent|per cent|years?|yrs?|([a-z]+)))?`, 'gi');
  while ((m = wordNumRe.exec(body))) {
    const word = m[1].toLowerCase();
    if (yearClaimTokens.has(word)) continue;
    const value = wordValue(word);
    const next = (m[3] || '').toLowerCase();
    const strong = !!m[2] && /^(%|percent|per cent)$/i.test(m[2]);
    const big = value >= 20;
    const plural = next.length > 3 && next.endsWith('s') && !PLURAL_STOP.has(next);
    if (!(strong || big || plural)) continue;
    if (srcNums.has(String(value)) || sourceHasWordNumber(sourceNorm, value)) continue;
    const term = m[0].trim();
    add('number', term, `The quantity "${term}" is not in the resume or the facts you provided.`);
  }

  // 5. certifications
  for (const re of CERT_TERMS) {
    const hit = re.exec(body);
    if (hit && !re.test(source)) add('certification', hit[0].trim(), `The text mentions the certification "${hit[0].trim()}" which is not in the resume or your facts.`);
  }
  const certPhrase = /\b(?:certified|certification|certificate)\s+(?:in|as|from)\s+([A-Z][\w+#.&-]*(?:\s+[A-Za-z][\w+#.&-]*){0,3})|([A-Z][\w+#.&-]*(?:\s+[A-Z][\w+#.&-]*){0,3})\s+(?:Certified|Certification|Certificate)\b/g;
  while ((m = certPhrase.exec(body))) {
    const phrase = (m[1] || m[2] || '').trim();
    if (phrase && !sourceNorm.includes(normText(phrase))) add('certification', phrase, `The text mentions a certification ("${phrase}") that is not in the resume or your facts.`);
  }

  // 6. degrees
  for (const d of DEGREE_TERMS) {
    const hit = d.re.exec(body);
    if (hit && !d.key.test(source)) add('degree', hit[0], `The text mentions a degree ("${hit[0]}") that is not in the resume or your facts.`);
  }

  // 7. employers: role-verb-led, "at/joined X", and company-suffix names
  const cap = "(?!(?:I|The|My|And|As|We|It|In)\\b)[A-Z][\\w&.'-]*";
  const seq = `(${cap}(?:\\s+(?:${cap}|&|of)){0,3})`;
  const empCandidates = [];
  const verbLed = new RegExp(`\\b(?:worked|working|interned|interning|employed|joined|experience|role|position|engineer|developer|intern|analyst|designer|manager|consultant)\\s+(?:at|with|for|by)\\s+${seq}`, 'g');
  const atLed = new RegExp(`\\b(?:[Aa]t|[Jj]oined|[Ee]mployed by)\\s+${seq}`, 'g');
  const suffixLed = new RegExp(`\\b((?:[A-Z][\\w&.-]*\\s+){1,3}${COMPANY_SUFFIX})\\b`, 'g');
  while ((m = verbLed.exec(body))) empCandidates.push(m[1]);
  while ((m = atLed.exec(body))) empCandidates.push(m[1]);
  while ((m = suffixLed.exec(body))) empCandidates.push(m[1]);
  for (let cand of empCandidates) {
    cand = cand.replace(/[.,;:'-]+$/, '').trim();
    const words = cand.split(/\s+/).filter((w) => !COMMON_CAPS.has(w.toLowerCase()));
    if (!words.length) continue;
    cand = words.join(' ');
    if (syn.textHasSkill(cand, cand) && syn.canonicalKey(cand).startsWith('g:')) continue; // a technology, not an employer
    const first = normText(words[0]);
    if (!sourceNorm.includes(normText(cand)) && !(first.length > 2 && sourceNorm.includes(first))) {
      add('employer', cand, `The text names "${cand}", which is not an employer or institution in your resume or facts.`);
    }
  }

  return { ok: issues.length === 0, issues, warnings: issues.map((i) => i.message) };
};

// Drops every sentence of `text` that contains an unsupported claim. Returns {text, removed}.
const stripUnsupportedSentences = (text, ctx) => {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  const kept = sentences.filter((s) => checkGrounding({ ...ctx, text: s }).ok);
  return { text: kept.join(' ').trim(), removed: kept.length !== sentences.length };
};

module.exports = { checkGrounding, stripUnsupportedSentences };
