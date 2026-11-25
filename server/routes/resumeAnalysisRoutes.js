const express = require('express');
const router = express.Router();
const { analyzeResume, getAnalyses, getAnalysisById, deleteAnalysis } = require('../controllers/resumeAnalysisController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');
const { aiLimiter } = require('../middleware/aiLimiter');

router.use(protect);

router.post('/', aiLimiter, analyzeResume);
router.get('/', getAnalyses);
router.get('/:id', validateIdParam(), getAnalysisById);
router.delete('/:id', validateIdParam(), deleteAnalysis);

module.exports = router;
