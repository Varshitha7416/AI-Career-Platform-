const express = require('express');
const router = express.Router();
const { saveJob, getSavedJobs } = require('../controllers/savedJobController');

router.post('/', saveJob);
router.get('/:userId', getSavedJobs);

module.exports = router;