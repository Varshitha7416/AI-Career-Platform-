const express = require('express');
const { protect, requireAdmin } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');
const c = require('../controllers/adminProgramController');

const router = express.Router();
// Backend-enforced: valid token AND database-backed admin role on every route.
router.use(protect, requireAdmin);

router.get('/', c.listPrograms);
router.get('/stats', c.getStats); // fixed paths before /:id
router.post('/', c.createProgram);
router.get('/:id', validateIdParam(), c.getProgram);
router.put('/:id', validateIdParam(), c.updateProgram);
router.put('/:id/state', validateIdParam(), c.setState);

module.exports = router;
