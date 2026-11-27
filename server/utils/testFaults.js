// TEST-ONLY fault injection. It is a complete no-op unless NODE_ENV is exactly "test" AND AUTH_TEST_FAULT is set, so it can
// never fire in development or production. It lets the test-suite make a REAL server process delay, fail, lose its database
// connection or crash at a precise point (e.g. "after the reset token was consumed, before the password was written").
//
// AUTH_TEST_FAULT = JSON array of rules: { point, action: 'throw'|'delay'|'crash'|'disconnect', ms?, times?, name? }
//   throw       -> throws an Error (err.name = rule.name || 'InjectedFault')
//   delay       -> waits `ms`
//   crash       -> process.exit(137) immediately (simulates a killed process)
//   disconnect  -> closes the Mongoose connection (simulates losing the database)
// `times` limits how often a rule fires (default: every time).
let rules = null;
const load = () => {
  if (rules) return rules;
  rules = [];
  if (process.env.NODE_ENV === 'test' && process.env.AUTH_TEST_FAULT) {
    try { rules = JSON.parse(process.env.AUTH_TEST_FAULT).map((r) => ({ ...r, fired: 0 })); } catch { rules = []; }
  }
  return rules;
};

const fault = async (point) => {
  if (process.env.NODE_ENV !== 'test') return;
  for (const r of load()) {
    if (r.point !== point || (r.times && r.fired >= r.times)) continue;
    r.fired += 1;
    if (r.action === 'delay') await new Promise((res) => setTimeout(res, Number(r.ms) || 0));
    else if (r.action === 'crash') process.exit(137);
    else if (r.action === 'disconnect') await require('mongoose').connection.close(true);
    else if (r.action === 'throw') { const e = new Error(`injected fault at ${point}`); e.name = r.name || 'InjectedFault'; throw e; }
  }
};

module.exports = { fault };
