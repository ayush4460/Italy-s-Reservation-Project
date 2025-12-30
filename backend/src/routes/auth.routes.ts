import { Router } from 'express';
import { signup, login, getMe, forgotPassword, resetPassword, sendLoginOtp, verifyLoginOtp, sendSignupOtp } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { 
    validate, 
    signupSchema, 
    loginSchema, 
    emailSchema, 
    resetPasswordSchema, 
    sendSignupOtpSchema,
    verifyOtpSchema
} from '../middleware/validation.middleware';

const router = Router();

router.post('/signup', validate(signupSchema), signup);
router.post('/signup-otp/send', validate(sendSignupOtpSchema), sendSignupOtp);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', validate(emailSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.post('/login-otp/send', validate(emailSchema), sendLoginOtp);
router.post('/login-otp/verify', validate(verifyOtpSchema), verifyLoginOtp);
router.get('/me', authenticateToken, getMe);

export default router;
