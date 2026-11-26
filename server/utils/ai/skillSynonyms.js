// Alias table for skill matching. First entry of each group is the canonical display name.
const GROUPS = [
  ['JavaScript', 'js', 'ecmascript', 'es6', 'es2015', 'vanilla js', 'java script'],
  ['TypeScript', 'ts'],
  ['Node.js', 'node', 'nodejs', 'node js'],
  ['React', 'reactjs', 'react.js', 'react js'],
  ['Next.js', 'nextjs', 'next js', 'next'],
  ['Vue', 'vuejs', 'vue.js', 'vue js'],
  ['Angular', 'angularjs', 'angular.js', 'angular js'],
  ['Express', 'expressjs', 'express.js'],
  ['Redux', 'redux toolkit', 'rtk'],
  ['HTML', 'html5'],
  ['CSS', 'css3'],
  ['Tailwind CSS', 'tailwind', 'tailwindcss'],
  ['Python', 'python3', 'py'],
  ['Java', 'core java', 'java se', 'j2ee', 'java ee'],
  ['C++', 'cpp', 'c plus plus'],
  ['C#', 'c sharp', 'csharp', '.net', 'dotnet', 'asp.net'],
  ['Go', 'golang'],
  ['Ruby', 'ruby on rails', 'rails'],
  ['PHP', 'laravel'],
  ['Swift', 'swiftui'],
  ['Kotlin'],
  ['Rust'],
  ['C'],
  ['R'],
  ['SQL', 'structured query language', 'tsql', 't-sql', 'plsql', 'pl/sql'],
  ['MySQL'],
  ['PostgreSQL', 'postgres', 'psql', 'postgre sql'],
  ['MongoDB', 'mongo', 'mongo db', 'mongoose'],
  ['Redis'],
  ['Elasticsearch', 'elastic search', 'elk'],
  ['Kubernetes', 'k8s', 'kube'],
  ['Docker', 'containers', 'containerization', 'dockerfile'],
  ['AWS', 'amazon web services', 'ec2', 's3', 'lambda'],
  ['Azure', 'microsoft azure'],
  ['GCP', 'google cloud', 'google cloud platform'],
  ['CI/CD', 'cicd', 'ci cd', 'continuous integration', 'continuous delivery', 'continuous deployment', 'github actions', 'jenkins', 'gitlab ci'],
  ['Git', 'github', 'gitlab', 'version control', 'bitbucket'],
  ['Terraform', 'infrastructure as code', 'iac'],
  ['Linux', 'unix', 'bash', 'shell scripting'],
  ['REST APIs', 'rest', 'restful', 'rest api', 'restful api', 'restful apis', 'api development', 'web services'],
  ['GraphQL', 'graph ql'],
  ['Machine Learning', 'ml', 'machine-learning'],
  ['Deep Learning', 'dl', 'neural networks', 'neural network'],
  ['Artificial Intelligence', 'ai', 'a.i.'],
  ['Natural Language Processing', 'nlp'],
  ['Computer Vision', 'cv'],
  ['TensorFlow', 'tf'],
  ['PyTorch', 'torch'],
  ['scikit-learn', 'sklearn', 'scikit learn'],
  ['Pandas'],
  ['NumPy'],
  ['Data Analysis', 'data analytics', 'analytics'],
  ['Data Visualization', 'data viz', 'tableau', 'power bi', 'powerbi'],
  ['Excel', 'microsoft excel', 'ms excel', 'spreadsheets'],
  ['Apache Spark', 'spark', 'pyspark'],
  ['Hadoop'],
  ['Kafka', 'apache kafka'],
  ['Airflow', 'apache airflow'],
  ['ETL', 'data pipelines', 'data pipeline', 'elt'],
  ['Agile', 'scrum', 'kanban'],
  ['Jira', 'atlassian jira'],
  ['Figma'],
  ['UI/UX', 'ui ux', 'ux design', 'ui design', 'user experience'],
  ['Unit Testing', 'unit tests', 'jest', 'mocha', 'junit', 'pytest', 'test driven development', 'tdd'],
  ['Test Automation', 'selenium', 'cypress', 'playwright'],
  ['Microservices', 'micro services', 'microservice'],
  ['System Design', 'distributed systems', 'software architecture'],
  ['Data Structures', 'dsa', 'data structures and algorithms', 'algorithms', 'data structures & algorithms'],
  ['OOP', 'object oriented programming', 'object-oriented programming', 'object oriented design', 'object-oriented'],
  ['Android', 'android development', 'android sdk'],
  ['iOS', 'ios development'],
  ['React Native', 'reactnative'],
  ['Flutter', 'dart'],
  ['Spring Boot', 'springboot', 'spring framework', 'spring'],
  ['Django'],
  ['Flask'],
  ['FastAPI', 'fast api'],
  ['Cybersecurity', 'cyber security', 'information security', 'infosec'],
  ['Communication', 'communication skills', 'verbal communication', 'written communication'],
  ['Leadership', 'team leadership', 'led a team'],
  ['Project Management', 'project manager', 'pmp'],
  ['Product Management', 'product manager'],
  ['SEO', 'search engine optimization'],
  ['Salesforce', 'sfdc'],
  ['SAP'],
  ['Postman'],
  ['Firebase'],
  ['WebSockets', 'websocket', 'socket.io', 'socketio'],
  ['OAuth', 'oauth2', 'jwt', 'json web token', 'json web tokens'],
];

