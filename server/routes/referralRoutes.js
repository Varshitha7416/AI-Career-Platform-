const express = require('express');
const router = express.Router();
const { findReferrers, requestReferral, getMyRequests, getIncomingRequests, updateReferralStatus } = require('../controllers/referralController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

router.get('/find', findReferrers);
router.get('/mine', getMyRequests);
router.get('/incoming', getIncomingRequests);
router.post('/', requestReferral);
router.put('/:id', validateIdParam(), updateReferralStatus);

module.exports = router;
