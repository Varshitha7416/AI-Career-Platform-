const Notification = require('../models/Notification');
const User = require('../models/User');

// notification type -> User.notificationPrefs category. THE single mapping (documented in docs/27). A type that is not listed
// (e.g. 'system') is always delivered. Only an explicit `false` disables a category; users without the field keep receiving.
const PREF_KEY = {
  application: 'applications',
  interview: 'interviews',
  referral: 'referrals',
  program: 'programs',
  reminder: 'reminders',
  support: 'support',
};
const NOTIFICATION_CATEGORIES = [...new Set(Object.values(PREF_KEY))];
const prefCategoryFor = (type) => PREF_KEY[type] || null;

/**
 * Creates an in-app notification. NEVER throws (a notification failure must not break the action that caused it).
 * Honours the user's notificationPrefs; returns the created document or null.
 */
async function notify(userId, { type = 'system', title, message = '', link = '', dedupeKey } = {}) {
  try {
    const key = PREF_KEY[type];
    // Always read the user: a deleted (tombstoned) account never receives rows, even from a request that was already in flight.
    const u = await User.findById(userId).select('notificationPrefs deletedAt').lean();
    if (!u || u.deletedAt) return null;
    if (key && u.notificationPrefs && u.notificationPrefs[key] === false) return null;
    return await Notification.create({
      user: userId,
      type,
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 500),
      link: String(link).slice(0, 300),
      ...(dedupeKey ? { dedupeKey: String(dedupeKey).slice(0, 200) } : {}),
    });
  } catch (err) {
    // A repeated dedupeKey (unique index) means this notification already exists: exactly-once delivery, not an error.
    if (err && err.code === 11000 && dedupeKey) return null;
    console.error('notify failed:', err.message);
    return null;
  }
}

module.exports = { notify, PREF_KEY, NOTIFICATION_CATEGORIES, prefCategoryFor };