// Aliases that are real words / too ambiguous to search for in free text. They still resolve
// when a skill NAME is looked up (a job that lists "ML"), just not as a text hit.
const AMBIGUOUS_IN_TEXT = new Set([
  'go', 'py', 'next', 'rest', 'spring', 'rails', 'ai', 'cv', 'dl', 'ts', 'tf', 'containers',
  'analytics', 'dart', 'torch', 'elk', 'rtk', 'kube', 'lambda', 's3', 'algorithms', 'ec2', 'elt',
]);

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const aliasToGroup = new Map();
GROUPS.forEach((g, i) => {
  g.forEach((name) => {
    const k = norm(name);
    if (!aliasToGroup.has(k)) aliasToGroup.set(k, i);
  });
});

const groupId = (skill) => aliasToGroup.get(norm(skill));

// Stable key used to compare skills: group index, or the normalised name for unknown skills.
const canonicalKey = (skill) => {
  const id = groupId(skill);
  return id === undefined ? `s:${norm(skill)}` : `g:${id}`;
};

const canonicalName = (skill) => {
  const id = groupId(skill);
  return id === undefined ? String(skill || '').trim() : GROUPS[id][0];
};

// ---- Ambiguous names (also ordinary words / letters): matched case-sensitively and only in context ----
// Tier A: capitalised mention counts unless it starts a sentence (then context is required).
const TIER_A = new Set(['react', 'excel', 'ruby', 'swift', 'rust', 'spring', 'spark', 'rails', 'torch', 'dart', 'lambda']);
// Tier B: always needs context (list delimiter, neighbouring tech term, or a "language/framework" word).
const TIER_B = new Set(['go', 'next', 'express', 'rest', 'r', 'c', 'flow']);
const SINGLE = new Set(['r', 'c']);
const tierOf = (term) => (TIER_A.has(term) ? 'A' : TIER_B.has(term) ? 'B' : null);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const CONTEXT_WORDS = /\b(?:programming|language|languages|framework|library|developer|development|stack|golang|engineer|backend|scripting)\b/i;

let techRegexes;
const techNeighbour = (window) => {
  if (!techRegexes) {
    techRegexes = [];
    GROUPS.forEach((g) => g.forEach((a) => {
      const n = norm(a);
      if (n.length > 2 && !tierOf(n) && !AMBIGUOUS_IN_TEXT.has(n)) techRegexes.push(termRegex(n));
    }));
  }
  return techRegexes.some((re) => re.test(window));
};

