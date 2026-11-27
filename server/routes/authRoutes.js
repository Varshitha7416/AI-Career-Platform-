const express = require('express');
const router = express.Router();
const { signup, login, getMe, getRoles, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { forgotPassword, resetPassword } = require('../controllers/passwordResetController');
const { verifyEmail, resendVerification, requestVerification } = require('../controllers/emailVerificationController');
const { loginByIp, loginByEmail, signupByIp, passwordChange, forgotByIp, resetByIp, verifyByIp, verifyRequestByIp } = require('../middleware/rateLimit');

router.post('/signup', signupByIp, signup);
router.post('/login', loginByIp, loginByEmail, login);
router.post('/forgot-password', forgotByIp, forgotPassword);
router.post('/reset-password', resetByIp, resetPassword);
router.post('/verify-email', verifyByIp, verifyEmail);
router.post('/verification/request', verifyRequestByIp, requestVerification);
router.post('/verification/resend', protect, verifyRequestByIp, resendVerification);
router.get('/me', protect, getMe);
router.get('/roles', protect, getRoles);
router.put('/profile', protect, passwordChange, updateProfile);

module.exports = router;
