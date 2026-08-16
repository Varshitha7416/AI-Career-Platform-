const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createResume } = require('../controllers/resumeController');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('resumeFile'), createResume);

module.exports = router;