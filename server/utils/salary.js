// Approximate, fixed conversion rates used ONLY to compare/sort/filter demo salaries on one scale.
// They are not live exchange rates.
const INR_PER_UNIT = { INR: 1, USD: 83, EUR: 90, GBP: 105, SGD: 62, AED: 22, CAD: 61, AUD: 55 };

const CURRENCIES = Object.keys(INR_PER_UNIT);

// Returns the annual amount in INR for a salary figure, or null when it can't be computed.
function toAnnualInr(amount, currency = 'INR', period = 'year') {
  if (!Number.isFinite(amount)) return null;
  const rate = INR_PER_UNIT[currency];
  if (!rate) return null;
  return Math.round(amount * rate * (period === 'month' ? 12 : 1));
}

module.exports = { CURRENCIES, INR_PER_UNIT, toAnnualInr };
