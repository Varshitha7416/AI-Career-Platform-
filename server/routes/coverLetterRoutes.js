const express = require('express');
const router = express.Router();
const { generateCoverLetter, getCoverLetters, getCoverLetterById } = require('../controllers/coverLetterController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

router.post('/', generateCoverLetter);
router.get('/', getCoverLetters);
router.get('/:id', validateIdParam(), getCoverLetterById);

module.exports = router;
