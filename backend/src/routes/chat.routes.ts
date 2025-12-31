import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { getChats, getMessages, sendMessage, markAsRead, sendTyping, sendTemplate, getUnreadCount } from '../controllers/chat.controller';

const router = Router();

router.get('/', authenticateToken, getChats);
router.get('/unread-count', authenticateToken, getUnreadCount);
router.get('/:phone', authenticateToken, getMessages);
router.post('/send', authenticateToken, sendMessage);
router.post('/typing', authenticateToken, sendTyping);
router.post('/template', authenticateToken, sendTemplate);
router.put('/:phone/read', authenticateToken, markAsRead);

export default router;
