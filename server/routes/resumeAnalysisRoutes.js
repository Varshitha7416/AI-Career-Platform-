const express = require('express');
const router = express.Router();
const { analyzeResume, getAnalyses, getAnalysisById, deleteAnalysis } = require('../controllers/resumeAnalysisController');
const { compare, exportAnalysis } = require('../controllers/resumeHistoryController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');
const { aiLimiter } = require('../middleware/aiLimiter');

router.use(protect);

router.post('/', aiLimiter, analyzeResume);
router.get('/', getAnalyses);
router.get('/compare', compare); // fixed path before /:id
router.get('/:id/export', validateIdParam(), exportAnalysis);
router.get('/:id', validateIdParam(), getAnalysisById);
router.delete('/:id', validateIdParam(), deleteAnalysis);

module.exports = router;
