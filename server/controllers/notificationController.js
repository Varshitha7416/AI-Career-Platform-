const Notification = require('../models/Notification');
const { materialiseDue } = require('../utils/reminders');

const getNotifications = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    await materialiseDue({ userId: req.user.id }); // lazily creates this user's due reminders (idempotent, never throws)
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: req.user.id }).sort({ createdAt: -1, _id: -1 }).limit(limit).select('type title message link read createdAt').lean(),
      Notification.countDocuments({ user: req.user.id, read: false }),
    ]);
    res.status(200).json({ unreadCount, notifications });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { read: true }, { returnDocument: 'after' })
      .select('type title message link read createdAt').lean();
    if (!n) return res.status(404).json({ message: 'Notification not found' });
    res.status(200).json({ notification: n });
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.status(200).json({ message: 'All notifications marked as read', updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const removed = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!removed) return res.status(404).json({ message: 'Notification not found' });
    res.status(200).json({ message: 'Notification removed' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotifications, markRead, markAllRead, deleteNotification };
