const express = require('express');
const router = express.Router();
const { applyToJob, getApplications, updateApplicationStatus, deleteApplication } = require('../controllers/applicationController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

router.post('/', applyToJob);
router.get('/:userId', validateIdParam('userId'), getApplications);
router.put('/:id', validateIdParam(), updateApplicationStatus);
router.delete('/:id', validateIdParam(), deleteApplication);

module.exports = router;
