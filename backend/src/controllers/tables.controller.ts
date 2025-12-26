import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Add type for request with user (from middleware)
interface AuthRequest extends Request {
  user?: { userId: number };
}

export const getTables = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.userId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    const tables = await prisma.table.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: 'asc' }
    });
    res.json(tables);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tables', error });
  }
};

export const createTable = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.userId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

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

    res.status(201).json(table);
  } catch (error) {
    res.status(500).json({ message: 'Error creating table', error });
  }
};

export const deleteTable = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.userId;
    const tableId = parseInt(req.params.id);

    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    await prisma.table.deleteMany({
      where: {
        id: tableId,
        restaurantId // Ensure ownership
      }
    });

    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting table', error });
  }
};
