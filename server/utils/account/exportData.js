const mongoose = require('mongoose');
const User = require('../../models/User');
const Application = require('../../models/Application');
const SavedJob = require('../../models/SavedJob');
const Referral = require('../../models/Referral');
const Resume = require('../../models/Resume');
const ResumeAnalysis = require('../../models/ResumeAnalysis');
const CoverLetter = require('../../models/CoverLetter');
const SkillGapAnalysis = require('../../models/SkillGapAnalysis');
const LearningRoadmap = require('../../models/LearningRoadmap');
const Notification = require('../../models/Notification');
const Interview = require('../../models/Interview');
const ProgramEnrollment = require('../../models/ProgramEnrollment');
const ContactMessage = require('../../models/ContactMessage');
require('../../models/Company');
require('../../models/Program');
require('../../models/Job');

// DATA EXPORT. Every query is filtered by the authenticated user's id. Collections that hold only the user's own content are
// exported with a deny-list (so new benign fields appear automatically); the profile and referrals, which touch other people,
// use an ALLOW-list. Nothing here ever reads a password hash, tokenVersion, token hash, another user's row or admin data.
const SCHEMA_VERSION = 1;
const CAP = 5000; // per collection; exceeding it is reported in `meta.truncated`

const NEVER = new Set(['password', 'tokenVersion', 'tokenHash', 'inputHash', 'roadmapLock', '__v', 'user', 'postedBy']);

// ObjectId -> string, Date kept, _id -> id, deny-list keys dropped (recursively).
const clean = (value, extraDrop = []) => {
  if (Array.isArray(value)) return value.map((v) => clean(v, extraDrop));
  if (value instanceof Date) return value;
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (NEVER.has(k) || extraDrop.includes(k)) continue;
      out[k === '_id' ? 'id' : k] = clean(v, extraDrop);
    }
    return out;
  }
  return value;
};

const jobSummary = (job) => (job && job.title
  ? { id: String(job._id), title: job.title, company: job.company && job.company.name ? job.company.name : undefined, city: job.city, jobCode: job.jobCode, applyUrl: job.applyUrl }
  : null);

const own = (Model, uid, query = {}) => Model.find({ user: uid, ...query }).sort({ createdAt: -1 }).limit(CAP);

