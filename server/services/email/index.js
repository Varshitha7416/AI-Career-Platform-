// Reusable email service. Callers use sendEmail(template, to, data); they never see a transport.
//   templates.js  what the message says (pure)
//   transports/   how it is delivered (outbox for development, unconfigured placeholder; real provider in Phase 5)
//   config.js     which transport is allowed (the outbox is refused in production)
//
// Logging rule: this module never logs recipients, subjects, bodies or links. Failures surface as EmailError with a code.
const { render } = require('./templates');
const { transportName, isDevEnvironment, fromAddress } = require('./config');

class EmailError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'EmailError';
    this.code = code;
  }
}

let override = null; // test hook: replaces the transport
const _setTransport = (t) => { override = t || null; };

const getTransport = (env = process.env) => {
  if (override) return override;
  const name = transportName(env);
  if (name === 'outbox') {
    // Defence in depth: server.js also refuses to start with this combination.
    if (!isDevEnvironment(env)) throw new EmailError('EMAIL_OUTBOX_FORBIDDEN', 'The local outbox transport is not allowed in production');
    return require('./transports/outbox');
  }
  return require('./transports/unconfigured');
};

// Resolves { id, transport } on success; throws EmailError (code EMAIL_NOT_CONFIGURED | EMAIL_SEND_FAILED | ...) otherwise.
const sendEmail = async (template, to, data, env = process.env) => {
  if (typeof to !== 'string' || !/^[^\s@,;<>]+@[^\s@,;<>]+$/.test(to)) throw new EmailError('EMAIL_BAD_RECIPIENT', 'Invalid recipient');
  const content = render(template, data);
  const transport = getTransport(env);
  try {
    const result = await transport.send({
      to: to.trim().toLowerCase(), from: fromAddress(env), template,
      subject: content.subject, text: content.text, html: content.html, actionUrl: content.actionUrl,
    });
    // `state` is what the transport can honestly claim ('stored_local' | 'provider_accepted' | 'delivered'); never "sent to the inbox".
    return { id: result && result.id, transport: transport.name, state: (result && result.state) || 'provider_accepted' };
  } catch (err) {
    if (err instanceof EmailError) throw err;
    // Never forward provider/driver messages (they can contain addresses or credentials).
    throw new EmailError(err && err.code === 'EMAIL_NOT_CONFIGURED' ? 'EMAIL_NOT_CONFIGURED' : 'EMAIL_SEND_FAILED', 'Email could not be sent');
  }
};

// Global, account-independent availability: can ANY transport accept mail right now? Used to answer 503 up front.
const isAvailable = (env = process.env) => {
  try { return getTransport(env).available !== false; } catch { return false; }
};

module.exports = { sendEmail, getTransport, isAvailable, EmailError, _setTransport };
