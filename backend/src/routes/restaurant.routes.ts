import { Router } from 'express';
import { getProfile, updateProfile, sendEmailChangeOtp } from '../controllers/restaurant.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.post('/email-otp/send', sendEmailChangeOtp);

export default router;
