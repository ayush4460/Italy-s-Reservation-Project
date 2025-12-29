import { Router } from 'express';
import { getTables, createTable, deleteTable, updateTable } from '../controllers/tables.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Debug log removed
router.use(authenticateToken);

router.get('/', getTables);
router.post('/', createTable);
router.put('/:id', updateTable); // Edit Table
router.delete('/:id', deleteTable);

export default router;
