const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createResume, getResumes } = require('../controllers/resumeController');
const { protect } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      const err = new Error('Only PDF files are allowed');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.use(protect);

router.get('/', getResumes);
router.post('/', upload.single('resumeFile'), createResume);

module.exports = router;
