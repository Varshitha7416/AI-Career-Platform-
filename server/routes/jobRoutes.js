const express = require('express');
const router = express.Router();

const { createJob, getJobs, getJobById, updateJob, deleteJob } = require('../controllers/jobController');
const { protect, requireAdmin } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.get('/', protect, getJobs);
router.get('/:id', protect, validateIdParam(), getJobById);
router.post('/', protect, requireAdmin, createJob);
router.put('/:id', protect, requireAdmin, validateIdParam(), updateJob);
router.delete('/:id', protect, requireAdmin, validateIdParam(), deleteJob);

module.exports = router;
