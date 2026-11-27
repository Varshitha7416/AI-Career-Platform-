// Free-text program durations ("12 weeks", "3 months", "6 months (flexible)") -> an approximate whole number of weeks.
// Returns null when no week/month/day figure can be read (e.g. "self-paced"). For ranges ("4-6 weeks") the upper bound is used.
const parseDurationWeeks = (text) => {
  if (typeof text !== 'string') return null;
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(weeks?|wks?|months?|mos?|days?)\b/);
  if (!m) return null;
  const n = Number(m[2] || m[1]);
  if (!(n > 0)) return null;
  const unit = m[3];
  let weeks;
  if (/^(week|wk)/.test(unit)) weeks = n;
  else if (/^(month|mo)/.test(unit)) weeks = n * 4.345;
  else weeks = n / 7;
  return Math.max(1, Math.round(weeks));
};

// Buckets used by the discovery filter: short <= 4 weeks, medium 5-12 weeks, long > 12 weeks.
const DURATION_BUCKETS = {
  short: { durationWeeks: { $gte: 1, $lte: 4 } },
  medium: { durationWeeks: { $gte: 5, $lte: 12 } },
  long: { durationWeeks: { $gt: 12 } },
};

module.exports = { parseDurationWeeks, DURATION_BUCKETS };
