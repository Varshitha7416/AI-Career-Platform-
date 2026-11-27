// Job lifecycle, defined once.
//  - isActive=false  : hidden/draft (admin deactivated). Reversible via activate.
//  - status='closed' : no longer accepting applications (closedAt set). Reversible via reopen.
//  - applicationDeadline in the past : expired (derived, never stored).
// A job is PUBLIC (listings, search, filters, recommendations) only when none of the three applies. Legacy documents
// without these fields count as open. Saved jobs / applications keep working for non-public jobs (see getJobById).

const publicJobFilter = (now = new Date()) => ({
  $and: [
    { isActive: { $ne: false } },
    { status: { $ne: 'closed' } },
    { $or: [{ applicationDeadline: null }, { applicationDeadline: { $gte: now } }] },
  ],
});

const availabilityOf = (job, now = new Date()) => {
  if (job.isActive === false) return 'inactive';
  if (job.status === 'closed') return 'closed';
  if (job.applicationDeadline && new Date(job.applicationDeadline) < now) return 'expired';
  return 'open';
};

module.exports = { publicJobFilter, availabilityOf };
