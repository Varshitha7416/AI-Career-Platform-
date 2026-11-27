const express = require('express');
const router = express.Router();
const { listPrograms, getProgram, setEnrollment, myPrograms } = require('../controllers/programController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

router.get('/', listPrograms);
router.get('/mine', myPrograms); // fixed path must be declared before /:id
router.get('/:id', validateIdParam(), getProgram);
router.put('/:id/enrollment', validateIdParam(), setEnrollment);

module.exports = router;
