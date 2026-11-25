const express = require('express');
const router = express.Router();
const { getNotifications, markRead, markAllRead, deleteNotification } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { validateIdParam } = require('../middleware/validate');

router.use(protect);

router.get('/', getNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', validateIdParam(), markRead);
router.delete('/:id', validateIdParam(), deleteNotification);

module.exports = router;
