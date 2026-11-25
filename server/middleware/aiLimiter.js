// Per-user AI call limiter (in-memory, resets on restart) plus shared AI helpers.
//
// Usage: `aiLimiter` runs before the controller and rejects with 429 RATE_LIMIT when the user
// is already at the limit. The controller calls `req.consumeAiCall()` right before a real AI
// call, so reused results and validation failures do not count.

const LIMIT = 15;
const WINDOW_MS = 60 * 60 * 1000;

const hits = new Map(); // userId -> [timestamps]

const recent = (userId, now = Date.now()) => {
  const list = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length) hits.set(userId, list); else hits.delete(userId);
  return list;
};

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const id of [...hits.keys()]) recent(id, now);
}, 10 * 60 * 1000);
if (cleanup.unref) cleanup.unref();

const rateLimited = (res) => res.status(429).json({
  message: 'You have reached the hourly limit for AI requests (15 per hour). Please try again later.',
  code: 'RATE_LIMIT',
});

const aiLimiter = (req, res, next) => {
  const userId = String(req.user.id);
  if (recent(userId).length >= LIMIT) return rateLimited(res);
  req.consumeAiCall = () => {
    const list = recent(userId);
    list.push(Date.now());
    hits.set(userId, list);
  };
  next();
};

// Test helper
aiLimiter.reset = () => hits.clear();

const AI_MESSAGES = {
  AI_QUOTA: 'The AI service has reached its usage limit. Please try again later.',
  AI_UNAVAILABLE: 'The AI service is not available right now.',
  AI_BAD_RESPONSE: 'The AI returned an unusable response. Please try again.',
  AI_ERROR: 'The AI service is temporarily unavailable. Please try again.',
};

// Maps an error thrown by the AI layer to the contract response. Returns true if handled.
const sendAiError = (res, err) => {
  if (!err) return false;
  let code = err.code;
  if (!AI_MESSAGES[code]) {
    if (err.status === 429) code = 'AI_QUOTA';
    else if (err.status === 503) code = 'AI_UNAVAILABLE';
    else if (err.status === 502) code = err.code === 'AI_BAD_RESPONSE' ? 'AI_BAD_RESPONSE' : 'AI_ERROR';
    else return false;
  }
  const status = { AI_QUOTA: 429, AI_UNAVAILABLE: 503, AI_BAD_RESPONSE: 502, AI_ERROR: 502 }[code];
  const message = code === 'AI_QUOTA' || !err.message ? AI_MESSAGES[code] : err.message;
  res.status(status).json({ message, code });
  return true;
};

const list = (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

// Builds the AI job input from a Job document whose `company` is populated.
const buildJobInput = (job) => ({
  title: job.title,
  company: job.company?.name || '',
  description: job.jobDescription || '',
  requirements: list(job.requirements),
  responsibilities: list(job.responsibilities),
  skills: list(job.skills),
  preferredSkills: list(job.preferredSkills),
  education: list(job.education).join('; '),
  experienceLevel: job.experienceLevel,
});

module.exports = { aiLimiter, sendAiError, buildJobInput, LIMIT };
