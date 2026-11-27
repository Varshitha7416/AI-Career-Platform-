// NOT used by any route under the optional-verification policy (docs/31). Kept for a future action that truly needs a proven
// address. Gate for sensitive actions: the caller must have proven ownership of their email address (req.user.emailVerified is
// loaded from the database by `protect`, never from the client). Use AFTER `protect`.
//   router.post('/', protect, requireVerified('applying to jobs'), handler)
// `action` is a gerund phrase: the message reads "Please verify your email address before applying to jobs."
// The 403 carries code EMAIL_NOT_VERIFIED so the client can show a "verify your email" prompt. Policy table: docs/23.
const requireVerified = (action = 'using this feature') => (req, res, next) => {
  if (req.user && req.user.emailVerified === true) return next();
  return res.status(403).json({
    message: `Please verify your email address before ${action}. Check your inbox for the verification link, or request a new one from the banner at the top of the page.`,
    code: 'EMAIL_NOT_VERIFIED',
  });
};

module.exports = { requireVerified };
