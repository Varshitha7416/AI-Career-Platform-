const { isDevEnvironment } = require('../config');
const { fault } = require('../../../utils/testFaults');

// DEVELOPMENT / TEST transport: "delivers" an email by storing it in the OutboxEmail collection. Nothing is printed to the
// console or logs. It refuses to run (and the model refuses to load) unless NODE_ENV is exactly development/test.
//
// Transport interface (every transport, including the future real provider, implements exactly this):
//   name: string
//   available: boolean (false => the service reports "email unavailable" without trying)
//   send({ to, from, subject, text, html, template, actionUrl }) -> Promise<{ id: string, state }>
//       state is the strongest delivery fact the transport can honestly claim:
//         'stored_local'      written to the local outbox (NOT sent to anyone)
//         'provider_accepted' a real provider accepted it for delivery (future)
//         'delivered'         the provider confirmed delivery (future; only if it supplies confirmations)
//   (throws an Error with a string `code` on failure; never logs message content)
module.exports = {
  name: 'outbox',
  available: true,
  async send(message, env = process.env) {
    if (!isDevEnvironment(env)) {
      const err = new Error('The local outbox is not allowed outside development/test');
      err.code = 'EMAIL_OUTBOX_FORBIDDEN';
      throw err;
    }
    const OutboxEmail = require('../../../models/OutboxEmail'); // lazy: the model refuses to load outside dev/test
    await fault('email.send');
    const doc = await OutboxEmail.create({
      to: message.to, from: message.from, subject: message.subject, text: message.text, html: message.html,
      template: message.template, actionUrl: message.actionUrl,
    });
    await fault('email.afterStore'); // ambiguous outcome: stored, but the caller sees an error
    return { id: String(doc._id), state: 'stored_local' };
  },
};
