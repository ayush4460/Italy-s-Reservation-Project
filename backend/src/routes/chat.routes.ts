import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { getChats, getMessages, sendMessage, sendImage, markAsRead, sendTyping, sendTemplate, getUnreadCount } from '../controllers/chat.controller';
import multer from 'multer';
import path from 'path';

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (JPEG, JPG, PNG) are allowed'));
  }
});

const router = Router();

router.get('/', authenticateToken, getChats);
router.get('/unread-count', authenticateToken, getUnreadCount);
router.get('/:phone', authenticateToken, getMessages);
router.post('/send', authenticateToken, sendMessage);
router.post('/send-image', authenticateToken, upload.single('image'), sendImage);
router.post('/typing', authenticateToken, sendTyping);
router.post('/template', authenticateToken, sendTemplate);
router.put('/:phone/read', authenticateToken, markAsRead);

export default router;
