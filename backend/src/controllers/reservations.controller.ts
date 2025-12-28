import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import redis from '../lib/redis';
import { sendWhatsAppMessage, sendReservationTemplate } from '../lib/whatsapp';

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

        // Invalidate Dashboard Stats Cache
        // We need to invalidate for the specific date of the reservation
        const dateKey = new Date(date).toISOString().split('T')[0];
        const cacheKey = `dashboard:stats:v4:${restaurantId}:${dateKey}`;
        try {
            await redis.del(cacheKey);
        } catch (e) { console.warn("Redis Invalidate Error (Ignored):", e); }

        // Send WhatsApp Notification
        console.log(`[CreateReservation] Contact: ${contact}, SlotId: ${slotId}`);
        if (contact) {
            try {
                // Fetch slot time for message
                const slotObj = await prisma.slot.findUnique({
                    where: { id: parseInt(slotId) }
                });
                
                if (slotObj) {
                    // Use Template: Variable 1 = Date, Variable 2 = Time
                    // dateKey is typically YYYY-MM-DD. Let's format nicely if possible, or pass as is.
                    // The template example showed "12/1", so maybe MM/DD format is desired?
                    // Let's rely on dateKey (YYYY-MM-DD) for clarity first, or format it.
                    // Formatting YYYY-MM-DD to DD/MM
                    const [year, month, day] = dateKey.split('-');
                    const formattedDate = `${day}/${month}`;
                    
                    // Auto-format phone number: assume +91 if 10 digits provided
                    let formattedContact = contact.trim();
                    if (/^\d{10}$/.test(formattedContact)) {
                        formattedContact = '+91' + formattedContact;
                    }
                    
                    const textBody = `Hello ${customerName}, your table reservation is confirmed for ${formattedDate} at ${slotObj.startTime}. Please arrive 15 min early.`;
                    
                    const testTarget = 'whatsapp:+917878065085';
                    console.log(`[CreateReservation] Sending Text to HARDCODED ${testTarget}: ${textBody}`);
                    await sendWhatsAppMessage(testTarget, textBody);
                } else {
                     console.warn("[CreateReservation] Slot object not found for WhatsApp message");
                }
            } catch (err) {
               console.error("Failed to send WhatsApp:", err);
            }
        } else {
             console.log("[CreateReservation] No contact number provided, skipping WhatsApp");
        }

        res.status(201).json(reservation);

    } catch (error) {
        res.status(500).json({ message: 'Error creating reservation', error });
    }
}
// Move Reservation
export const moveReservation = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { id } = req.params;
        const { newTableId } = req.body;

        if (!newTableId) {
            return res.status(400).json({ message: 'New Table ID is required' });
        }

        // 1. Get current reservation
        const reservation = await prisma.reservation.findFirst({
            where: { id: parseInt(id), table: { restaurantId } }
        });

        if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

        // 2. Verify new table exists and belongs to restaurant
        const newTable = await prisma.table.findFirst({
            where: { id: parseInt(newTableId), restaurantId }
        });

        if (!newTable) return res.status(404).json({ message: 'Target table not found' });

        // 3. Check if new table is available for the same slot and date
        const existing = await prisma.reservation.findFirst({
            where: {
                tableId: parseInt(newTableId),
                slotId: reservation.slotId, // Same slot
                date: reservation.date,     // Same date
                status: { not: 'CANCELLED' }
            }
        });

        if (existing) {
             return res.status(400).json({ message: 'Target table is already booked for this slot' });
        }

        // 4. Update reservation
        const updated = await prisma.reservation.update({
            where: { id: parseInt(id) },
            data: {
                tableId: parseInt(newTableId)
            }
        });

        // 5. Invalidate Cache
        const dateKey = new Date(reservation.date).toISOString().split('T')[0];
        const cacheKey = `dashboard:stats:v4:${restaurantId}:${dateKey}`;
        try {
            await redis.del(cacheKey);
        } catch (e) { console.warn("Redis Invalidate Error (Ignored):", e); }

        res.json(updated);

    } catch (error) {
        console.error('Error moving reservation:', error);
        res.status(500).json({ message: 'Error moving reservation', error });
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

        // Invalidate Cache
        const dateKey = new Date(reservation.date).toISOString().split('T')[0];
        const cacheKey = `dashboard:stats:${restaurantId}:${dateKey}`;
        try {
            await redis.del(cacheKey);
        } catch (e) { console.warn("Redis Invalidate Error (Ignored):", e); }

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

        // Invalidate Cache
        const dateKey = new Date(reservation.date).toISOString().split('T')[0];
        const cacheKey = `dashboard:stats:${restaurantId}:${dateKey}`;
        try {
            await redis.del(cacheKey);
        } catch (e) { console.warn("Redis Invalidate Error (Ignored):", e); }

        res.json({ message: 'Reservation cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling reservation:', error);
        res.status(500).json({ message: 'Error cancelling reservation', error });
    }
}
