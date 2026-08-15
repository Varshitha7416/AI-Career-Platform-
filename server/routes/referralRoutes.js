const express = require('express');
const router = express.Router();
const { findReferrers, requestReferral, updateReferralStatus } = require('../controllers/referralController');

router.get('/find', findReferrers);
router.post('/', requestReferral);
router.put('/:id', updateReferralStatus);

module.exports = router;