import { Router } from 'express';
import { handleGupshupWebhook } from '../controllers/webhook.controller';

const router = Router();

router.post('/gupshup', handleGupshupWebhook);

export default router;
