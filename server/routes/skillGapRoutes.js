const express = require('express');
const router = express.Router();
const c = require('../controllers/skillGapController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');
const { aiLimiter } = require('../middleware/aiLimiter');

router.use(protect);

// Fixed paths first, then the id routes.
router.get('/roles', c.getRoles);
router.get('/skills', c.getSkills);
router.post('/resume', aiLimiter, c.analyzeFromResume);
router.post('/manual', aiLimiter, c.analyzeManual);
router.get('/', c.listAnalyses);
router.get('/:id', validateIdParam(), c.getAnalysis);
router.delete('/:id', validateIdParam(), c.deleteAnalysis);

module.exports = router;
