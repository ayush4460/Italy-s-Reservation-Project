import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: number };
}

// Get slots for a specific date or all slots
export const getSlots = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.userId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    const { date, all } = req.query; 

    let whereClause: any = { restaurantId, isActive: true };

    if (all === 'true') {
        // Fetch all slots
    } else if (date) {
        const dateObj = new Date(date as string);
        const dayOfWeek = dateObj.getDay(); 
        whereClause.OR = [
            { dayOfWeek: dayOfWeek },
            { date: dateObj }
        ];
    } else {
        // Default to today if nothing provided? Or return empty?
         // For now require date if not all
         return res.status(400).json({ message: 'Date or all=true required' });
    }

    const slots = await prisma.slot.findMany({
        where: whereClause,
        orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' }
        ]
    });

    res.json(slots);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ message: 'Error fetching slots', error });
  }
};

// Create new slots (bulk for multiple days)
export const createSlots = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { startTime, endTime, days } = req.body; 
        // days: number[] (0-6)
        
        if (!days || !Array.isArray(days) || days.length === 0) {
            return res.status(400).json({ message: 'Select at least one day' });
        }

        const newSlots = [];
        for (const day of days) {
            // Check if slot already exists for this time and day? 
            // For now, let's allow overlapping or just create diverse ones.
            // Ideally avoid duplicates
             const created = await prisma.slot.create({
                data: {
                    restaurantId,
                    startTime,
                    endTime,
                    dayOfWeek: day,
                    isActive: true
                }
            });
            newSlots.push(created);
        }

        res.status(201).json(newSlots);

    } catch(error) {
         console.error('Error creating slots:', error);
        res.status(500).json({ message: 'Error creating slots', error });
    }
}

export const deleteSlot = async (req: AuthRequest, res: Response) => {
     try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { id } = req.params;

        // Verify ownership
        const slot = await prisma.slot.findFirst({
            where: { id: parseInt(id), restaurantId }
        });

        if (!slot) return res.status(404).json({ message: 'Slot not found' });

        // Check if there are active bookings? Maybe warn?
        // For MVP, just delete
        await prisma.slot.delete({
            where: { id: parseInt(id) }
        });

        res.json({ message: 'Slot deleted successfully' });

    } catch(error) {
         console.error('Error deleting slot:', error);
        res.status(500).json({ message: 'Error deleting slot', error });
    }
}

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
                 // Ensure slot also belongs to restaurant indirectly? yes via schema relations usually, but strict check is good.
                status: 'BOOKED'
            }
        });

        res.status(201).json(reservation);

    } catch (error) {
        res.status(500).json({ message: 'Error creating reservation', error });
    }
}
// Update Reservation
export const updateReservation = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { id } = req.params;
        const { customerName, contact, adults, kids, foodPref, specialReq } = req.body;

        const reservation = await prisma.reservation.findFirst({
            where: { id: parseInt(id), table: { restaurantId } }
        });

        if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

        const updated = await prisma.reservation.update({
            where: { id: parseInt(id) },
            data: {
                customerName,
                contact,
                adults: parseInt(adults),
                kids: parseInt(kids),
                foodPref, 
                specialReq
            }
        });

        res.json(updated);

    } catch (error) {
        console.error('Error updating reservation:', error);
        res.status(500).json({ message: 'Error updating reservation', error });
    }
}

// Cancel Reservation
export const cancelReservation = async (req: AuthRequest, res: Response) => {
     try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { id } = req.params;

        const reservation = await prisma.reservation.findFirst({
            where: { id: parseInt(id), table: { restaurantId } }
        });

        if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

        // Option 1: Hard Delete
        // await prisma.reservation.delete({ where: { id: parseInt(id) } });

        // Option 2: Soft Delete (Status = CANCELLED) -> Better for records
        await prisma.reservation.update({
            where: { id: parseInt(id) },
            data: { status: 'CANCELLED' }
        });

        res.json({ message: 'Reservation cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling reservation:', error);
        res.status(500).json({ message: 'Error cancelling reservation', error });
    }
}
