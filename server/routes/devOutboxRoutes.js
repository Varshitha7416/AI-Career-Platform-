const crypto = require('crypto');
const express = require('express');
const { validateEmail } = require('../utils/authValidation');
const { isDevEnvironment, devOutboxEnabled, transportName } = require('../services/email/config');

const router = express.Router();

// DEVELOPMENT ONLY: lets a developer read the emails the local outbox "stored" (e.g. to copy a password-reset link).
//
// Layers (every one must pass; any failure is an indistinguishable 404):
//   1. explicit opt-in: DEV_OUTBOX_ENABLED must be exactly "true" (default: off)
//   2. NODE_ENV must be exactly "development" or "test" (unset, "Production", "prod", typos => refused)
//   3. the outbox transport must be the one in use
//   4. only GET (HEAD, which Express would otherwise route to GET handlers, and everything else is refused)
//   5. Host must be a loopback name WITH this server's own port (stops DNS-rebinding from a web page)
//   6. no proxy / client-IP / forwarding headers of any kind, and no cross-site browser request
//   7. the TCP peer must be loopback (necessary, but NOT relied on alone)
//   8. a per-process random access key, printed once on the server console at start-up, sent as X-Dev-Outbox-Key
// server.js mounts this router only when devOutboxAllowed(); everything is re-checked per request (defence in depth).
// You must ask for ONE recipient; nothing can be listed.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

const devOutboxAllowed = (env = process.env) =>
  devOutboxEnabled(env) && isDevEnvironment(env) && transportName(env) === 'outbox';

// Per-process secret. Printed by server.js at start-up (development/test only); never persisted or logged elsewhere.
const accessKey = crypto.randomBytes(24).toString('base64url');
const keyMatches = (supplied) => {
  if (typeof supplied !== 'string' || !supplied) return false;
  const a = crypto.createHash('sha256').update(supplied).digest();
  const b = crypto.createHash('sha256').update(accessKey).digest();
  return crypto.timingSafeEqual(a, b);
};

// Any header that says "this request was relayed / here is the real client". A genuine local developer request has none.
const PROXY_HEADERS = ['forwarded', 'via', 'x-real-ip', 'x-client-ip', 'x-cluster-client-ip', 'true-client-ip', 'cf-connecting-ip',
  'cf-connecting-ipv6', 'cf-ipcountry', 'cf-ray', 'fastly-client-ip', 'x-original-forwarded-for', 'x-original-url', 'x-rewrite-url'];
const hasProxyHeaders = (headers) =>
  PROXY_HEADERS.some((h) => headers[h] !== undefined) || Object.keys(headers).some((h) => h.startsWith('x-forwarded-') || h.startsWith('cf-'));

// Host must be exactly <loopback name>:<the port this socket is listening on>. No Host, a different port, a different name,
// a userinfo/space/comma trick, or a duplicated header are all refused.
const hostIsLocal = (req) => {
  const host = req.headers.host;
  if (typeof host !== 'string' || host.length > 64 || /[\s,@/\\?#]/.test(host)) return false;
  const m = /^(\[::1\]|[A-Za-z0-9.-]+):(\d{1,5})$/.exec(host);
  if (!m) return false;
  const port = req.socket && req.socket.localPort;
  return LOOPBACK_HOSTS.has(m[1].toLowerCase()) && Number(m[2]) === port;
};

const fromLocalMachine = (req) => !!req.socket && LOOPBACK.has(req.socket.remoteAddress) && !hasProxyHeaders(req.headers);

const crossSite = (req) => {
  const site = req.headers['sec-fetch-site'];
  return site !== undefined && site !== 'none' && site !== 'same-origin';
};

const deny = (req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });

// router.use: covers every path under the mount point (including trailing slashes, double slashes, other casing).
const guard = (req, res, next) => {
  if (!devOutboxAllowed()) return deny(req, res);
  if (req.method !== 'GET') return deny(req, res); // HEAD, OPTIONS, POST ...
  if (!hostIsLocal(req) || !fromLocalMachine(req) || crossSite(req)) return deny(req, res);
  if (req.headers.origin !== undefined) return deny(req, res); // a browser page, not a developer tool
  if (!keyMatches(req.headers['x-dev-outbox-key'])) return deny(req, res);
  return next();
};
router.use(guard);

// GET /api/dev/outbox?to=<email>&limit=1..10  ->  newest first, rendered text + link (HTML omitted)
router.get('/outbox', async (req, res, next) => {
  try {
    const OutboxEmail = require('../models/OutboxEmail'); // lazy: the model refuses to load outside development/test
    const to = validateEmail(req.query.to);
    if (to.error) return res.status(400).json({ message: 'Pass the recipient as ?to=<email>' });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 10);
    const emails = await OutboxEmail.find({ to: to.value }).sort({ createdAt: -1 }).limit(limit).select('-html').lean();
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ notice: 'Development outbox: this endpoint does not exist in production.', count: emails.length, emails });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.devOutboxAllowed = devOutboxAllowed;
module.exports.fromLocalMachine = fromLocalMachine;
module.exports.hostIsLocal = hostIsLocal;
module.exports.hasProxyHeaders = hasProxyHeaders;
module.exports.accessKey = accessKey;
