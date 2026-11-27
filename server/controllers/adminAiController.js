// GET /api/admin/ai/health (admin only: mounted under adminRoutes' protect + requireAdmin).
// Passive report derived from real traffic; it makes NO AI call, spends no quota and never includes keys, prompts or user data.
const { defaultManager } = require('../services/ai/manager');

const getHealth = (req, res, next) => {
  try {
    res.status(200).json({ health: defaultManager.snapshot() });
  } catch (error) {
    next(error);
  }
};

module.exports = { getHealth };
