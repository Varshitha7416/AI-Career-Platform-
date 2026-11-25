// Shared helpers for the Referrals feature: status normalisation, job keys, DTO builders.

const STATUS_LIST = ['pending', 'accepted', 'referred', 'declined', 'withdrawn'];
const ACTIVE_STATUSES = ['pending', 'accepted'];
const RETENTION_NOTICE = 'A copy of the resume text was attached when this request was sent. It stays with the request even if the original resume is later deleted, and is readable only by the recipient while the request is pending, accepted or referred, and not if it is declined or withdrawn.';

// legacy 'requested' is read as 'pending'
const normStatus = (s) => (s === 'requested' ? 'pending' : s);
// DB values that mean the given normalised status
const dbStatuses = (s) => (s === 'pending' ? ['pending', 'requested'] : [s]);

// Lifecycle: target status -> { who may do it, statuses it may start from }
const TRANSITIONS = {
  accepted: { by: 'recipient', from: ['pending'], action: 'accept' },
  declined: { by: 'recipient', from: ['pending', 'accepted'], action: 'decline' },
  referred: { by: 'recipient', from: ['accepted'], action: 'mark-referred' },
  withdrawn: { by: 'sender', from: ['pending'], action: 'withdraw' },
};

const allowedActionsFor = (role, status) => Object.values(TRANSITIONS)
  .filter((t) => t.by === role && t.from.includes(status))
  .map((t) => t.action);

// Normalised, lowercased URL used for duplicate detection of external jobs.
const normaliseUrl = (raw) => {
  const u = new URL(String(raw).trim());
  u.hash = '';
  let s = u.toString().toLowerCase();
  if (s.endsWith('/')) s = s.slice(0, -1);
  return s;
};

const parseHttpUrl = (raw) => {
  try {
    const u = new URL(String(raw).trim());
    return ['http:', 'https:'].includes(u.protocol) ? u : null;
  } catch {
    return null;
  }
};

// Companies a provider can refer for: referralCompanies, else [currentCompany]
const effectiveCompanies = (u) => {
  if (u && Array.isArray(u.referralCompanies) && u.referralCompanies.length) return u.referralCompanies;
  return u && u.currentCompany ? [u.currentCompany] : [];
};

const pickCompany = (u, jobCompany) => {
  const list = effectiveCompanies(u);
  const match = jobCompany && list.find((c) => c.toLowerCase() === String(jobCompany).toLowerCase());
  return match || list[0] || '';
};

const USER_FIELDS = 'name seekingRole experienceYears preferredLocation currentCompany currentCompanyRole referralCompanies';

const jobDto = (j) => ({
  title: (j && j.title) || 'Job details not recorded',
  company: (j && j.company) || '',
  jobCode: (j && j.jobCode) || null,
  jobId: j && j.jobId ? String(j.jobId) : null,
  applyUrl: (j && j.applyUrl) || null,
  external: !!(j && j.external),
  externalJobId: (j && j.externalJobId) || null,
});

const resumeDto = (r) => (r.resumeInfo && (r.resumeInfo.name || r.resumeInfo.fileName)
  ? { name: r.resumeInfo.name || r.resumeInfo.fileName, fileName: r.resumeInfo.fileName || '', fileType: r.resumeInfo.fileType || '' }
  : null);

const historyDto = (r) => {
  const hist = (r.statusHistory || []).map((h) => ({ status: normStatus(h.status), at: h.at }));
  if (hist.length) return hist;
  // legacy document: derive a minimal history
  const status = normStatus(r.status);
  const out = [{ status: 'pending', at: r.createdAt }];
  if (status !== 'pending') out.push({ status, at: r.updatedAt || r.createdAt });
  return out;
};

// `sender` / `recipient` are lean User docs (no email ever selected). `viewerId` decides direction.
const toSummary = (r, viewerId, sender, recipient) => {
  const sent = String(r.seeker && r.seeker._id ? r.seeker._id : r.seeker) === String(viewerId);
  const other = sent ? recipient : sender;
  const status = normStatus(r.status);
  const job = jobDto(r.job);
  return {
    _id: r._id,
    direction: sent ? 'sent' : 'received',
    status,
    job,
    allowedActions: allowedActionsFor(sent ? 'sender' : 'recipient', status),
    messagePreview: String(r.message || '').slice(0, 140),
    resume: resumeDto(r),
    counterpart: {
      name: (other && other.name) || 'CareerNest user',
      headline: sent ? ((other && other.currentCompanyRole) || '') : ((other && (other.currentCompanyRole || other.seekingRole)) || ''),
      company: sent ? pickCompany(other, job.company) : ((other && other.currentCompany) || ''),
      companySelfReported: true,
    },
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
};

const toDetail = (r, viewerId, sender, recipient) => {
  const summary = toSummary(r, viewerId, sender, recipient);
  const recipientView = summary.direction === 'received';
  const status = summary.status;
  return {
    ...summary,
    message: r.message || '',
    candidate: recipientView && sender
      ? {
        name: sender.name,
        seekingRole: sender.seekingRole || '',
        experienceYears: sender.experienceYears ?? null,
        preferredLocation: sender.preferredLocation || '',
      }
      : null,
    provider: {
      name: (recipient && recipient.name) || 'CareerNest user',
      currentCompanyRole: (recipient && recipient.currentCompanyRole) || '',
      company: pickCompany(recipient, summary.job.company),
      companySelfReported: true,
    },
    statusHistory: historyDto(r),
    allowedActions: allowedActionsFor(recipientView ? 'recipient' : 'sender', status),
    resumeAvailable: recipientView && ACTIVE_STATUSES.concat('referred').includes(status) && !!r.resumeInfo,
    resumeRetentionNotice: RETENTION_NOTICE,
  };
};

const emptyCounts = () => ({ all: 0, pending: 0, accepted: 0, referred: 0, declined: 0, withdrawn: 0 });

module.exports = {
  STATUS_LIST, ACTIVE_STATUSES, TRANSITIONS, RETENTION_NOTICE, USER_FIELDS,
  normStatus, dbStatuses, allowedActionsFor, normaliseUrl, parseHttpUrl,
  effectiveCompanies, pickCompany, toSummary, toDetail, emptyCounts,
};
