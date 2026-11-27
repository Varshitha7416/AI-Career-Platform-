// Index policy for Mongoose connections.
//
// Mongoose's default (autoIndex: true) builds every missing index of every registered model the moment it
// connects. That is convenient locally but means the first connection to a real/remote database silently changes
// its indexes. Policy here:
//   - local database (localhost / 127.0.0.1 / ::1, plain mongodb://)  -> auto index ON  (dev, demo and tests keep working)
//   - anything else (Atlas / any remote host)                          -> auto index OFF (use `npm run indexes`)
//   - AUTO_INDEX=true|false in the environment overrides either default.
// autoCreate (implicit creation of empty collections on connect) follows the same switch.

const parseTarget = (uri) => {
  const m = String(uri || '').match(/^(mongodb(?:\+srv)?):\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^?]*))?/);
  if (!m) return null;
  const hosts = m[2].split(',').map((h) => h.replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase());
  return {
    hosts,
    dbName: m[3] || 'test', // a URI without a database name means MongoDB's default db "test"
    isLocal: m[1] === 'mongodb' && hosts.every((h) => ['localhost', '127.0.0.1', '::1'].includes(h)),
  };
};

const resolveAutoIndex = (uri, env = process.env) => {
  const flag = String(env.AUTO_INDEX || '').trim().toLowerCase();
  if (flag === 'true') return { autoIndex: true, reason: 'AUTO_INDEX=true' };
  if (flag === 'false') return { autoIndex: false, reason: 'AUTO_INDEX=false' };
  const target = parseTarget(uri);
  if (target && target.isLocal) return { autoIndex: true, reason: 'local database' };
  return { autoIndex: false, reason: 'remote/unknown database' };
};

const connectOptions = (uri, env = process.env) => {
  const { autoIndex } = resolveAutoIndex(uri, env);
  return { autoIndex, autoCreate: autoIndex };
};

// Options for maintenance scripts: never build indexes as a side effect of connecting.
const SAFE_SCRIPT_OPTIONS = Object.freeze({ autoIndex: false, autoCreate: false });

module.exports = { parseTarget, resolveAutoIndex, connectOptions, SAFE_SCRIPT_OPTIONS };
