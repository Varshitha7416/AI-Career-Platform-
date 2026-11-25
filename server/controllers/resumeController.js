const Resume = require('../models/Resume');
const ResumeAnalysis = require('../models/ResumeAnalysis');
const CoverLetter = require('../models/CoverLetter');
const { extractResume, extOf, cleanResumeText } = require('../utils/resumeExtract');

const stripExt = (name) => String(name || '').replace(/\.[a-z0-9]+$/i, '');

// ResumeDTO: never includes resumeText. Works for legacy docs (derives name/fileType).
const toResumeDTO = (r) => ({
  _id: r._id,
  name: r.name || stripExt(r.fileName),
  fileName: r.fileName,
  fileType: r.fileType || extOf(r.fileName) || null,
  fileSize: r.fileSize ?? null,
  isDefault: !!r.isDefault,
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

const createResume = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    let name;
    if (req.body && req.body.name !== undefined && req.body.name !== '') {
      name = cleanName(req.body.name);
      if (!name || name.length > 100) return res.status(400).json({ message: 'Name must be 1 to 100 characters' });
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

    res.status(201).json({ message: 'Resume uploaded', resume: toResumeDTO(resume) });
  } catch (error) {
    next(error);
  }
};

const getResumes = async (req, res, next) => {
  try {
    let resumes = await Resume.find({ user: req.user.id }).sort({ createdAt: -1 });
    // Legacy accounts have no default yet: promote the newest (additive, lazy).
    if (resumes.length && !resumes.some((r) => r.isDefault)) {
      resumes[0].isDefault = true;
      await Resume.updateOne({ _id: resumes[0]._id, user: req.user.id }, { $set: { isDefault: true } });
    }
    resumes = [...resumes].sort((a, b) => (b.isDefault - a.isDefault) || (b.createdAt - a.createdAt));
    res.status(200).json({ count: resumes.length, resumes: resumes.map(toResumeDTO) });
  } catch (error) {
    next(error);
  }
};

const updateResume = async (req, res, next) => {
  try {
    const { name, isDefault } = req.body || {};
    if (name === undefined && isDefault === undefined) {
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

    if (newName !== undefined) resume.name = newName;
    if (isDefault === true && !resume.isDefault) {
      await Resume.updateMany({ user: req.user.id, isDefault: true }, { $set: { isDefault: false } });
      resume.isDefault = true;
    }
    await resume.save();
    res.status(200).json({ message: 'Resume updated', resume: toResumeDTO(resume) });
  } catch (error) {
    next(error);
  }
};

const deleteResume = async (req, res, next) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, user: req.user.id });
    if (!resume) return res.status(404).json({ message: 'Resume not found' });

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
