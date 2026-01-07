import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import redis from '../lib/redis';

// Helper to invalidate dashboard cache
const invalidateDashboardStats = async (restaurantId: number) => {
  try {
    const keys = await redis.keys(`dashboard:stats:v10:${restaurantId}:*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

// Add type for request with user (from middleware)
// Add type for request with user (from middleware)
interface AuthRequest extends Request {
  user?: { userId: number; role?: string; restaurantId?: number };
}

export const getTables = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    const tables = await prisma.table.findMany({
      where: { restaurantId },
      // Remove DB-level sorting as it's string-based (1, 10, 2)
      // orderBy: { tableNumber: 'asc' } 
    });

    // Sort numerically in JavaScript
    tables.sort((a, b) => {
        return a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tables', error });
  }
};

export const createTable = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    // Restrict creation to ADMIN
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Admins only' });
    }
    
    const { tableNumber, capacity } = req.body;
    
    // Check if table number exists
    const existing = await prisma.table.findFirst({
        where: { restaurantId, tableNumber }
    });

    if (existing) {
        return res.status(400).json({ message: 'Table number already exists' });
    }

    const table = await prisma.table.create({
      data: {
        restaurantId,
        tableNumber,
        capacity: parseInt(capacity)
      }
    });

    // Invalidate cache
    await invalidateDashboardStats(restaurantId);

    res.status(201).json(table);
  } catch (error) {
    res.status(500).json({ message: 'Error creating table', error });
  }
};

export const updateTable = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        // Restrict update to ADMIN
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Forbidden: Admins only' });
        }
        
        const { id } = req.params;
        const { tableNumber, capacity } = req.body;

        // 1. Check if table exists
        const existingTable = await prisma.table.findFirst({
            where: { id: parseInt(id), restaurantId }
        });

        if (!existingTable) return res.status(404).json({ message: 'Table not found' });

        // 2. Check for Unique Table Number (if changed)
        if (tableNumber && tableNumber !== existingTable.tableNumber) {
            const duplicate = await prisma.table.findFirst({
                where: { restaurantId, tableNumber }
            });
            if (duplicate) {
                return res.status(400).json({ message: 'Table number already exists' });
            }
        }

        // 3. Update
        const updatedTable = await prisma.table.update({
            where: { id: parseInt(id) },
            data: {
                tableNumber: tableNumber || undefined,
                capacity: capacity ? parseInt(capacity) : undefined
            }
        });

        // Invalidate cache
        await invalidateDashboardStats(restaurantId);

        res.json(updatedTable);

    } catch (error) {
        console.error('Error updating table:', error);
        res.status(500).json({ message: 'Error updating table', error });
    }
}

export const deleteTable = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.restaurantId;
    const tableId = parseInt(req.params.id);

    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    // Restrict delete to ADMIN
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

    await prisma.table.deleteMany({
      where: {
        id: tableId,
        restaurantId // Ensure ownership
      }
    });

    // Invalidate cache
    await invalidateDashboardStats(restaurantId);

    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting table', error });
  }
};
