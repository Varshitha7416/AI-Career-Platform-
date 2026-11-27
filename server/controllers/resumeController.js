const Resume = require('../models/Resume');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const CoverLetter = require('../models/CoverLetter');
const User = require('../models/User');
const { extractResume, extOf, cleanResumeText } = require('../utils/resumeExtract');
const { effectiveInterests, roleKey, cleanRole, ROLE_MAX } = require('../utils/roles');

const stripExt = (name) => String(name || '').replace(/\.[a-z0-9]+$/i, '');

// ResumeDTO: never includes resumeText. Works for legacy docs (derives name/fileType).
const toResumeDTO = (r) => ({
  _id: r._id,
  name: r.name || stripExt(r.fileName),
  fileName: r.fileName,
  fileType: r.fileType || extOf(r.fileName) || null,
  fileSize: r.fileSize ?? null,
  isDefault: !!r.isDefault,
  targetRole: r.targetRole || null,
  roleAssigned: !!(r.targetRole && r.targetRoleKey),
  textLength: (r.resumeText || '').length,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const snapshotOf = (r) => ({
  name: r.name || stripExt(r.fileName),
  fileName: r.fileName,
  fileType: r.fileType || extOf(r.fileName) || undefined,
});

const cleanName = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');


const MAX_ROLE_RESUMES = 3;
const roleErr = (res, status, code, message) => res.status(status).json({ message, code, errors: { targetRole: message } });

// Validates a requested target role against the user's CURRENT career interests (legacy seekingRole counts as one).
// Returns { role, key } (role as stored on the interest), or { response } after sending an error.
const resolveTargetRole = async (req, res, raw) => {
  if (typeof raw !== 'string') { roleErr(res, 400, 'VALIDATION_ERROR', 'Target role must be text'); return { response: true }; }
  const asked = cleanRole(raw);
  if (asked.length > ROLE_MAX) { roleErr(res, 400, 'VALIDATION_ERROR', `Target role must be ${ROLE_MAX} characters or fewer`); return { response: true }; }
  const user = await User.findById(req.user.id).select('seekingRole careerInterests primaryRole').lean();
  const { interests } = effectiveInterests(user || {});
  const hit = interests.find((i) => i.roleKey === roleKey(asked));
  if (!hit) {
    roleErr(res, 400, 'ROLE_NOT_IN_INTERESTS', 'Choose one of your career interests as the target role. Add the role to your Career Interests in your Profile first.');
    return { response: true };
  }
  return { role: hit.role, key: hit.roleKey };
};

// Assigns `resume` to the role: any other resume holding the role is un-assigned (kept in the library, never deleted).
// Returns the replaced resume summary or null; or { error } when the 3-role-resume limit would be exceeded.
const assignRole = async (userId, resume, role, key) => {
  const others = await Resume.find({ user: userId, targetRoleKey: { $ne: null }, _id: { $ne: resume._id } }).select('name fileName targetRoleKey').lean();
  const replaced = others.find((o) => o.targetRoleKey === key) || null;
  const remaining = others.filter((o) => o.targetRoleKey !== key).length;
  if (remaining + 1 > MAX_ROLE_RESUMES) return { error: true };
  if (replaced) await Resume.updateOne({ _id: replaced._id, user: userId }, { $set: { targetRole: null, targetRoleKey: null } });
  resume.targetRole = role;
  resume.targetRoleKey = key;
  return { replaced: replaced ? { _id: replaced._id, name: replaced.name || stripExt(replaced.fileName) } : null };
};

const createResume = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    let name;
    if (req.body && req.body.name !== undefined && req.body.name !== '') {
      name = cleanName(req.body.name);
      if (!name || name.length > 100) return res.status(400).json({ message: 'Name must be 1 to 100 characters' });
    }

    let target = null;
    if (req.body && req.body.targetRole !== undefined && req.body.targetRole !== '' && req.body.targetRole !== 'null') {
      target = await resolveTargetRole(req, res, req.body.targetRole);
      if (target.response) return;
    }

    let extracted;
    try {
      extracted = await extractResume(req.file.buffer, req.file.originalname);
    } catch (err) {
      if (err.status === 400) return res.status(400).json({ message: err.message });
      throw err;
    }

    const hasDefault = await Resume.exists({ user: req.user.id, isDefault: true });
    const resume = await Resume.create({
      user: req.user.id,
      fileName: req.file.originalname.slice(0, 255),
      resumeText: extracted.text,
      name: name || stripExt(req.file.originalname).slice(0, 100) || 'Resume',
      fileType: extracted.fileType,
      fileSize: req.file.size,
      isDefault: !hasDefault,
    });

    let replaced = null;
    if (target) {
      const a = await assignRole(req.user.id, resume, target.role, target.key);
      if (a.error) {
        await Resume.deleteOne({ _id: resume._id, user: req.user.id });
        return roleErr(res, 409, 'TOO_MANY_ROLE_RESUMES', 'You can have at most 3 role resumes. Un-assign one first.');
      }
      replaced = a.replaced;
      await resume.save();
    }

    res.status(201).json({ message: 'Resume uploaded', resume: toResumeDTO(resume), ...(replaced ? { replaced } : {}) });
  } catch (error) {
    next(error);
  }
};

