const express = require('express');
const { protect, requireAdmin } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');
const c = require('../controllers/adminSupportController');

const router = express.Router();
router.use(protect, requireAdmin);

router.get('/counts', c.counts);
router.get('/', c.list);
router.get('/:id', validateIdParam(), c.getOne);
router.put('/:id/status', validateIdParam(), c.setStatus);
router.put('/:id/assignee', validateIdParam(), c.setAssignee);
router.post('/:id/notes', validateIdParam(), c.addNote);
router.post('/:id/responses', validateIdParam(), c.respond);

module.exports = router;
