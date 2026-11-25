const express = require('express');
const router = express.Router();
const { applyToJob, getApplications, getMyApplications, getApplicationItem, updateApplicationStatus, deleteApplication } = require('../controllers/applicationController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

router.post('/', applyToJob);
router.get('/', getMyApplications);
// Fixed paths must be declared before '/:userId'
router.get('/item/:id', validateIdParam(), getApplicationItem);
router.get('/:userId', validateIdParam('userId'), getApplications);
router.put('/:id', validateIdParam(), updateApplicationStatus);
router.delete('/:id', validateIdParam(), deleteApplication);

module.exports = router;
