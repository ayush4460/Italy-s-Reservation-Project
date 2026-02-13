import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { clearDashboardCache } from '../utils/cache';

interface AuthRequest extends Request {
  user?: { userId: number; role?: string; restaurantId?: number };
}

export const getSlotAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date is required' });

    const dateObj = new Date(date as string);
    // Start and end of the targeted day in UTC/ISO
    const startOfDay = new Date(dateObj);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const availabilities = await prisma.slotAvailability.findMany({
      where: {
        restaurantId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    res.json(availabilities);
  } catch (error) {
    console.error('Error fetching slot availability:', error);
    res.status(500).json({ message: 'Error fetching availability', error });
  }
};

export const updateSlotAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });
    if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

    const { slotId, date, isSlotDisabled, isIndoorDisabled, isOutdoorDisabled } = req.body;

    if (!slotId || !date) {
      return res.status(400).json({ message: 'Slot ID and Date are required' });
    }

    const dateObj = new Date(date);
    dateObj.setUTCHours(0, 0, 0, 0);

    const availability = await prisma.slotAvailability.upsert({
      where: {
        slotId_date: {
          slotId: parseInt(slotId),
          date: dateObj,
        },
      },
      update: {
        isSlotDisabled: isSlotDisabled ?? false,
        isIndoorDisabled: isIndoorDisabled ?? false,
        isOutdoorDisabled: isOutdoorDisabled ?? false,
      },
      create: {
        restaurantId,
        slotId: parseInt(slotId),
        date: dateObj,
        isSlotDisabled: isSlotDisabled ?? false,
        isIndoorDisabled: isIndoorDisabled ?? false,
        isOutdoorDisabled: isOutdoorDisabled ?? false,
      },
    });

    // Invalidate dashboard cache as availability affects booking states
    await clearDashboardCache(restaurantId);

    res.json(availability);
  } catch (error) {
    console.error('Error updating slot availability:', error);
    res.status(500).json({ message: 'Error updating availability', error });
  }
};
