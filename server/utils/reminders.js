// Database-backed reminders (docs/29). Reminder due-times are stored on Application.reminderAt and Interview.remindAt; there are
// NO in-memory timers per reminder. This module turns due reminders into Notifications:
//   - lazily, for one user, when they load notifications / the dashboard
//   - from a periodic poller (startSweep) so reminders are not lost when nobody opens the app or the process restarts
// Exactly-once: the Notification carries a unique `dedupeKey` per (record, due time); a concurrent or repeated run hits the unique
// index and creates nothing. `reminderNotifiedAt` then marks the record so it is not scanned again.
const mongoose = require('mongoose');
const Application = require('../models/Application');
const Interview = require('../models/Interview');
const { notify } = require('./notify');

const fmt = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const BATCH = 100;

async function appsDue(userId, now) {
  const q = { reminderAt: { $lte: now }, reminderNotifiedAt: null, status: { $ne: 'rejected' } };
  if (userId) q.user = userId;
  const apps = await Application.find(q).sort({ reminderAt: 1 }).limit(BATCH)
    .populate({ path: 'job', select: 'title company', populate: { path: 'company', select: 'name' } }).lean();
  let created = 0;
  for (const a of apps) {
    if (a.job) {
      const n = await notify(a.user, {
        type: 'reminder',
        title: 'Application reminder',
        message: `${a.job.title}${a.job.company?.name ? ` at ${a.job.company.name}` : ''}${a.nextAction?.text ? ` - ${a.nextAction.text}` : ''}`,
        link: `/applications/${a._id}`,
        dedupeKey: `app-reminder:${a._id}:${new Date(a.reminderAt).getTime()}`,
      });
      if (n) created += 1;
    }
    // Conditional on the same due time, so a reminder the user edited in the meantime is left alone.
    await Application.updateOne({ _id: a._id, reminderAt: a.reminderAt, reminderNotifiedAt: null }, { $set: { reminderNotifiedAt: now } });
  }
  return { scanned: apps.length, created };
}

async function interviewsDue(userId, now) {
  const q = { remindAt: { $lte: now }, reminderNotifiedAt: null, status: 'scheduled' };
  if (userId) q.user = userId;
  const items = await Interview.find(q).sort({ remindAt: 1 }).limit(BATCH)
    .populate({ path: 'job', select: 'title company', populate: { path: 'company', select: 'name' } }).lean();
  let created = 0;
  for (const i of items) {
    // An interview that has already started is not worth a reminder; just mark it handled.
    if (i.job && new Date(i.scheduledAt).getTime() > now.getTime()) {
      const n = await notify(i.user, {
        type: 'reminder',
        title: 'Upcoming interview',
        message: `${i.job.title}${i.job.company?.name ? ` at ${i.job.company.name}` : ''} on ${fmt(i.scheduledAt)}`,
        link: '/interviews',
        dedupeKey: `interview-reminder:${i._id}:${new Date(i.remindAt).getTime()}`,
      });
      if (n) created += 1;
    }
    await Interview.updateOne({ _id: i._id, remindAt: i.remindAt, reminderNotifiedAt: null, status: 'scheduled' }, { $set: { reminderNotifiedAt: now } });
  }
  return { scanned: items.length, created };
}

/** Creates notifications for every due reminder (one user when userId is given). Safe to call concurrently and repeatedly. Never throws. */
async function materialiseDue({ userId = null, now = new Date() } = {}) {
  try {
    const uid = userId ? new mongoose.Types.ObjectId(String(userId)) : null;
    const a = await appsDue(uid, now);
    const i = await interviewsDue(uid, now);
    return { created: a.created + i.created, scanned: a.scanned + i.scanned };
  } catch (err) {
    console.error('reminder materialiser failed:', err.message);
    return { created: 0, scanned: 0, error: true };
  }
}

// Poller (NOT a timer per reminder). In NODE_ENV=test it is off unless REMINDER_SWEEP_INTERVAL_MS is set.
const startSweep = (env = process.env) => {
  const test = env.NODE_ENV === 'test';
  const every = Number(env.REMINDER_SWEEP_INTERVAL_MS);
  if (test && !(every > 0)) return null;
  const interval = every > 0 ? every : 5 * 60 * 1000;
  const run = async () => { for (let k = 0; k < 5; k += 1) { const r = await materialiseDue(); if (r.scanned < BATCH) break; } };
  mongoose.connection.once('open', () => { setTimeout(run, test ? 200 : 20000).unref(); });
  const t = setInterval(run, interval);
  t.unref();
  return t;
};

module.exports = { materialiseDue, startSweep };
