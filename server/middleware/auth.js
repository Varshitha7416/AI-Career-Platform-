const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verifies the Bearer token and loads the user. Sets req.user = { id, role }.
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Authentication required', code: 'NO_TOKEN' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ message: 'Invalid token. Please log in again.', code: 'INVALID_TOKEN' });
    }

    const user = await User.findById(payload.userId).select('role');
    if (!user) {
      return res.status(401).json({ message: 'Account no longer exists', code: 'INVALID_TOKEN' });
    }

    req.user = { id: user._id.toString(), role: user.role };
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

module.exports = { protect, requireAdmin };
