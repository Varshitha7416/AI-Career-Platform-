const express = require('express');
const router = express.Router();
const c = require('../controllers/referralController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

// Fixed paths first, then /:id
router.get('/providers', c.getProviders);
router.get('/companies', c.getCompanies);
router.get('/find', c.findReferrers);
router.get('/mine', c.getMyRequests);
router.get('/incoming', c.getIncomingRequests);
router.get('/summary', c.getSummary);
router.post('/', c.requestReferral);
router.get('/:id/resume', validateIdParam(), c.getReferralResume);
router.get('/:id', validateIdParam(), c.getReferral);
router.put('/:id/status', validateIdParam(), c.updateReferralStatus);
router.put('/:id', validateIdParam(), c.updateReferralStatus);

module.exports = router;
