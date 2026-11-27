const { getProgramStats } = require('../utils/programs/stats');
const Program = require('../models/Program');
const ProgramEnrollment = require('../models/ProgramEnrollment');
const { escapeRegex } = require('../middleware/validate');
const { recordAdminAction } = require('../utils/adminAudit');
const { LEVELS, publicProgram } = require('./programController');

const THEMES = ['forest', 'sage', 'mint', 'moss'];
const STATES = ['active', 'inactive', 'archived'];

const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const isHttpUrl = (v) => {
  if (typeof v !== 'string' || v.length > 500) return false;
  try {
    const u = new URL(v);
    return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname);
  } catch {
    return false;
  }
};
const str = (v) => (typeof v === 'string' ? v.trim() : v);
const stateOf = (p) => (p.archivedAt ? 'archived' : p.isActive === false ? 'inactive' : 'active');

// Validates the editable fields present in `body`. Returns { errors: [...], data } (data holds only supplied fields).
const validateBody = (body, { creating }) => {
  const errors = [];
  const data = {};
  const text = (key, { required = false, min = 1, max }) => {
    const v = body[key];
    if (v === undefined) { if (creating && required) errors.push(`${key} is required`); return; }
    if (typeof v !== 'string') { errors.push(`${key} must be text`); return; }
    const t = v.trim();
    if (required && t.length < min) errors.push(`${key} is required`);
    else if (t.length > max) errors.push(`${key} must be at most ${max} characters`);
    else data[key] = t;
  };
  text('title', { required: true, min: 2, max: 150 });
  text('provider', { required: true, max: 100 });
  text('description', { required: true, min: 10, max: 2000 });
  text('category', { required: true, max: 60 });
  text('duration', { max: 60 });
  text('enrollmentInfo', { max: 1000 });

  if (body.level !== undefined) {
    if (!LEVELS.includes(body.level)) errors.push(`level must be one of: ${LEVELS.join(', ')}`);
    else data.level = body.level;
  }
  if (body.theme !== undefined) {
    if (!THEMES.includes(body.theme)) errors.push(`theme must be one of: ${THEMES.join(', ')}`);
    else data.theme = body.theme;
  }
  if (body.url !== undefined) {
    const u = str(body.url);
    if (u === '' || u === null) data.url = '';
    else if (!isHttpUrl(u)) errors.push('url must be a valid http(s) link');
    else data.url = u;
  }
  if (body.skills !== undefined) {
    if (!Array.isArray(body.skills) || body.skills.length > 30 || body.skills.some((s) => typeof s !== 'string' || !s.trim() || s.trim().length > 60)) {
      errors.push('skills must be a list of up to 30 short names');
    } else data.skills = [...new Set(body.skills.map((s) => s.trim()))];
  }
  if (body.resources !== undefined) {
    const r = body.resources;
    if (!Array.isArray(r) || r.length > 20) errors.push('resources must be a list of up to 20 items');
    else if (r.some((x) => !x || typeof x.title !== 'string' || !x.title.trim() || x.title.trim().length > 120)) errors.push('each resource needs a title (max 120 characters)');
    else if (r.some((x) => !isHttpUrl(str(x.url)))) errors.push('each resource url must be a valid http(s) link');
    else data.resources = r.map((x) => ({ title: x.title.trim(), url: x.url.trim() }));
  }
  if (body.milestones !== undefined) {
    const m = body.milestones;
    if (!Array.isArray(m) || m.length > 30) errors.push('milestones must be a list of up to 30 items');
    else if (m.some((x) => !x || typeof x.title !== 'string' || !x.title.trim() || x.title.trim().length > 120)) errors.push('each milestone needs a title (max 120 characters)');
    else if (m.some((x) => x.order !== undefined && (!Number.isInteger(x.order) || x.order < 1 || x.order > 1000))) errors.push('milestone order must be a positive whole number');
    else {
      const given = m.filter((x) => x.order !== undefined).map((x) => x.order);
      if (new Set(given).size !== given.length) errors.push('milestone orders must be unique');
      else {
        // existing orders are kept (learners' completed milestones refer to them); new items get the next free number
        let next = Math.max(0, ...given);
        data.milestones = m.map((x) => ({ title: x.title.trim(), order: x.order !== undefined ? x.order : (next += 1) })).sort((a, b) => a.order - b.order);
      }
    }
  }
  return { errors, data };
};

const reject = (res, errors) => res.status(400).json({ message: errors[0], errors });

const withCounts = async (programs) => {
  const rows = programs.length
    ? await ProgramEnrollment.aggregate([{ $match: { program: { $in: programs.map((p) => p._id) } } }, { $group: { _id: { program: '$program', status: '$status' }, n: { $sum: 1 } } }])
    : [];
  const map = new Map();
  rows.forEach((r) => {
    const c = map.get(String(r._id.program)) || { saved: 0, inProgress: 0, completed: 0, total: 0 };
    c[r._id.status === 'in-progress' ? 'inProgress' : r._id.status] += r.n;
    c.total += r.n;
    map.set(String(r._id.program), c);
  });
  return programs.map((p) => ({ ...publicProgram(p), state: stateOf(p), enrollmentCounts: map.get(String(p._id)) || { saved: 0, inProgress: 0, completed: 0, total: 0 } }));
};

