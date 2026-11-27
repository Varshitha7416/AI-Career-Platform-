const express = require('express');
const router = express.Router();
const { createMessage, listMine, getMine } = require('../controllers/contactController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/', createMessage);
router.get('/', listMine);
router.get('/:id', getMine);

module.exports = router;
