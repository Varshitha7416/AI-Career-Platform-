// Validators for the extended profile fields. Each returns { value } or { error }. Partial updates: callers only
// validate keys that are present in the request body. Non-strings / wrong shapes are always rejected.
const { ROLE_MAX, roleKey, cleanRole } = require('./roles');

const hasControl = (s) => /[\u0000-\u001f\u007f]/.test(s);
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const text = (raw, label, max, { required = false, multiline = false } = {}) => {
  if (raw === undefined || raw === null) raw = '';
  if (typeof raw !== 'string') return { error: `${label} must be text` };
  const value = (multiline ? raw.trim() : raw.trim().replace(/\s+/g, ' '));
  if (!value && required) return { error: `${label} is required` };
  if (value.length > max) return { error: `${label} must be ${max} characters or fewer` };
  if (hasControl(multiline ? value.replace(/[\n\r\t]/g, '') : value)) return { error: `${label} contains characters that are not allowed` };
  if (/[<>]/.test(value)) return { error: `${label} cannot contain < or >` };
  return { value };
};

const validatePhone = (raw) => {
  const t = text(raw, 'Phone number', 20);
  if (t.error) return t;
  if (!t.value) return { value: '' };
  if (!/^[0-9+\-() ]+$/.test(t.value) || t.value.replace(/\D/g, '').length < 7) {
    return { error: 'Enter a valid phone number (digits, +, -, spaces and brackets only)' };
  }
  return t;
};

const validateUrl = (raw, label) => {
  if (raw === undefined || raw === null || raw === '') return { value: '' };
  if (typeof raw !== 'string') return { error: `${label} must be a link` };
  const v = raw.trim();
  if (!v) return { value: '' };
  if (v.length > 300) return { error: `${label} must be 300 characters or fewer` };
  const bad = { error: `${label} must be a valid link starting with http:// or https://` };
  let u;
  try { u = new URL(v); } catch { return bad; }
  if (!['http:', 'https:'].includes(u.protocol) || /\s/.test(v)) return bad;
  return { value: v };
};

const validateExperienceLevel = (raw) => {
  if (raw === '' || raw === null) return { value: undefined };
  if (raw !== 'fresher' && raw !== 'experienced') return { error: 'Choose fresher or experienced' };
  return { value: raw };
};

const thisYear = () => new Date().getFullYear();
const year = (raw, label) => {
  if (raw === undefined || raw === null || raw === '') return { value: undefined };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1950 || n > thisYear() + 8) return { error: `${label} must be a year between 1950 and ${thisYear() + 8}` };
  return { value: n };
};

