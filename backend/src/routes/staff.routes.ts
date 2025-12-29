import { Router } from 'express';
import { getStaff, createStaff, deleteStaff, updateStaff } from '../controllers/staff.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, getStaff);
router.post('/', authenticateToken, createStaff);
router.put('/:id', authenticateToken, updateStaff); 
router.delete('/:id', authenticateToken, deleteStaff);

export default router;