const getResumes = async (req, res, next) => {
  try {
    let resumes = await Resume.find({ user: req.user.id }).sort({ createdAt: -1 });
    // Read-only. Legacy accounts may have no stored default: the newest is shown as the default in the response only
    // (the same rule the recommendation engine applies); it is persisted by the next explicit write (upload/edit/delete).
    if (resumes.length && !resumes.some((r) => r.isDefault)) {
      resumes[0].isDefault = true; // in-memory only, never saved here
    }
    resumes = [...resumes].sort((a, b) => (b.isDefault - a.isDefault) || (b.createdAt - a.createdAt));
    res.status(200).json({ count: resumes.length, resumes: resumes.map(toResumeDTO) });
  } catch (error) {
    next(error);
  }
};

const updateResume = async (req, res, next) => {
  try {
    const { name, isDefault, targetRole } = req.body || {};
    if (name === undefined && isDefault === undefined && targetRole === undefined) {
      return res.status(400).json({ message: 'Nothing to update' });
    }
    if (isDefault !== undefined && isDefault !== true) {
      return res.status(400).json({ message: 'isDefault can only be set to true; choose another resume to change the default' });
    }
    let newName;
    if (name !== undefined) {
      newName = cleanName(name);
      if (!newName || newName.length > 100) return res.status(400).json({ message: 'Name must be 1 to 100 characters' });
    }

    const resume = await Resume.findOne({ _id: req.params.id, user: req.user.id });
    if (!resume) return res.status(404).json({ message: 'Resume not found' });

    let replaced = null;
    if (targetRole !== undefined) {
      if (targetRole === null || targetRole === '') {
        resume.targetRole = null;
        resume.targetRoleKey = null;
      } else {
        const t = await resolveTargetRole(req, res, targetRole);
        if (t.response) return;
        const a = await assignRole(req.user.id, resume, t.role, t.key);
        if (a.error) return roleErr(res, 409, 'TOO_MANY_ROLE_RESUMES', 'You can have at most 3 role resumes. Un-assign one first.');
        replaced = a.replaced;
      }
    }

    if (newName !== undefined) resume.name = newName;
    if (isDefault === true && !resume.isDefault) {
      await Resume.updateMany({ user: req.user.id, isDefault: true }, { $set: { isDefault: false } });
      resume.isDefault = true;
    }
    await resume.save();
    res.status(200).json({ message: 'Resume updated', resume: toResumeDTO(resume), ...(replaced ? { replaced } : {}) });
  } catch (error) {
    next(error);
  }
};

const deleteResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, user: req.user.id });
    if (!resume) return res.status(404).json({ message: 'Resume not found' });

    // Minimum-one rule: a user always keeps at least one resume.
    if ((await Resume.countDocuments({ user: req.user.id })) <= 1) {
      return res.status(409).json({ message: 'This is your only resume, so it cannot be deleted. Upload another resume first, then delete this one.', code: 'LAST_RESUME' });
    }

    // Backfill snapshots on legacy history so it stays readable once the resume is gone.
    const snap = snapshotOf(resume);
    await ResumeAnalysis.updateMany({ user: req.user.id, resume: resume._id, resumeSnapshot: { $exists: false } }, { $set: { resumeSnapshot: snap } });
    await CoverLetter.updateMany({ user: req.user.id, resume: resume._id, resumeSnapshot: { $exists: false } }, { $set: { resumeSnapshot: snap } });

    await Resume.deleteOne({ _id: resume._id, user: req.user.id });

    if (resume.isDefault) {
      const next1 = await Resume.findOne({ user: req.user.id }).sort({ createdAt: -1 });
      if (next1) await Resume.updateOne({ _id: next1._id, user: req.user.id }, { $set: { isDefault: true } });
    }

    const [analysesKept, coverLettersKept] = await Promise.all([
      ResumeAnalysis.countDocuments({ user: req.user.id, resume: resume._id }),
      CoverLetter.countDocuments({ user: req.user.id, resume: resume._id }),
    ]);
    res.status(200).json({ message: 'Resume deleted', analysesKept, coverLettersKept });
  } catch (error) {
    next(error);
  }
};

const previewResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, user: req.user.id });
    if (!resume) return res.status(404).json({ message: 'Resume not found' });
    res.status(200).json({ resume: toResumeDTO(resume), textPreview: cleanResumeText(resume.resumeText || '').slice(0, 4000) });
  } catch (error) {
    next(error);
  }
};

module.exports = { createResume, getResumes, updateResume, deleteResume, previewResume, toResumeDTO, snapshotOf };