const validateEducation = (raw) => {
  if (!Array.isArray(raw)) return { error: 'Education must be a list' };
  if (raw.length > 10) return { error: 'You can add at most 10 education entries' };
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const e = raw[i];
    const at = `Education entry ${i + 1}`;
    if (!isPlainObject(e)) return { error: `${at} is not valid` };
    const institution = text(e.institution, `${at}: institution`, 120, { required: true });
    if (institution.error) return institution;
    const degree = text(e.degree, `${at}: degree`, 100); if (degree.error) return degree;
    const field = text(e.fieldOfStudy, `${at}: field of study`, 100); if (field.error) return field;
    const grade = text(e.grade, `${at}: grade`, 30); if (grade.error) return grade;
    const sy = year(e.startYear, `${at}: start year`); if (sy.error) return sy;
    const ey = year(e.endYear, `${at}: end year`); if (ey.error) return ey;
    if (sy.value && ey.value && ey.value < sy.value) return { error: `${at}: end year cannot be before the start year` };
    const item = { institution: institution.value };
    if (degree.value) item.degree = degree.value;
    if (field.value) item.fieldOfStudy = field.value;
    if (grade.value) item.grade = grade.value;
    if (sy.value) item.startYear = sy.value;
    if (ey.value) item.endYear = ey.value;
    out.push(item);
  }
  return { value: out };
};

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;
const validateExperiences = (raw) => {
  if (!Array.isArray(raw)) return { error: 'Experience must be a list' };
  if (raw.length > 10) return { error: 'You can add at most 10 experience entries' };
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const e = raw[i];
    const at = `Experience entry ${i + 1}`;
    if (!isPlainObject(e)) return { error: `${at} is not valid` };
    const company = text(e.company, `${at}: company`, 100, { required: true }); if (company.error) return company;
    const title = text(e.title, `${at}: job title`, 100, { required: true }); if (title.error) return title;
    const desc = text(e.description, `${at}: description`, 1000, { multiline: true }); if (desc.error) return desc;
    if (e.current !== undefined && e.current !== null && typeof e.current !== 'boolean') return { error: `${at}: current must be true or false` };
    const dates = {};
    for (const k of ['startDate', 'endDate']) {
      const v = e[k];
      if (v === undefined || v === null || v === '') continue;
      if (typeof v !== 'string' || !DATE_RE.test(v)) return { error: `${at}: ${k === 'startDate' ? 'start' : 'end'} date must look like 2023-06` };
      dates[k] = v;
    }
    if (e.current) delete dates.endDate;
    if (dates.startDate && dates.endDate && dates.endDate.slice(0, 7) < dates.startDate.slice(0, 7)) {
      return { error: `${at}: end date cannot be before the start date` };
    }
    const item = { company: company.value, title: title.value, ...dates };
    if (e.current) item.current = true;
    if (desc.value) item.description = desc.value;
    out.push(item);
  }
  return { value: out };
};

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const validateSkills = (raw) => {
  if (!Array.isArray(raw)) return { error: 'Skills must be a list' };
  const seen = new Set();
  const out = [];
  for (const s of raw) {
    const nameRaw = typeof s === 'string' ? s : (isPlainObject(s) ? s.name : undefined);
    const name = text(nameRaw, 'Skill', 40);
    if (name.error) return name;
    if (!name.value) continue;
    if (seen.has(name.value.toLowerCase())) continue; // duplicates are merged silently
    seen.add(name.value.toLowerCase());
    const item = { name: name.value };
    if (isPlainObject(s) && s.level !== undefined && s.level !== null && s.level !== '') {
      if (!LEVELS.includes(s.level)) return { error: `Skill level must be one of ${LEVELS.join(', ')}` };
      item.level = s.level;
    }
    out.push(item);
  }
  if (out.length > 40) return { error: 'You can list at most 40 skills' };
  return { value: out };
};

const validateDomains = (raw) => {
  if (!Array.isArray(raw)) return { error: 'Domains must be a list' };
  const seen = new Set();
  const out = [];
  for (const d of raw) {
    const t = text(d, 'Domain', 50);
    if (t.error) return t;
    if (!t.value || seen.has(t.value.toLowerCase())) continue;
    seen.add(t.value.toLowerCase());
    out.push(t.value);
  }
  if (out.length > 10) return { error: 'You can list at most 10 domains' };
  return { value: out };
};

// Career interests: list of strings or {role}. Returns {value:[{role,roleKey}]} or {error, code}.
const validateInterests = (raw) => {
  const bad = (error, code = 'VALIDATION_ERROR') => ({ error, code });
  if (!Array.isArray(raw)) return bad('Career interests must be a list');
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const r = typeof item === 'string' ? item : (isPlainObject(item) ? item.role : undefined);
    if (typeof r !== 'string') return bad('Each career interest must be a role name');
    const role = cleanRole(r);
    if (!role) continue;
    if (role.length > ROLE_MAX) return bad(`A role must be ${ROLE_MAX} characters or fewer`);
    if (hasControl(role) || /[<>]/.test(role)) return bad('A role contains characters that are not allowed');
    const key = roleKey(role);
    if (seen.has(key)) return bad(`"${role}" is already one of your career interests`, 'DUPLICATE_ROLE');
    seen.add(key);
    out.push({ role, roleKey: key });
  }
  if (out.length > 3) return bad('You can choose at most 3 career interests', 'TOO_MANY_ROLES');
  return { value: out };
};

module.exports = { validatePhone, validateUrl, validateExperienceLevel, validateEducation, validateExperiences, validateSkills, validateDomains, validateInterests, text };
