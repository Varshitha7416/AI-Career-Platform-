const express = require('express');
const router = express.Router();
const { analyzeResume, getAnalyses, getAnalysisById } = require('../controllers/resumeAnalysisController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

router.post('/', analyzeResume);
router.get('/', getAnalyses);
router.get('/:id', validateIdParam(), getAnalysisById);

module.exports = router;
