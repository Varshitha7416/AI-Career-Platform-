const express = require('express');
const router = express.Router();
const { createInterview, listInterviews, getInterview, updateInterview, deleteInterview } = require('../controllers/interviewController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

router.post('/', createInterview);
router.get('/', listInterviews);
router.get('/:id', validateIdParam(), getInterview);
router.put('/:id', validateIdParam(), updateInterview);
router.delete('/:id', validateIdParam(), deleteInterview);

module.exports = router;
