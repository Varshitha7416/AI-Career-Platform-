const express = require('express');
const router = express.Router();
const { applyToJob, getApplications, updateApplicationStatus } = require('../controllers/applicationController');

router.post('/', applyToJob);
router.get('/:userId', getApplications);
router.put('/:id', updateApplicationStatus);

module.exports = router;