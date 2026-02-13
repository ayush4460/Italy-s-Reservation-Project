import express from 'express';
import { requestReservation, getPublicSlots } from '../controllers/public.controller';

const router = express.Router();

router.post('/request-reservation', requestReservation);
router.get('/slots', getPublicSlots);

export default router;
