import { Router } from 'express';
import { getSlots, getReservations, createReservation } from '../controllers/reservations.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/slots', getSlots);
router.get('/', getReservations); // ?date=...&slotId=...
router.post('/', createReservation);

export default router;