const hasContext = (text, idx, len, single) => {
  let i = idx - 1;
  while (i >= 0 && /[ \t]/.test(text[i])) i -= 1;
  let j = idx + len;
  while (j < text.length && /[ \t]/.test(text[j])) j += 1;
  const delim = /[,;|\/\u2022\u00b7:]/;
  if ((i >= 0 && delim.test(text[i])) || (j < text.length && delim.test(text[j]))) return true;
  if (single) return false;
  const before = text.slice(Math.max(0, idx - 50), idx);
  const after = text.slice(idx + len, idx + len + 50);
  if (CONTEXT_WORDS.test(text.slice(Math.max(0, idx - 20), idx + len + 20))) return true;
  return techNeighbour(`${before} ${after}`);
};

const sentenceStart = (text, idx) => {
  let i = idx - 1;
  while (i >= 0 && /[ \t\-*\u2022]/.test(text[i])) i -= 1;
  return i < 0 || /[.!?\n]/.test(text[i]);
};

const findContextual = (text, term, tier) => {
  const forms = [...new Set([cap(term), term.toUpperCase()])];
  const re = new RegExp(`(?<![A-Za-z0-9+#.])(?:${forms.map(escapeRegex).join('|')})(?![A-Za-z0-9+#])`, 'g');
  let m;
  while ((m = re.exec(text))) {
    const ok = tier === 'A'
      ? !sentenceStart(text, m.index) || hasContext(text, m.index, m[0].length, false)
      : hasContext(text, m.index, m[0].length, SINGLE.has(term));
    if (ok) return { alias: m[0], index: m.index };
  }
  return null;
};

// Terms usable for free-text search. Context-sensitive names are always kept (searched via findContextual);
// other ambiguous aliases only count when they are the name the caller asked about.
const searchTerms = (skill) => {
  const own = norm(skill);
  const id = groupId(skill);
  const terms = new Set([own]);
  if (id !== undefined) {
    GROUPS[id].forEach((a) => {
      const n = norm(a);
      if (tierOf(n) || !AMBIGUOUS_IN_TEXT.has(n)) terms.add(n);
    });
  }
  return [...terms].filter((t) => t.length > 1 || /[+#]/.test(t) || tierOf(t));
};

const termRegex = (term) =>
  // The second lookbehind stops an alias from matching as the suffix of a dotted name ("js" inside "Node.js").
  new RegExp(`(?<![a-z0-9+#])(?<![a-z0-9]\\.)${escapeRegex(term)}(?![a-z0-9+#])`, 'i');

// {alias, index} of the earliest alias of `skill` found in `text`, or null.
const findSkillInText = (text, skill) => {
  const t = String(text || '');
  let best = null;
  for (const term of searchTerms(skill)) {
    const tier = tierOf(term);
    const m = tier ? findContextual(t, term, tier) : termRegex(term).exec(t);
    const hit = m && (tier ? m : { alias: m[0], index: m.index });
    if (hit && (!best || hit.index < best.index)) best = hit;
  }
  return best;
};

const textHasSkill = (text, skill) => findSkillInText(text, skill) !== null;

// A short verbatim snippet (a real slice of `text`) around the skill mention.
const snippetFor = (text, skill, maxLen = 140) => {
  const hit = findSkillInText(text, skill);
  if (!hit) return '';
  const t = String(text);
  const lineStart = t.lastIndexOf('\n', hit.index) + 1;
  let lineEnd = t.indexOf('\n', hit.index);
  if (lineEnd === -1) lineEnd = t.length;
  let line = t.slice(lineStart, lineEnd).trim();
  if (line.length > maxLen) {
    const rel = hit.index - lineStart;
    const s = Math.max(0, rel - Math.floor(maxLen / 2));
    line = t.slice(lineStart + s, lineStart + s + maxLen).trim();
  }
  return line;
};

module.exports = {
  GROUPS,
  norm,
  canonicalKey,
  canonicalName,
  searchTerms,
  findSkillInText,
  textHasSkill,
  snippetFor,
  escapeRegex,
  termRegex,
};
