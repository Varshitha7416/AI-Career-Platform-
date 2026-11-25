const Notification = require('../models/Notification');
const User = require('../models/User');

// notification type -> User.notificationPrefs key
const PREF_KEY = { application: 'applications', interview: 'interviews', referral: 'referrals' };

/**
 * Creates an in-app notification. NEVER throws (a notification failure must not break the action that caused it).
 * Honours the user's notificationPrefs; returns the created document or null.
 */
async function notify(userId, { type = 'system', title, message = '', link = '' }) {
  try {
    const key = PREF_KEY[type];
    if (key) {
      const u = await User.findById(userId).select('notificationPrefs').lean();
      if (u?.notificationPrefs && u.notificationPrefs[key] === false) return null;
    }
    return await Notification.create({
      user: userId,
      type,
      title: String(title).slice(0, 200),
      message: String(message).slice(0, 500),
      link: String(link).slice(0, 300),
    });
  } catch (err) {
    console.error('notify failed:', err.message);
    return null;
  }
}

module.exports = { notify };
