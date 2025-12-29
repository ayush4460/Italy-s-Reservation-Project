import { Router } from 'express';
import { getSlots, getReservations, getTablesWithReservations, createReservation, createSlots, deleteSlot, updateReservation, cancelReservation, moveReservation, exportReservations } from '../controllers/reservations.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/slots', getSlots);
router.post('/slots', createSlots); // Manage slots
router.delete('/slots/:id', deleteSlot); // Delete slot

router.get('/', getReservations); // ?date=...&slotId=...
router.get('/availability', getTablesWithReservations); // NEW: Combined endpoint
router.get('/export', exportReservations); // New Export Endpoint
router.post('/', createReservation);
router.put('/:id', updateReservation);
router.put('/:id/move', moveReservation);
router.delete('/:id', cancelReservation);

export default router;
