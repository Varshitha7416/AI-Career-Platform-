const express = require('express');
const router = express.Router();
const { signup, login, getMe, getRoles, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { loginByIp, loginByEmail, signupByIp, passwordChange } = require('../middleware/rateLimit');

router.post('/signup', signupByIp, signup);
router.post('/login', loginByIp, loginByEmail, login);
router.get('/me', protect, getMe);
router.get('/roles', protect, getRoles);
router.put('/profile', protect, passwordChange, updateProfile);

module.exports = router;
