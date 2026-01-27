import express from 'express';
import { requestReservation } from '../controllers/public.controller';

const router = express.Router();

router.post('/request-reservation', requestReservation);

export default router;
