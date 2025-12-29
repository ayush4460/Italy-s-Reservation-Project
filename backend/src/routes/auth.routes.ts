import { Router } from 'express';
import { signup, login, getMe, forgotPassword, resetPassword, sendLoginOtp, verifyLoginOtp } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/login-otp/send', sendLoginOtp);
router.post('/login-otp/verify', verifyLoginOtp);
router.get('/me', authenticateToken, getMe);

export default router;
