const express = require('express');
const router = express.Router();
const { createMessage } = require('../controllers/contactController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', createMessage);

module.exports = router;