const buildExport = async (userId) => {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const jobPop = { path: 'job', select: 'title city jobCode applyUrl company', populate: { path: 'company', select: 'name' } };

  const [user, applications, saved, referrals, resumes, analyses, letters, gaps, roadmaps, notifications, interviews, enrollments, messages] = await Promise.all([
    User.findById(uid).lean(),
    own(Application, uid).populate(jobPop).lean(),
    own(SavedJob, uid).populate(jobPop).lean(),
    Referral.find({ $or: [{ seeker: uid }, { referrer: uid }] }).sort({ createdAt: -1 }).limit(CAP)
      .populate('seeker', 'name currentCompany currentCompanyRole deletedAt').populate('referrer', 'name currentCompany currentCompanyRole deletedAt').lean(),
    own(Resume, uid).lean(),
    own(ResumeAnalysis, uid).lean(),
    own(CoverLetter, uid).select('+manualJobDescription').lean(),
    own(SkillGapAnalysis, uid).lean(),
    own(LearningRoadmap, uid).lean(),
    own(Notification, uid).lean(),
    own(Interview, uid).populate(jobPop).lean(),
    own(ProgramEnrollment, uid).populate('program', 'title slug provider').lean(),
    own(ContactMessage, uid).lean(),
  ]);
  if (!user || user.deletedAt) return null;

  const counterparty = (u) => (!u || u.deletedAt ? { name: 'Deleted user' } : { name: u.name, company: u.currentCompany || undefined, role: u.currentCompanyRole || undefined });
  const mine = (id) => String(id && id._id ? id._id : id) === String(uid);

  const referralRows = referrals.map((r) => {
    const sent = mine(r.seeker);
    return {
      id: String(r._id),
      direction: sent ? 'sent' : 'received',
      // Only the other person's display details already shown in the app; never their email, phone, resume or id.
      counterparty: counterparty(sent ? r.referrer : r.seeker),
      status: r.status,
      job: r.job ? { title: r.job.title, company: r.job.company, jobCode: r.job.jobCode, applyUrl: r.job.applyUrl } : null,
      // Text the user wrote is theirs; text written by the other person is not exported.
      ...(sent ? { message: r.message || '', resumeAttached: r.resumeInfo ? { name: r.resumeInfo.name, fileName: r.resumeInfo.fileName, fileType: r.resumeInfo.fileType } : null } : {}),
      statusHistory: (r.statusHistory || []).map((h) => ({ status: h.status, at: h.at })),
      createdAt: r.createdAt,
      respondedAt: r.respondedAt || null,
    };
  });

  const profile = {
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified === true,
    memberSince: user.createdAt,
    termsAcceptedAt: user.termsAcceptedAt || null,
    seekingRole: user.seekingRole || null,
    primaryRole: user.primaryRole || null,
    careerInterests: clean(user.careerInterests || []),
    isReferrer: !!user.isReferrer,
    currentCompany: user.currentCompany || null,
    currentCompanyRole: user.currentCompanyRole || null,
    referralCompanies: user.referralCompanies || [],
    phone: user.phone || null,
    location: user.location || null,
    headline: user.headline || null,
    bio: user.bio || null,
    linkedinUrl: user.linkedinUrl || null,
    githubUrl: user.githubUrl || null,
    portfolioUrl: user.portfolioUrl || null,
    experienceLevel: user.experienceLevel || null,
    experienceYears: user.experienceYears ?? null,
    education: clean(user.education || []),
    experiences: clean(user.experiences || []),
    skills: clean(user.skills || []),
    domains: user.domains || [],
    preferences: {
      preferredLocation: user.preferredLocation || null,
      preferredWorkMode: user.preferredWorkMode || null,
      preferredEmploymentType: user.preferredEmploymentType || null,
    },
  };

  const lists = {
    applications: applications.map((a) => ({ ...clean(a, ['job']), job: jobSummary(a.job) })),
    savedJobs: saved.map((s) => ({ id: String(s._id), savedAt: s.createdAt, job: jobSummary(s.job) })),
    referrals: referralRows,
    resumes: resumes.map((r) => clean(r)), // includes resumeText: extracted from the user's own upload
    resumeAnalyses: analyses.map((a) => clean(a)),
    coverLetters: letters.map((c) => clean(c)),
    skillGapAnalyses: gaps.map((g) => clean(g)),
    learningRoadmaps: roadmaps.map((r) => clean(r)),
    notifications: notifications.map((n) => clean(n)),
    interviews: interviews.map((i) => ({ ...clean(i, ['job', 'application']), job: jobSummary(i.job) })),
    programEnrollments: enrollments.map((e) => ({ ...clean(e, ['program']), program: e.program ? { title: e.program.title, slug: e.program.slug, provider: e.program.provider } : null })),
    contactMessages: messages.map((m) => clean(m, ['author', 'emailDelivery', 'contentHash', 'assignee', 'adminSeenAt'])),
  };

  const counts = Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length]));
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      format: 'CareerNest personal data export',
      counts,
      truncated: Object.entries(counts).filter(([, n]) => n >= CAP).map(([k]) => k),
      notes: [
        'Contains only data linked to your account.',
        'Passwords, session tokens and security records are never included.',
        'Referral messages written by other people are not included, and neither is any contact detail of other people.',
        'The theme choice is stored in your browser, not on our servers.',
      ],
    },
    profile,
    settings: {
      notificationPreferences: {
        applications: user.notificationPrefs?.applications !== false,
        interviews: user.notificationPrefs?.interviews !== false,
        referrals: user.notificationPrefs?.referrals !== false,
      },
    },
    ...lists,
  };
};

module.exports = { buildExport, SCHEMA_VERSION };
