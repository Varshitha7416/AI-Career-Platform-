const mongoose = require('mongoose');
const User = require('../models/User');
const Resume = require('../models/Resume');
const Application = require('../models/Application');
const SavedJob = require('../models/SavedJob');
const Interview = require('../models/Interview');
const Referral = require('../models/Referral');
const Notification = require('../models/Notification');
const Program = require('../models/Program');
const ProgramEnrollment = require('../models/ProgramEnrollment');
const Job = require('../models/Job');
const { computeProfileCompleteness } = require('../utils/profileCompleteness');
const { appliedDate, historyOf, STATUS_LABEL } = require('../utils/applicationHelpers');

const RANGES = ['30d', '3m', '6m', '12m', 'all'];

const rangeStart = (range) => {
  if (range === 'all') return null;
  const d = new Date();
  if (range === '30d') d.setDate(d.getDate() - 30);
  else d.setMonth(d.getMonth() - { '3m': 3, '6m': 6, '12m': 12 }[range]);
  return d;
};

const firstName = (name = '') => String(name).trim().split(/\s+/)[0] || 'there';

const companyOf = (job) => (job?.company ? { _id: job.company._id, name: job.company.name, logoUrl: job.company.logoUrl || null } : null);

const TIPS = [
  { title: 'Improve your technical skills', message: 'A short course in a skill your target jobs ask for can lift every application. Browse career programs to pick one.', action: { label: 'Explore Programs', link: '/programs' } },
  { title: 'Maintain a consistent application strategy', message: 'Applying to a few well-matched roles every week beats a big burst once a month. Save roles you like and apply steadily.', action: { label: 'Job Discovery', link: '/jobs' } },
  { title: 'Prepare for interviews', message: 'Practise explaining your projects out loud and research each company before the call. Add interviews to your tracker to stay organised.', action: { label: 'View Interviews', link: '/interviews' } },
];

const pickTip = ({ resumeCount, latestResumeAt, profilePercent, applicationCount, upcomingCount }) => {
  if (!resumeCount) {
    return { title: 'Upload your resume', message: 'Your resume powers match checks and recommendations. Upload it to get started.', action: { label: 'Upload Resume', link: '/resume' } };
  }
  const ageDays = (Date.now() - new Date(latestResumeAt).getTime()) / 86400000;
  if (ageDays > 60) {
    return { title: 'Keep your resume updated', message: 'Your latest resume is over two months old. Add recent projects and skills so employers see your best work.', action: { label: 'Update Resume', link: '/resume' } };
  }
  if (profilePercent < 80) {
    return { title: 'Complete your profile', message: 'A complete profile (target role, experience and preferences) gives you better job recommendations.', action: { label: 'Complete Profile', link: '/profile' } };
  }
  if (!applicationCount) {
    return { title: 'Start applying', message: 'Find a role that fits and add your first application to the tracker.', action: { label: 'Job Discovery', link: '/jobs' } };
  }
  if (upcomingCount) {
    return { title: 'Prepare for your upcoming interview', message: 'Review the job description, prepare examples of your work and test your setup beforehand.', action: { label: 'View Interviews', link: '/interviews' } };
  }
  const day = Math.floor(Date.now() / 86400000);
  return TIPS[day % TIPS.length];
};

const progressMessage = (percent) => {
  if (percent >= 100) return 'Amazing! You have reached every milestone. Keep your momentum going.';
  if (percent >= 70) return "You're almost there. Just a few steps left to reach your career goal.";
  if (percent >= 35) return "Great progress! Keep going; you're building real momentum.";
  return "Let's get started. Complete your first milestones to move your career forward.";
};

