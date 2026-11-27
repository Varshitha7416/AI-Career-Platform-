const User = require('../models/User');
const { verifyToken } = require('../utils/jwtConfig');
const { isValidId } = require('./validate');

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
      payload = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Session expired. Please log in again.', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ message: 'Invalid token. Please log in again.', code: 'INVALID_TOKEN' });
    }

    if (!isValidId(String(payload.userId))) {
      return res.status(401).json({ message: 'Invalid token. Please log in again.', code: 'INVALID_TOKEN' });
    }

    const user = await User.findById(payload.userId).select('role tokenVersion emailVerified deletedAt');
    if (!user || user.deletedAt) {
      return res.status(401).json({ message: 'Account no longer exists', code: 'INVALID_TOKEN' });
    }
    // Tokens issued before tokenVersion existed carry no `tv` and count as version 0. A password change bumps the
    // user's version, which retires every older token.
    if ((payload.tv ?? 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ message: 'Session is no longer valid. Please log in again.', code: 'INVALID_TOKEN' });
    }

    req.user = { id: user._id.toString(), role: user.role, emailVerified: user.emailVerified === true };
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
