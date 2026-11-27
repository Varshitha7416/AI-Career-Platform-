const mongoose = require('mongoose');

const isValidId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Route middleware: rejects requests whose :param is not a valid ObjectId.
const validateIdParam = (name = 'id') => (req, res, next) => {
  if (!isValidId(req.params[name])) {
    return res.status(400).json({ message: `Invalid ${name}` });
  }
  next();
};

module.exports = { isValidId, isEmail, escapeRegex, validateIdParam };
