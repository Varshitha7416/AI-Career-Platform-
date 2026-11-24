const express = require('express');
const router = express.Router();
const { saveJob, getSavedJobs, unsaveJob } = require('../controllers/savedJobController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

router.post('/', saveJob);
router.get('/:userId', validateIdParam('userId'), getSavedJobs);
router.delete('/:jobId', validateIdParam('jobId'), unsaveJob);

module.exports = router;
