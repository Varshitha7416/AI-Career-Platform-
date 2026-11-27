const Company = require('../models/Company');
const Job = require('../models/Job');
const { isValidId, escapeRegex } = require('../middleware/validate');
const { recordAdminAction } = require('../utils/adminAudit');

const STATUSES = ['all', 'active', 'archived'];

const httpUrl = (v) => {
  try {
    const u = new URL(v);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
};

const validateCompany = async (body, partial, currentId) => {
  const data = {};
  const errors = [];
  if (body.name === undefined) {
    if (!partial) errors.push('Name is required');
  } else {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 120) errors.push('Name must be 2-120 characters');
    else {
      const dup = await Company.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }, ...(currentId ? { _id: { $ne: currentId } } : {}) }).select('_id').lean();
      if (dup) errors.push('A company with this name already exists');
      else data.name = name;
    }
  }
  const text = (key, label, max) => {
    if (body[key] === undefined) return;
    const v = String(body[key] ?? '').trim();
    if (v.length > max) errors.push(`${label} must be at most ${max} characters`);
    else data[key] = v;
  };
  text('industry', 'Industry', 80);
  text('location', 'Location', 120);
  text('size', 'Size', 40);
  text('description', 'Description', 3000);
  for (const [key, label] of [['website', 'Website'], ['logoUrl', 'Logo URL']]) {
    if (body[key] === undefined) continue;
    const v = String(body[key] ?? '').trim();
    if (!v) data[key] = '';
    else if (!httpUrl(v)) errors.push(`${label} must be a valid http(s) link`);
    else data[key] = httpUrl(v);
  }
  return { data, errors };
};

const jobCounts = async (ids) => {
  if (!ids.length) return new Map();
  const rows = await Job.aggregate([{ $match: { company: { $in: ids } } }, { $group: { _id: '$company', count: { $sum: 1 } } }]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

const present = (c, counts) => ({ ...c, isActive: c.isActive !== false, jobCount: counts.get(String(c._id)) || 0 });

const listCompanies = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const status = req.query.status || 'all';
    if (!STATUSES.includes(status)) return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
    const filter = {};
    if (status === 'active') filter.isActive = { $ne: false };
    if (status === 'archived') filter.isActive = false;
    const q = String(req.query.q || '').trim().slice(0, 100);
    if (q) {
      const re = { $regex: escapeRegex(q), $options: 'i' };
      filter.$or = [{ name: re }, { industry: re }, { location: re }];
    }
    const [companies, total] = await Promise.all([
      Company.find(filter).sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Company.countDocuments(filter),
    ]);
    const counts = await jobCounts(companies.map((c) => c._id));
    res.status(200).json({ count: companies.length, total, page, pages: Math.max(Math.ceil(total / limit), 1), companies: companies.map((c) => present(c, counts)) });
  } catch (error) {
    next(error);
  }
};

// Active companies only, for the job form dropdown. `?include=archived` returns EVERY company (id, name, isActive),
// for filtering existing jobs (archived companies can still own jobs). Not capped at a page size; a hard safety
// ceiling of 5000 applies and `truncated` says so if it were ever hit.
const COMPANY_OPTIONS_CAP = 5000;
const companyOptions = async (req, res, next) => {
  try {
    const all = req.query.include === 'archived';
    const rows = await Company.find(all ? {} : { isActive: { $ne: false } }).select('name isActive').sort({ name: 1, _id: 1 }).limit(COMPANY_OPTIONS_CAP + 1).lean();
    const truncated = rows.length > COMPANY_OPTIONS_CAP;
    const companies = rows.slice(0, COMPANY_OPTIONS_CAP).map((c) => (all ? { _id: c._id, name: c.name, isActive: c.isActive !== false } : { _id: c._id, name: c.name }));
    res.status(200).json({ count: companies.length, truncated, companies });
  } catch (error) {
    next(error);
  }
};

const getCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id).lean();
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.status(200).json({ company: present(company, await jobCounts([company._id])) });
  } catch (error) {
    next(error);
  }
};

const createCompany = async (req, res, next) => {
  try {
    const { data, errors } = await validateCompany(req.body || {}, false);
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });
    const company = await Company.create(data);
    await recordAdminAction({ actor: req.user.id, action: 'company.created', targetType: 'company', targetId: company._id, summary: `Created company "${company.name}"` });
    res.status(201).json({ message: 'Company created successfully', company: present(company.toObject(), new Map()) });
  } catch (error) {
    next(error);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    const { data, errors } = await validateCompany(req.body || {}, true, company._id);
    if (errors.length) return res.status(400).json({ message: errors.join(', ') });
    company.set(data);
    await company.save();
    await recordAdminAction({ actor: req.user.id, action: 'company.updated', targetType: 'company', targetId: company._id, summary: `Updated company "${company.name}"` });
    res.status(200).json({ message: 'Company updated successfully', company: present(company.toObject(), await jobCounts([company._id])) });
  } catch (error) {
    next(error);
  }
};

const setArchived = (archive) => async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    company.isActive = !archive;
    company.archivedAt = archive ? new Date() : undefined;
    await company.save();
    await recordAdminAction({ actor: req.user.id, action: archive ? 'company.archived' : 'company.restored', targetType: 'company', targetId: company._id, summary: `${archive ? 'Archived' : 'Restored'} company "${company.name}"` });
    res.status(200).json({ message: archive ? 'Company archived' : 'Company restored', company: present(company.toObject(), await jobCounts([company._id])) });
  } catch (error) {
    next(error);
  }
};

// Hard delete is only allowed for a company that no job references; otherwise archive it.
const deleteCompany = async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid id' });
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    const jobs = await Job.countDocuments({ company: company._id });
    if (jobs > 0) return res.status(409).json({ message: `This company has ${jobs} job(s) and cannot be deleted. Archive it instead.`, jobCount: jobs });
    await company.deleteOne();
    await recordAdminAction({ actor: req.user.id, action: 'company.deleted', targetType: 'company', targetId: company._id, summary: `Deleted company "${company.name}" (no jobs)` });
    res.status(200).json({ message: 'Company deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { listCompanies, companyOptions, getCompany, createCompany, updateCompany, archiveCompany: setArchived(true), restoreCompany: setArchived(false), deleteCompany };
