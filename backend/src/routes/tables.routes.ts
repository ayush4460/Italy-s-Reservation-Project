import { Router } from 'express';
import { getTables, createTable, deleteTable } from '../controllers/tables.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
console.log('Tables routes loaded!');

// router.use(authenticateToken); // Protect all table routes
router.use((req, res, next) => {
    console.log('Tables route accessed:', req.method, req.path);
    next();
});

router.get('/', getTables);
router.post('/', createTable);
router.delete('/:id', deleteTable);

export default router;
