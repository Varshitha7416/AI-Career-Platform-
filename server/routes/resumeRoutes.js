const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createResume, getResumes, updateResume, deleteResume, previewResume } = require('../controllers/resumeController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/\.(pdf|docx|txt)$/i.test(file.originalname || '')) {
      const err = new Error('Only PDF, DOCX and TXT files are supported.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

router.use(protect);

router.get('/', getResumes);
router.post('/', upload.single('resumeFile'), createResume);
router.get('/:id/preview', validateIdParam(), previewResume);
router.put('/:id', validateIdParam(), updateResume);
router.delete('/:id', validateIdParam(), deleteResume);

module.exports = router;
