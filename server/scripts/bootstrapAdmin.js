/*
 * Create the FIRST admin (docs/23-email-verification-admin-bootstrap.md).
 *
 *   BOOTSTRAP_ADMIN_SECRET=<random 24+ chars>  npm run bootstrap:admin -- --email you@example.com
 *
 * - Promotes an EXISTING account whose email is VERIFIED (sign up and click the verification link first).
 * - Needs the one-time secret: BOOTSTRAP_ADMIN_SECRET is what the operator configured; the same value must then be typed at a
 *   hidden prompt (non-interactive use: BOOTSTRAP_ADMIN_SECRET_INPUT plus --yes). The secret is never accepted as a command-line
 *   argument (shell history) and is never printed.
 * - Refuses if ANY admin already exists; safe against concurrent runs (atomic sentinel document): exactly one wins.
 * - No HTTP endpoint exists for this. ADMIN_EMAIL auto-promotion was removed.
 * - Safety guard (same principle as the other scripts): local MongoDB only, unless BOOTSTRAP_ALLOW_REMOTE_DB=<exact db name>;
 *   NODE_ENV=production is refused unless BOOTSTRAP_ALLOW_PRODUCTION=true (a first production admin is the real use case).
 * - Interactive runs also require typing the target email again to confirm.
 */
require('dotenv').config({ quiet: true });
const readline = require('readline');
const mongoose = require('mongoose');
const { SAFE_SCRIPT_OPTIONS, parseTarget } = require('../config/dbOptions');
const { bootstrapAdmin, BootstrapError } = require('../utils/bootstrapAdmin');

const args = process.argv.slice(2);
const fail = (msg, code = 1) => { console.error(msg); process.exit(code); };
const flag = (name) => args.includes(name);
const value = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const KNOWN = ['--email', '--yes', '--help'];

if (flag('--help')) {
  console.log('Usage: BOOTSTRAP_ADMIN_SECRET=<secret> npm run bootstrap:admin -- --email <verified account email> [--yes]\nSee the header of scripts/bootstrapAdmin.js.');
  process.exit(0);
}
const unknown = args.filter((a, i) => a.startsWith('-') && !KNOWN.includes(a) && !(i > 0 && args[i - 1] === '--email'));
if (unknown.length) fail(`Unknown argument(s): ${unknown.join(' ')}. Allowed: ${KNOWN.join(' ')}. (The secret is never accepted as an argument.)`);

const assertSafeTarget = () => {
  const target = parseTarget(process.env.MONGO_URI);
  if (!target) fail('Refusing to run: MONGO_URI is missing or not a valid MongoDB URI.');
  if (process.env.NODE_ENV === 'production' && process.env.BOOTSTRAP_ALLOW_PRODUCTION !== 'true') {
    fail('Refusing to run: NODE_ENV is "production". If this is the real first-admin setup, also set BOOTSTRAP_ALLOW_PRODUCTION=true.');
  }
  console.log(`Target: host=${target.hosts.join(',')} database=${target.dbName} (${target.isLocal ? 'local' : 'REMOTE'})`);
  if (!target.isLocal) {
    if (process.env.BOOTSTRAP_ALLOW_REMOTE_DB !== target.dbName) {
      fail(`Refusing to connect to a REMOTE database. If you really mean it, set BOOTSTRAP_ALLOW_REMOTE_DB=${target.dbName} (the exact database name).`);
    }
    console.warn(`WARNING: remote database "${target.dbName}" explicitly confirmed.`);
  }
  return target;
};

// Hidden prompt: input is not echoed.
const promptHidden = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
  rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
});
const prompt = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (a) => { rl.close(); resolve(a); });
});

const run = async () => {
  const email = value('--email');
  if (!email) fail('Missing --email <verified account email>.');
  const expectedSecret = process.env.BOOTSTRAP_ADMIN_SECRET;
  if (!expectedSecret) fail('BOOTSTRAP_ADMIN_SECRET is not set. Generate one: node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'hex\'))"');
  assertSafeTarget();

  let providedSecret;
  if (process.stdin.isTTY && !process.env.BOOTSTRAP_ADMIN_SECRET_INPUT) {
    providedSecret = await promptHidden('Type the bootstrap secret to confirm: ');
    const again = await prompt(`Type the email again to promote it to admin (${email.trim().toLowerCase()}): `);
    if (again.trim().toLowerCase() !== email.trim().toLowerCase()) fail('Email confirmation did not match. Nothing was changed.');
  } else {
    if (!flag('--yes')) fail('Non-interactive run: pass --yes and BOOTSTRAP_ADMIN_SECRET_INPUT.');
    providedSecret = process.env.BOOTSTRAP_ADMIN_SECRET_INPUT;
  }

  await mongoose.connect(process.env.MONGO_URI, SAFE_SCRIPT_OPTIONS);
  try {
    const r = await bootstrapAdmin({ db: mongoose.connection.db, email, expectedSecret, providedSecret });
    console.log(`Done: ${r.email} is now the first admin. They must log in again (older sessions were retired).`);
  } finally {
    await mongoose.disconnect();
  }
};

run().then(() => process.exit(0)).catch((err) => {
  if (err instanceof BootstrapError) fail(`Refused (${err.code}): ${err.message}`);
  fail(`Bootstrap failed: ${(err && (err.code || err.name)) || 'ERROR'}`); // never print driver messages (may contain the URI)
});
