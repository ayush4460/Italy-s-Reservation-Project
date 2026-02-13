import { Router } from 'express';
import { getSlotAvailability, updateSlotAvailability } from '../controllers/slot-availability.controller';
import { authenticateToken, authorizeRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getSlotAvailability);
router.post('/', authenticateToken, authorizeRole(['ADMIN']), updateSlotAvailability);

export default router;
