// Shared helpers for application timelines.

const STATUS_LABEL = { applied: 'Applied', interviewing: 'Interview', offer: 'Offer', rejected: 'Rejected' };

// The date the user applied (appliedAt is new; older records fall back to createdAt).
const appliedDate = (app) => app.appliedAt || app.createdAt;

/**
 * Status timeline for an application (plain object or document).
 * Records created before statusHistory existed get a synthetic first entry (and one for the current status),
 * so no data migration is required.
 */
function historyOf(app) {
  const o = typeof app.toObject === 'function' ? app.toObject() : app;
  if (Array.isArray(o.statusHistory) && o.statusHistory.length) {
    return o.statusHistory.map((h) => ({ status: h.status, at: h.at }));
  }
  const first = appliedDate(o);
  const history = [{ status: 'applied', at: first }];
  if (o.status && o.status !== 'applied') history.push({ status: o.status, at: o.updatedAt || first });
  return history;
}

// Ensures a mongoose application document has a persisted history (used before pushing a new entry).
function ensureHistory(doc) {
  if (!doc.statusHistory || !doc.statusHistory.length) {
    doc.statusHistory = historyOf(doc);
  }
}

module.exports = { STATUS_LABEL, appliedDate, historyOf, ensureHistory };
