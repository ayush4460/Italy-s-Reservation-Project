import { Router } from 'express';
import { getStaff, createStaff, deleteStaff, updateStaff, sendStaffOtp, sendStaffEmailChangeOtp } from '../controllers/staff.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getStaff);
router.post('/', authenticateToken, createStaff);
router.post('/otp/send', authenticateToken, sendStaffOtp);
router.post('/email-change-otp/send', authenticateToken, sendStaffEmailChangeOtp);
router.put('/:id', authenticateToken, updateStaff); 
router.delete('/:id', authenticateToken, deleteStaff);

export default router;
