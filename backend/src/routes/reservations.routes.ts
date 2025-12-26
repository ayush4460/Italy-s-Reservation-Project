import { Router } from 'express';
import { getSlots, getReservations, createReservation, createSlots, deleteSlot, updateReservation, cancelReservation } from '../controllers/reservations.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/slots', getSlots);
router.post('/slots', createSlots); // Manage slots
router.delete('/slots/:id', deleteSlot); // Delete slot

router.get('/', getReservations); // ?date=...&slotId=...
router.post('/', createReservation);
router.put('/:id', updateReservation);
router.delete('/:id', cancelReservation);

export default router;
