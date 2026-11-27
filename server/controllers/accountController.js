const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { buildExport } = require('../utils/account/exportData');
const { deleteAccount } = require('../utils/account/deletion');

const CONFIRM_WORD = 'DELETE';
const bodyOf = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});

// GET /api/account/export
const exportData = async (req, res, next) => {
  try {
    const data = await buildExport(req.user.id);
    if (!data) return res.status(404).json({ message: 'Account not found' });
    const day = new Date().toISOString().slice(0, 10);
    res.set('Cache-Control', 'no-store');
    res.set('Content-Disposition', `attachment; filename="careernest-data-export-${day}.json"`);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// POST /api/account/logout-all  — bumps tokenVersion atomically, so every token issued so far (including this one) is refused.
// No password is required: the action only signs sessions out (it grants nothing), and it is exactly what a user needs when a
// session is lost or stolen. The client clears its session and sends the user to the login page.
const logoutAll = async (req, res, next) => {
  try {
    const r = await User.updateOne({ _id: req.user.id, deletedAt: null }, { $inc: { tokenVersion: 1 } });
    if (!r.matchedCount) return res.status(404).json({ message: 'Account not found' });
    res.status(200).json({ message: 'You have been signed out of all devices. Please log in again.' });
  } catch (error) {
    next(error);
  }
};

// POST /api/account/delete  { password, confirmation: "DELETE" }
// Validation errors are 400 (never 401/403): the client treats a 401 as an expired session.
const removeAccount = async (req, res, next) => {
  try {
    const { password, confirmation } = bodyOf(req);
    if (typeof confirmation !== 'string' || confirmation.trim() !== CONFIRM_WORD) {
      return res.status(400).json({ message: `Type ${CONFIRM_WORD} to confirm`, code: 'CONFIRMATION_REQUIRED', errors: { confirmation: `Type ${CONFIRM_WORD} to confirm` } });
    }
    const user = await User.findOne({ _id: req.user.id, deletedAt: null });
    if (!user) return res.status(404).json({ message: 'Account not found' });
    const ok = typeof password === 'string' && password !== '' && await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(400).json({ message: 'Password is incorrect', code: 'INVALID_PASSWORD', errors: { password: 'Password is incorrect' } });
    }
    const result = await deleteAccount(user);
    if (!result.ok) return res.status(result.status).json({ message: result.message, code: result.code });
    res.status(200).json({ message: 'Your account has been deleted.' });
  } catch (error) {
    next(error);
  }
};

module.exports = { exportData, logoutAll, removeAccount };
