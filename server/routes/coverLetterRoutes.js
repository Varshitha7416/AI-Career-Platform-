const express = require('express');
const router = express.Router();
const c = require('../controllers/coverLetterController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');
const { aiLimiter } = require('../middleware/aiLimiter');

router.use(protect);

router.post('/', aiLimiter, c.generateCoverLetter);
router.get('/', c.getCoverLetters);
router.get('/:id/download', validateIdParam(), c.downloadCoverLetter);
router.post('/:id/regenerate', validateIdParam(), aiLimiter, c.regenerateCoverLetter);
router.post('/:id/restore', validateIdParam(), c.restoreVersion);
router.get('/:id', validateIdParam(), c.getCoverLetterById);
router.put('/:id', validateIdParam(), c.updateCoverLetter);
router.delete('/:id', validateIdParam(), c.deleteCoverLetter);

module.exports = router;