const listPrograms = async (req, res, next) => {
  try {
    const one = (k) => (typeof req.query[k] === 'string' ? req.query[k].trim() : '');
    const state = one('state') || 'all';
    if (state !== 'all' && !STATES.includes(state)) return reject(res, [`state must be one of: all, ${STATES.join(', ')}`]);
    const level = one('level');
    if (level && !LEVELS.includes(level)) return reject(res, [`level must be one of: ${LEVELS.join(', ')}`]);
    const pageN = one('page') ? Number(one('page')) : 1;
    const limitN = one('limit') ? Number(one('limit')) : 20;
    if (!Number.isInteger(pageN) || pageN < 1) return reject(res, ['page must be a positive whole number']);
    if (!Number.isInteger(limitN) || limitN < 1) return reject(res, ['limit must be a positive whole number']);
    const limit = Math.min(limitN, 100);

    const filter = {};
    if (state === 'active') Object.assign(filter, { isActive: { $ne: false }, archivedAt: { $exists: false } });
    if (state === 'inactive') Object.assign(filter, { isActive: false, archivedAt: { $exists: false } });
    if (state === 'archived') filter.archivedAt = { $exists: true };
    if (one('category')) filter.category = one('category');
    if (level) filter.level = level;
    if (one('q')) {
      const re = { $regex: escapeRegex(one('q').slice(0, 80)), $options: 'i' };
      filter.$or = [{ title: re }, { provider: re }, { category: re }, { slug: re }];
    }
    const [total, rows] = await Promise.all([
      Program.countDocuments(filter),
      Program.find(filter).sort({ createdAt: -1, _id: 1 }).skip((pageN - 1) * limit).limit(limit).lean(),
    ]);
    res.status(200).json({ programs: await withCounts(rows), total, page: pageN, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (error) {
    next(error);
  }
};

const getStats = async (req, res, next) => {
  try {
    res.status(200).json(await getProgramStats());
  } catch (error) {
    next(error);
  }
};

const getProgram = async (req, res, next) => {
  try {
    const p = await Program.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ message: 'Program not found' });
    res.status(200).json({ program: (await withCounts([p]))[0] });
  } catch (error) {
    next(error);
  }
};

const createProgram = async (req, res, next) => {
  try {
    const { errors, data } = validateBody(req.body || {}, { creating: true });
    let slug;
    if (req.body?.slug !== undefined) {
      slug = typeof req.body.slug === 'string' ? req.body.slug.trim() : '';
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) errors.push('slug may contain lowercase letters, numbers and hyphens only');
    }
    if (errors.length) return reject(res, errors);

    if (slug) {
      if (await Program.exists({ slug })) return res.status(409).json({ message: 'A program with this slug already exists' });
    } else {
      const base = slugify(data.title) || 'program';
      slug = base;
      for (let i = 2; await Program.exists({ slug }); i += 1) slug = `${base}-${i}`;
    }
    const program = await Program.create({ ...data, slug, source: 'manual', isActive: true });
    await recordAdminAction({ actor: req.user.id, action: 'program.created', targetType: 'program', targetId: program._id, summary: `Created program "${program.title}"` });
    res.status(201).json({ message: 'Program created', program: (await withCounts([program.toObject()]))[0] });
  } catch (error) {
    next(error);
  }
};

const updateProgram = async (req, res, next) => {
  try {
    const { errors, data } = validateBody(req.body || {}, { creating: false });
    if (errors.length) return reject(res, errors);
    if (!Object.keys(data).length) return reject(res, ['Nothing to update']);
    const program = await Program.findById(req.params.id);
    if (!program) return res.status(404).json({ message: 'Program not found' });
    Object.assign(program, data);
    await program.save(); // save keeps derived durationWeeks in sync
    await recordAdminAction({ actor: req.user.id, action: 'program.updated', targetType: 'program', targetId: program._id, summary: `Updated program "${program.title}" (${Object.keys(data).join(', ')})` });
    res.status(200).json({ message: 'Program updated', program: (await withCounts([program.toObject()]))[0] });
  } catch (error) {
    next(error);
  }
};

// PUT /:id/state { state: active | inactive | archived }. Archive is a soft delete; activating an archived program restores it.
const setState = async (req, res, next) => {
  try {
    const state = req.body?.state;
    if (!STATES.includes(state)) return reject(res, [`state must be one of: ${STATES.join(', ')}`]);
    const program = await Program.findById(req.params.id);
    if (!program) return res.status(404).json({ message: 'Program not found' });
    if (stateOf(program.toObject()) === state) {
      return res.status(200).json({ message: 'No changes', program: (await withCounts([program.toObject()]))[0] });
    }
    program.isActive = state === 'active';
    program.archivedAt = state === 'archived' ? new Date() : undefined;
    await program.save();
    await recordAdminAction({ actor: req.user.id, action: `program.${state}`, targetType: 'program', targetId: program._id, summary: `Set program "${program.title}" to ${state}` });
    res.status(200).json({ message: `Program is now ${state}`, program: (await withCounts([program.toObject()]))[0] });
  } catch (error) {
    next(error);
  }
};

module.exports = { listPrograms, getStats, getProgram, createProgram, updateProgram, setState, isHttpUrl };
