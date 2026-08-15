const express = require('express');
const router = express.Router();
const { generateCoverLetter } = require('../controllers/coverLetterController');

router.post('/', generateCoverLetter);

module.exports = router;