const express = require('express');
const router = express.Router();
const { analyzeResume } = require('../controllers/resumeAnalysisController');

router.post('/', analyzeResume);

module.exports = router;