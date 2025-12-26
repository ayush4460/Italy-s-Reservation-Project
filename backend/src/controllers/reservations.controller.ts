import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: number };
}

// Get all slots (and create defaults if not exist for the day - simplified for now)
export const getSlots = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.userId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    const { date } = req.query; // Expecting YYYY-MM-DD
     
    // For this MVP, we will assume fixed slots for every day
    // In a real app, you'd query the Slot model. 
    // Here we return static time slots, but we will check bookings for them.
    
    // We actually need to fetch Reservations for the selected date to know which tables are booked in which slot.
    // Let's define some standard slots for simplicity if not using dynamic Slot model heavily yet.
    // Or better, let's use the Slot model as designed.
    
    // 1. Fetch defined slots for this restaurant
    // If no slots defined, maybe return defaults?
    let slots = await prisma.slot.findMany({
        where: { restaurantId }
    });

    if (slots.length === 0) {
        // Create default slots for the restaurant
        const defaults = [
            { startTime: '18:00', endTime: '19:00' },
            { startTime: '19:00', endTime: '20:00' },
            { startTime: '20:00', endTime: '21:00' },
            { startTime: '21:00', endTime: '22:00' },
        ];
        
        for (const s of defaults) {
           await prisma.slot.create({
               data: { ...s, restaurantId, isActive: true }
           });
        }
        slots = await prisma.slot.findMany({ where: { restaurantId } });
    }

    res.json(slots);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching slots', error });
  }
};

export const getReservations = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { date, slotId } = req.query;

        if (!date || !slotId) {
            return res.status(400).json({ message: 'Date and Slot ID required' });
        }

        const reservations = await prisma.reservation.findMany({
            where: {
                table: { restaurantId }, // Ensure it belongs to restaurant
                slotId: parseInt(slotId as string),
                // We need to filter by date. 
                // Since our schema has `date DateTime`, we need to match the day.
                // Prisma date filtering can be tricky with timezones.
                // We will assume the frontend sends a date string YYYY-MM-DD.
                date: {
                    gte: new Date(`${date}T00:00:00.000Z`),
                    lt: new Date(`${date}T23:59:59.999Z`),
                },
                status: { not: 'CANCELLED' }
            },
            include: {
                table: true
            }
        });

        res.json(reservations);
    } catch(error) {
        res.status(500).json({ message: 'Error fetching reservations', error });
    }
}

export const createReservation = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { tableId, slotId, date, customerName, contact, adults, kids, foodPref, specialReq } = req.body;

        // Verify table belongs to restaurant
        const table = await prisma.table.findFirst({
            where: { id: parseInt(tableId), restaurantId }
        });
        if (!table) return res.status(404).json({ message: 'Table not found' });

        // Check availability
        const existing = await prisma.reservation.findFirst({
            where: {
                tableId: parseInt(tableId),
                slotId: parseInt(slotId),
                date: new Date(date), // Exact match or range? Ideally range but simplified here
                status: { not: 'CANCELLED' }
            }
        });

        if (existing) {
            // Need to handle Date comparison carefully. 
            // For now assuming active unique constraint conceptually.
            // But let's just proceed.
             const reqDate = new Date(date).toISOString().split('T')[0];
             const exDate = new Date(existing.date).toISOString().split('T')[0];
             if (reqDate === exDate) {
                 return res.status(400).json({ message: 'Table already booked for this slot' });
             }
        }

        const reservation = await prisma.reservation.create({
            data: {
                tableId: parseInt(tableId),
                slotId: parseInt(slotId),
                date: new Date(date),
                customerName,
                contact,
                adults: parseInt(adults),
                kids: parseInt(kids),
                foodPref,
                specialReq,
                status: 'BOOKED'
            }
        });

        res.status(201).json(reservation);

    } catch (error) {
        res.status(500).json({ message: 'Error creating reservation', error });
    }
}