const getOverview = async (req, res, next) => {
  try {
    const range = req.query.range || 'all';
    if (!RANGES.includes(range)) return res.status(400).json({ message: `Range must be one of: ${RANGES.join(', ')}` });

    const userId = new mongoose.Types.ObjectId(req.user.id);
    const now = new Date();

    // ---- wave 1: every per-user collection, in parallel (one query each)
    const [user, resumes, applications, savedAll, interviews, referrals, unread, enrollments, programs] = await Promise.all([
      User.findById(userId).select('name seekingRole careerInterests primaryRole experienceYears preferredLocation preferredWorkMode preferredEmploymentType').lean(),
      Resume.find({ user: userId }).select('fileName createdAt').sort({ createdAt: -1 }).limit(200).lean(),
      Application.find({ user: userId }).select('job status appliedAt createdAt updatedAt statusHistory').lean(),
      SavedJob.find({ user: userId }).select('job createdAt').sort({ createdAt: -1 }).lean(),
      Interview.find({ user: userId }).select('application job scheduledAt mode type location status createdAt updatedAt statusChangedAt').lean(),
      Referral.find({ $or: [{ seeker: userId }, { referrer: userId }] }).select('seeker referrer status createdAt updatedAt').sort({ updatedAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ user: userId, read: false }),
      ProgramEnrollment.find({ user: userId }).select('program status').lean(),
      Program.find({ isActive: true }).select('title provider description category level duration theme').sort({ createdAt: 1, _id: 1 }).lean(),
    ]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // ---- wave 2: all jobs (with company) and referral counterparts, batched
    const jobIds = new Set();
    [...applications, ...savedAll, ...interviews].forEach((r) => jobIds.add(String(r.job)));
    const personIds = new Set();
    referrals.forEach((r) => { personIds.add(String(r.seeker)); personIds.add(String(r.referrer)); });
    const [jobs, people] = await Promise.all([
      jobIds.size ? Job.find({ _id: { $in: [...jobIds] } }).select('title city country workMode company').populate('company', 'name logoUrl').lean() : [],
      personIds.size ? User.find({ _id: { $in: [...personIds] } }).select('name currentCompany').lean() : [],
    ]);
    const jobById = new Map(jobs.map((j) => [String(j._id), j]));
    const personById = new Map(people.map((p) => [String(p._id), p]));

    // records whose job was deleted are ignored everywhere (never deleted by a read)
    const apps = applications.filter((a) => jobById.has(String(a.job)));
    const saved = savedAll.filter((s) => jobById.has(String(s.job)));
    const ivs = interviews.filter((i) => jobById.has(String(i.job)));

    // ---- stats
    const byStatus = { applied: 0, interviewing: 0, offer: 0, rejected: 0 };
    apps.forEach((a) => { if (byStatus[a.status] !== undefined) byStatus[a.status] += 1; });
    const upcomingAll = ivs
      .filter((i) => i.status === 'scheduled' && new Date(i.scheduledAt) >= now)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
    const profile = computeProfileCompleteness(user, resumes.length);
    const enrolledCompleted = enrollments.filter((e) => e.status === 'completed').length;

    const stats = {
      totalApplications: { value: apps.length, inProgress: byStatus.applied + byStatus.interviewing, link: '/applications' },
      savedJobs: { value: saved.length, link: '/saved-jobs' },
      upcomingInterviews: { value: upcomingAll.length, nextAt: upcomingAll[0]?.scheduledAt || null, link: '/interviews' },
      careerPrograms: { value: enrollments.length, completed: enrolledCompleted, link: '/programs' },
      profileComplete: { value: profile.percent, missing: profile.missing, link: '/profile' },
    };

    // ---- application overview (time filter on the applied date)
    const since = rangeStart(range);
    const inRange = since ? apps.filter((a) => new Date(appliedDate(a)) >= since) : apps;
    const ov = { applied: 0, interviewing: 0, offer: 0, rejected: 0 };
    inRange.forEach((a) => { if (ov[a.status] !== undefined) ov[a.status] += 1; });
    const applicationOverview = {
      range,
      total: ov.applied + ov.interviewing + ov.offer + ov.rejected,
      inProgress: ov.applied,
      interview: ov.interviewing,
      offer: ov.offer,
      rejected: ov.rejected,
    };

    // ---- recent activity: real records only
    const events = [];
    const jobTitle = (id) => jobById.get(String(id))?.title || 'a job';
    const co = (id) => companyOf(jobById.get(String(id)));
    apps.forEach((a) => {
      const history = historyOf(a);
      events.push({ id: `application:${a._id}`, type: 'application_created', title: `Applied to ${jobTitle(a.job)}`, description: co(a.job)?.name || '', at: appliedDate(a), status: 'applied', company: co(a.job), link: `/applications/${a._id}` });
      history.slice(1).forEach((h, idx) => {
        events.push({ id: `status:${a._id}:${idx}`, type: 'status_changed', title: `${jobTitle(a.job)}: status changed to ${STATUS_LABEL[h.status] || h.status}`, description: co(a.job)?.name || '', at: h.at, status: h.status, company: co(a.job), link: `/applications/${a._id}` });
      });
    });
    saved.forEach((s) => {
      events.push({ id: `saved:${s._id}`, type: 'job_saved', title: `Saved ${jobTitle(s.job)}`, description: co(s.job)?.name || '', at: s.createdAt, status: null, company: co(s.job), link: `/jobs/${s.job}` });
    });
    ivs.forEach((i) => {
      const where = jobTitle(i.job);
      // The scheduling itself, at the time it was created.
      events.push({ id: `interview:${i._id}`, type: 'interview_scheduled', title: `Interview scheduled for ${where}`, description: co(i.job)?.name || '', at: i.createdAt, status: 'scheduled', company: co(i.job), link: '/interviews' });
      // A later state change is its own real event, stamped with when it happened (updatedAt).
      if (i.status === 'completed' || i.status === 'cancelled') {
        events.push({ id: `interview:${i._id}:${i.status}`, type: 'interview_scheduled', title: `Interview ${i.status} for ${where}`, description: co(i.job)?.name || '', at: i.statusChangedAt || i.updatedAt || i.createdAt, status: i.status, company: co(i.job), link: '/interviews' });
      }
    });
    referrals.forEach((r) => {
      const iAmReferrer = String(r.referrer) === String(userId);
      const other = personById.get(String(iAmReferrer ? r.seeker : r.referrer));
      const otherName = other?.name || 'someone';
      if (iAmReferrer) {
        events.push({ id: `referral:${r._id}:in`, type: 'referral_received', title: 'Referral request received', description: `From ${otherName}`, at: r.createdAt, status: r.status, company: null, link: '/referrals' });
      } else if (r.status === 'requested' || r.status === 'pending') { // 'requested' = legacy name of 'pending'
        events.push({ id: `referral:${r._id}:out`, type: 'referral_updated', title: 'Referral requested', description: `From ${otherName}${other?.currentCompany ? ` at ${other.currentCompany}` : ''}`, at: r.createdAt, status: r.status, company: null, link: '/referrals' });
      } else {
        events.push({ id: `referral:${r._id}:out`, type: 'referral_updated', title: `Referral ${r.status}`, description: `${otherName}${other?.currentCompany ? ` at ${other.currentCompany}` : ''}`, at: r.updatedAt, status: r.status, company: null, link: '/referrals' });
      }
    });
    resumes.slice(0, 5).forEach((r) => {
      events.push({ id: `resume:${r._id}`, type: 'resume_uploaded', title: 'Resume uploaded', description: r.fileName || '', at: r.createdAt, status: null, company: null, link: '/resume' });
    });
    const recentActivity = events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8);

    // ---- career progress
    const attended = ivs.some((i) => i.status === 'completed' || (i.status !== 'cancelled' && new Date(i.scheduledAt) < now));
    const milestones = [
      { key: 'profile', label: 'Complete your profile', done: profile.percent >= 80, progress: profile.percent, target: 100, fraction: profile.percent / 100, hint: profile.percent >= 80 ? 'Your profile is in great shape.' : `Your profile is ${profile.percent}% complete.`, link: '/profile' },
      { key: 'resume', label: 'Upload your resume', done: resumes.length > 0, progress: Math.min(resumes.length, 1), target: 1, fraction: Math.min(resumes.length, 1), hint: resumes.length ? 'Resume on file.' : 'Upload a resume (PDF, DOCX or TXT) to unlock match checks.', link: '/resume' },
      { key: 'apply10', label: 'Apply to 10 jobs', done: apps.length >= 10, progress: Math.min(apps.length, 10), target: 10, fraction: Math.min(apps.length, 10) / 10, hint: `${Math.min(apps.length, 10)} of 10 applications tracked.`, link: '/jobs' },
      { key: 'interview', label: 'Attend an interview', done: attended, progress: attended ? 1 : 0, target: 1, fraction: attended ? 1 : 0, hint: attended ? 'You have attended an interview.' : 'Schedule an interview from an application.', link: '/interviews' },
      { key: 'offer', label: 'Get an offer', done: byStatus.offer > 0, progress: byStatus.offer > 0 ? 1 : 0, target: 1, fraction: byStatus.offer > 0 ? 1 : 0, hint: byStatus.offer > 0 ? 'Congratulations on your offer!' : 'Mark an application as Offer when you receive one.', link: '/applications' },
    ];
    const percent = Math.round((milestones.reduce((s, m) => s + m.fraction, 0) / milestones.length) * 100);
    const careerProgress = {
      percent,
      message: progressMessage(percent),
      milestones: milestones.map(({ fraction, ...m }) => m), // eslint-disable-line no-unused-vars
    };

    // ---- lists
    const recentApplications = [...apps]
      .sort((a, b) => new Date(appliedDate(b)) - new Date(appliedDate(a)))
      .slice(0, 5)
      .map((a) => ({ id: String(a._id), jobId: String(a.job), title: jobTitle(a.job), company: co(a.job), appliedAt: appliedDate(a), status: a.status, link: `/applications/${a._id}` }));

    const savedJobs = saved.slice(0, 5).map((s) => {
      const j = jobById.get(String(s.job));
      return { id: String(s._id), savedAt: s.createdAt, job: { _id: j._id, title: j.title, city: j.city, country: j.country || 'India', workMode: j.workMode || 'onsite', company: companyOf(j) } };
    });

    const upcomingInterviews = upcomingAll.slice(0, 3).map((i) => ({
      id: String(i._id), scheduledAt: i.scheduledAt, mode: i.mode, type: i.type, location: i.location || null, applicationId: String(i.application),
      job: { _id: jobById.get(String(i.job))._id, title: jobTitle(i.job) }, company: co(i.job),
    }));

    const enrollByProgram = new Map(enrollments.map((e) => [String(e.program), e.status]));
    const notEnrolled = programs.filter((p) => !enrollByProgram.has(String(p._id)));
    const enrolled = programs.filter((p) => enrollByProgram.has(String(p._id)));
    const featured = [...notEnrolled, ...enrolled].slice(0, 3).map((p) => ({
      id: String(p._id), title: p.title, provider: p.provider, description: p.description, category: p.category, level: p.level, duration: p.duration, theme: p.theme,
      enrollment: enrollByProgram.get(String(p._id)) || null,
    }));

    const tip = pickTip({ resumeCount: resumes.length, latestResumeAt: resumes[0]?.createdAt, profilePercent: profile.percent, applicationCount: apps.length, upcomingCount: upcomingAll.length });

    res.status(200).json({
      user: { name: user.name, firstName: firstName(user.name) },
      stats,
      applicationOverview,
      recentActivity,
      careerProgress,
      recentApplications,
      savedJobs,
      upcomingInterviews,
      programs: featured,
      tip,
      unreadNotifications: unread,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getOverview };
