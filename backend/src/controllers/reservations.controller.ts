import { Request, Response } from 'express';

import ExcelJS from 'exceljs';
import redis from '../lib/redis';
import { getIO } from '../lib/socket';
import { commonReservationMapper, sendSmartWhatsAppTemplate } from '../lib/whatsapp';

const clearDashboardCache = async (restaurantId: number, date: Date | string) => {
    try {
        const dateKey = typeof date === 'string' ? date : date.toISOString().split('T')[0];
        // The dashboard cache key is complex: dashboard:stats:v10:restaurantId:dateKey:chartStart:chartEnd
        // We need to clear all keys for this restaurant that might contain stats for this day.
        // Easiest is to clear all dashboard:stats:v10:restaurantId:*
        const pattern = `dashboard:stats:v10:${restaurantId}:*`;
        
        let cursor = '0';
        do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys.length > 0) {
                await redis.del(...keys);
            }
        } while (cursor !== '0');
        
        console.log(`[Cache] Cleared dashboard stats for restaurant ${restaurantId}`);
    } catch (err) {
        console.warn("Redis Clear Cache Error (Ignored):", err);
    }
};


import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: { userId: number; role?: string; restaurantId?: number };
}

// Get slots for a specific date or all slots
export const getSlots = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.restaurantId;
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
         return res.status(400).json({ message: 'Date or all=true required' });
    }

    const slots = await prisma.slot.findMany({
        where: whereClause,
        orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' }
        ]
    });

    if (date && all !== 'true') {
        const startOfDay = new Date(date as string); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date as string); endOfDay.setHours(23, 59, 59, 999);

        // Fetch all non-cancelled reservations for this day
        const reservations = await prisma.reservation.findMany({
            where: {
                table: { restaurantId },
                date: {
                    gte: startOfDay,
                    lt: endOfDay,
                },
                status: { not: 'CANCELLED' }
            },
            select: { slotId: true, tableId: true, groupId: true, id: true }
        });

        // Map counts to slots
        const slotsWithCounts = slots.map(slot => {
            const slotReservations = reservations.filter(r => r.slotId === slot.id);
            
            // Count unique bookings (Unified Group or Single Table)
            const uniqueBookings = new Set();
            slotReservations.forEach(r => {
                if (r.groupId) {
                    uniqueBookings.add(r.groupId);
                } else {
                    uniqueBookings.add(`RES-${r.id}`);
                }
            });

            return { ...slot, reservedCount: uniqueBookings.size };
        });

        return res.json(slotsWithCounts);
    }

    res.json(slots);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ message: 'Error fetching slots', error });
  }
};

// Create new slots (bulk for multiple days)
export const createSlots = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

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
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

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


// Get Tables WITH Reservations for a specific slot (Merged Endpoint)
export const getTablesWithReservations = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { date, slotId } = req.query;

        if (!date || !slotId) {
            return res.status(400).json({ message: 'Date and Slot ID required' });
        }

        const dateObj = new Date(date as string);
        const startOfDay = new Date(dateObj); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateObj); endOfDay.setHours(23, 59, 59, 999);

        // Run queries in parallel
        const [tables, reservations] = await Promise.all([
            prisma.table.findMany({
                where: { restaurantId }
            }),
            prisma.reservation.findMany({
                where: {
                    table: { restaurantId },
                    slotId: parseInt(slotId as string),
                    date: {
                        gte: startOfDay,
                        lt: endOfDay,
                    },
                    status: { not: 'CANCELLED' }
                },
                include: {
                    table: true
                }
            })
        ]);

        // Sort tables numerically
        tables.sort((a, b) => {
            return a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: 'base' });
        });

        res.json({ tables, reservations });

    } catch(error) {
        console.error('Error fetching tables with reservations:', error);
        res.status(500).json({ message: 'Error fetching data', error });
    }
}

export const getReservations = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
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
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

         if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden: Staff cannot book' });

        const { tableId, slotId, date, customerName, contact, adults, kids, foodPref, specialReq, mergeTableIds } = req.body;

        // Combine all table IDs (main + merged)
        const allTableIds = [parseInt(tableId)];
        if (mergeTableIds && Array.isArray(mergeTableIds)) {
            mergeTableIds.forEach((id: any) => allTableIds.push(parseInt(id)));
        }

        // 1. Verify all tables belong to restaurant
        const tables = await prisma.table.findMany({
            where: {
                id: { in: allTableIds },
                restaurantId
            }
        });

        if (tables.length !== allTableIds.length) {
            return res.status(404).json({ message: 'One or more tables not found' });
        }

        // 2. Check Capacity (Combined)
        const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
        const totalGuests = parseInt(adults) + parseInt(kids);

        if (totalGuests > totalCapacity) {
             return res.status(400).json({ message: `Total guests (${totalGuests}) exceeds combined capacity (${totalCapacity})` });
        }

        // 3. Check Availability for ALL tables
        const dateObj = new Date(date);
        const existing = await prisma.reservation.findFirst({
            where: {
                tableId: { in: allTableIds },
                slotId: parseInt(slotId),
                date: dateObj,
                status: { not: 'CANCELLED' }
            }
        });

        if (existing) {
             return res.status(400).json({ message: 'One or more tables already booked for this slot' });
        }

        // 4. Generate Group ID if merging
        const groupId = allTableIds.length > 1 ? `GRP-${Date.now()}-${Math.floor(Math.random() * 1000)}` : null;

        // 5. Create Reservations (Transaction ideally, but loop is okay for MVP)
        const createdReservations = [];
        
        // We'll optimize with a transaction if possible, but let's just loop for now or use createMany if data identical?
        // Data is identical except tableId. createMany doesn't support relation connections easily in all cases, but here it's simple fields.
        // However, we need 'slot' relation? No, slotId is just an int field usually.
        // Let's use loop to be safe with individual record creation or Promise.all

        await prisma.$transaction(
            allTableIds.map(tid => 
                prisma.reservation.create({
                    data: {
                        tableId: tid,
                        slotId: parseInt(slotId),
                        date: dateObj,
                        customerName,
                        contact,
                        adults: parseInt(adults), // We store full count on all? Or split? User said "same member details". Usually full count implies redundant info, but fine for display.
                        // Or should we split guests? "4 members to table 2 and 2 members to table 3".
                        // The user said "in dashboard... show table 1+2+3 are merged with same member details".
                        // So arguably we just duplicate the reservation info.
                        kids: parseInt(kids), 
                        foodPref,
                        specialReq,
                        groupId,
                        status: 'BOOKED'
                    }
                })
            )
        );

        // Invalidate Dashboard Stats Cache
        await clearDashboardCache(restaurantId, date);

        // Send WhatsApp Notification (Only once)
        // Send WhatsApp Notification (Centralized)
        try {
           console.log(`[CreateReservation] Sending Gupshup msg to ${contact}`);
           if (contact) {
                const slotObj = await prisma.slot.findUnique({ where: { id: parseInt(slotId) } });
                
                // Prepare data object for mapper
                const notificationData = {
                    customerName,
                    date: dateObj, // Date object or string
                    slot: slotObj, // Contains startTime, endTime
                    adults,
                    kids,
                    contact,
                    foodPref
                };

                 const { sendWhatsappNotification } = await import('../lib/whatsapp');
                 
                 // Use type from body (passed from frontend) OR fallback to default
                 const typeToSend = req.body.notificationType || 'RESERVATION_CONFIRMATION';
                 
                 await sendWhatsappNotification(contact, typeToSend, notificationData);
           }
        } catch (e) {
            console.error("Error sending Gupshup message:", e);
        }

        // Emit socket event
        try {
            getIO().to(`restaurant_${restaurantId}`).emit('reservation:update', {
                date: dateObj.toISOString().split('T')[0],
                slotId: parseInt(slotId)
            });
        } catch (err) {
            console.error("Socket emit failed", err);
        }

        res.status(201).json({ message: 'Reservation created', groupId });

    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ message: 'Error creating reservation', error });
    }
}
// Move Reservation (Smart Move)
export const moveReservation = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

        const { id } = req.params;
        const { newTableIds } = req.body; // Expect array of table IDs

        if (!newTableIds || !Array.isArray(newTableIds) || newTableIds.length === 0) {
            return res.status(400).json({ message: 'New Table IDs are required' });
        }

        // 1. Get current reservation (to find group)
        const currentRes = await prisma.reservation.findFirst({
            where: { id: parseInt(id), table: { restaurantId } }
        });

        if (!currentRes) return res.status(404).json({ message: 'Reservation not found' });

        // 2. Identify all "Old" reservations (if grouped)
        let oldReservations = [currentRes];
        if (currentRes.groupId) {
            oldReservations = await prisma.reservation.findMany({
                where: { groupId: currentRes.groupId, table: { restaurantId } }
            });
        }

        // 3. Verify New Tables (Existence & Ownership)
        const newTables = await prisma.table.findMany({
            where: {
                id: { in: newTableIds },
                restaurantId
            }
        });

        if (newTables.length !== newTableIds.length) {
            return res.status(404).json({ message: 'One or more target tables not found' });
        }

        // 4. Validate Capacity
        // Use guest count from the *primary* old reservation (assuming duplicated info)
        const totalGuests = (currentRes.adults || 0) + (currentRes.kids || 0);
        const newTotalCapacity = newTables.reduce((sum, t) => sum + t.capacity, 0);

        if (totalGuests > newTotalCapacity) {
             return res.status(400).json({ 
                 message: `Capacity insufficient. Guests: ${totalGuests}, Target Capacity: ${newTotalCapacity}` 
             });
        }

        // 5. Check Availability of New Tables
        // (Must not be booked in same slot/date, EXCLUDING the current reservations if we supported moving to subset, 
        // but here we assume moving to *completely different* tables usually. 
        // If moving to overlapping tables, we'd need to be careful. 
        // Simple check: Is anyone ELSE sitting there?)
        
        const oldTableIds = oldReservations.map(r => r.tableId);
        
        const conflicts = await prisma.reservation.findFirst({
            where: {
                tableId: { in: newTableIds },
                slotId: currentRes.slotId,
                date: currentRes.date,
                status: { not: 'CANCELLED' },
                // AND NOT in oldTableIds? 
                // If I am moving from T1->T1 (silly) or T1->T1+T2. 
                // Any table in 'newTableIds' that is ALSO in 'oldTableIds' is technically "available" because we are about to free it.
                // So strictly we check if there is a reservation on newTableId that is NOT in [oldReservationIds]
                id: { notIn: oldReservations.map(r => r.id) } 
            }
        });

        if (conflicts) {
             return res.status(400).json({ message: 'One or more target tables are already booked by another customer' });
        }

        // 6. Execute Move (Transaction)
        // Strategy: Delete Old -> Create New (Cleanest for Group Logic)
        
        // Prepare Group ID
        const newGroupId = newTables.length > 1 
            ? `GRP-${Date.now()}-${Math.floor(Math.random() * 1000)}` 
            : null;

        await prisma.$transaction(async (tx) => {
            // A. Delete Old
            // We use deleteMany with IDs
            await tx.reservation.deleteMany({
                where: {
                    id: { in: oldReservations.map(r => r.id) }
                }
            });

            // B. Create New
            for (const table of newTables) {
                await tx.reservation.create({
                    data: {
                        tableId: table.id,
                        slotId: currentRes.slotId,
                        date: currentRes.date,
                        customerName: currentRes.customerName,
                        contact: currentRes.contact,
                        adults: currentRes.adults,
                        kids: currentRes.kids,
                        foodPref: currentRes.foodPref,
                        specialReq: currentRes.specialReq,
                        status: 'BOOKED', // or keep old status?
                        groupId: newGroupId
                    }
                });
            }
        });

        // 7. Invalidate Cache
        await clearDashboardCache(restaurantId, currentRes.date);

        // Emit socket event
        try {
            getIO().to(`restaurant_${restaurantId}`).emit('reservation:update', {
                date: currentRes.date.toISOString().split('T')[0],
                slotId: currentRes.slotId
            });
        } catch (err) {
            console.error("Socket emit failed", err);
        }

        res.json({ message: 'Reservation moved successfully' });

    } catch (error) {
        console.error('Error moving reservation:', error);
        res.status(500).json({ message: 'Error moving reservation', error });
    }
}

// Update Reservation
export const updateReservation = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

        const { id } = req.params;
        const { customerName, contact, adults, kids, foodPref, specialReq } = req.body;

        const reservation = await prisma.reservation.findFirst({
            where: { id: parseInt(id), table: { restaurantId } }
        });

        if (!reservation) return res.status(404).json({ message: 'Reservation not found' });

        let updated;
        if (reservation.groupId) {
             updated = await prisma.reservation.updateMany({
                where: { groupId: reservation.groupId },
                data: {
                    customerName,
                    contact,
                    adults: parseInt(adults),
                    kids: parseInt(kids),
                    foodPref,
                    specialReq
                }
            });
            // updateMany returns { count: n }
            // To return a full object we might need to fetch one, but 'updated' usually expects the object.
            // However, the frontend just checks response 200 usually. 
            // Let's just return { message: 'Updated', count: updated.count } or similar.
            // Or to be safe and compatible with single update return, let's just return the first one updated.
        } else {
             updated = await prisma.reservation.update({
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
        }

        // --- Handle Adding Extra Tables (Dynamic Merge) ---
        // We get `addTableIds` from body which is optional
        const { addTableIds } = req.body;

        if (addTableIds && Array.isArray(addTableIds) && addTableIds.length > 0) {
            
            // 1. Verify availability of new tables
            const conflicts = await prisma.reservation.findFirst({
                where: {
                    tableId: { in: addTableIds },
                    slotId: reservation.slotId, // Same slot
                    date: reservation.date,     // Same date
                    status: { not: 'CANCELLED' }
                }
            });

            if (conflicts) {
                return res.status(400).json({ message: 'One or more added tables are already booked' });
            }

            // 2. Determine Group ID
            let groupId = reservation.groupId;
            if (!groupId) {
                // If single reservation, create a new Group ID
                groupId = `GRP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                // Update the ORIGINAL reservation to have this Group ID
                await prisma.reservation.update({
                    where: { id: parseInt(id) },
                    data: { groupId }
                });
            }

            // 3. Create New Reservations for Added Tables
            // We use the UPDATED details (from body) 
            // Note: If we updated a group above, all members have new details. 
            // The new tables should also have these new details.
            
            await prisma.$transaction(
                addTableIds.map((tid: number) => 
                    prisma.reservation.create({
                        data: {
                            tableId: tid,
                            slotId: reservation.slotId,
                            date: reservation.date,
                            customerName,
                            contact,
                            adults: parseInt(adults),
                            kids: parseInt(kids),
                            foodPref,
                            specialReq,
                            groupId,
                            status: 'BOOKED'
                        }
                    })
                )
            );
        }

        // Invalidate Cache
        await clearDashboardCache(restaurantId, reservation.date);

        // --- Send WhatsApp Notification (Optional) ---
        const { notificationType } = req.body;
        if (notificationType) {
            try {
                // Fetch fresh data for the notification
                // If it was a group update, we just need ANY one of the reservations to get the details
                // If it was a single update, we get that one.
                const freshRes = await prisma.reservation.findFirst({
                    where: { id: parseInt(id) },
                    include: { slot: true } // Need slot for time details
                });

                if (freshRes && freshRes.slot) {
                    const templateId = notificationType === 'WEEKDAY_BRUNCH'
                        ? 'bab0d93c-f4c8-492f-b941-f7515197f68c'
                        : notificationType === 'WEEKEND_BRUNCH'
                            ? '3defebf5-4e52-4dca-bb52-07a764c8708b'
                            : '70c6df04-e22d-45ce-8c70-6927dcc3b378'; // Unlimited Dinner (Native/Default)
                    
                    // Native checks are done inside sendSmart or we can just pass the UUID.
                    // Ideally we should use the TEMPLATE_REGISTRY but that's in lib.
                    // For now, mapping ID manually or relying on smart sender behavior?
                    // Smart Sender takes UUID. 
                    // Let's use the explicit UUIDs we added to lib/whatsapp.ts
                    
                    const params = commonReservationMapper(freshRes);
                    
                    // NOTE: sendSmartWhatsAppTemplate handles "Native" vs "Cloud" dispatch internally based on ID detection.
                    await sendSmartWhatsAppTemplate(freshRes.contact, templateId, params);
                }
            } catch (err) {
                console.error("Failed to send WhatsApp update:", err);
            }
        }

        // Emit socket event
        try {
            getIO().to(`restaurant_${restaurantId}`).emit('reservation:update', {
                date: reservation.date.toISOString().split('T')[0],
                slotId: reservation.slotId
            });
        } catch (err) {
            console.error("Socket emit failed", err);
        }

        res.json(updated);

    } catch (error) {
        console.error('Error updating reservation:', error);
        res.status(500).json({ message: 'Error updating reservation', error });
    }
}

// Cancel Reservation
export const cancelReservation = async (req: AuthRequest, res: Response) => {
     try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

        const { id } = req.params;

        const reservation = await prisma.reservation.findFirst({
            where: { id: parseInt(id), table: { restaurantId } }
        });

        if (!reservation) return res.status(404).json({ message: 'Reservation not found' });
 
        // Handle Merged Tables (Cancel all related reservations)
        if (reservation.groupId) {
            await prisma.reservation.updateMany({
                where: { groupId: reservation.groupId, table: { restaurantId } },
                data: { status: 'CANCELLED' }
            });
        } else {
            // Soft Delete (Status = CANCELLED) for single table
            await prisma.reservation.update({
                where: { id: parseInt(id) },
                data: { status: 'CANCELLED' }
            });
        }
 
        // Invalidate Cache
        await clearDashboardCache(restaurantId, reservation.date);

        // Emit socket event
        try {
            getIO().to(`restaurant_${restaurantId}`).emit('reservation:update', {
                date: reservation.date.toISOString().split('T')[0],
                slotId: reservation.slotId
            });
        } catch (err) {
            console.error("Socket emit failed", err);
        }

        res.json({ message: 'Reservation cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling reservation:', error);
        res.status(500).json({ message: 'Error cancelling reservation', error });
    }
}
// Export Reservations to Excel
export const exportReservations = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

        const { date } = req.query;
        if (!date) return res.status(400).json({ message: 'Date is required' });

        // 1. Fetch Reservations
        const dateObj = new Date(date as string);
        const dayStart = new Date(dateObj); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dateObj); dayEnd.setHours(23, 59, 59, 999);

        const reservations = await prisma.reservation.findMany({
            where: {
                table: { restaurantId },
                date: {
                    gte: dayStart,
                    lt: dayEnd,
                },
                status: { not: 'CANCELLED' }
            },
            include: {
                table: true,
                slot: true
            },
            orderBy: [
                { slot: { startTime: 'asc' } }, // Sort by time
                { table: { tableNumber: 'asc' } }
            ]
        });

        if (reservations.length === 0) {
            return res.status(404).json({ message: 'No reservations found for this date' });
        }

        // 2. Create Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Italy\'s Reservation System';
        workbook.created = new Date();

        // 3. Group by Slot
        const reservationsBySlot: { [key: string]: typeof reservations } = {};
        
        reservations.forEach(res => {
            const slotKey = `${res.slot.startTime} - ${res.slot.endTime}`;
            if (!reservationsBySlot[slotKey]) {
                reservationsBySlot[slotKey] = [];
            }
            reservationsBySlot[slotKey].push(res);
        });

        // 4. Create Sheets
        Object.keys(reservationsBySlot).sort().forEach(slotKey => {
            const sheet = workbook.addWorksheet(slotKey.replace(/:/g, '-'));
            
            // Define Columns
            sheet.columns = [
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Time (IST)', key: 'time', width: 20 },
                { header: 'Table', key: 'table', width: 15 }, // Increased width
                { header: 'Customer Name', key: 'name', width: 25 },
                { header: 'Contact', key: 'contact', width: 15 },
                { header: 'Adults', key: 'adults', width: 10 },
                { header: 'Kids', key: 'kids', width: 10 },
                { header: 'Food Pref', key: 'foodPref', width: 15 },
                { header: 'Special Req', key: 'specialReq', width: 30 },
            ];

            // Style Header
            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            // Group by GroupID to merge tables
            const processedReservations: any[] = [];
            const groupMap: { [key: string]: any } = {};

            reservationsBySlot[slotKey].forEach(r => {
                if (r.groupId) {
                    if (groupMap[r.groupId]) {
                        groupMap[r.groupId].tables.push(r.table.tableNumber);
                    } else {
                        groupMap[r.groupId] = {
                            ...r,
                            tables: [r.table.tableNumber]
                        };
                        processedReservations.push(groupMap[r.groupId]);
                    }
                } else {
                    processedReservations.push({
                        ...r,
                        tables: [r.table.tableNumber]
                    });
                }
            });

            // Add Data
            processedReservations.forEach(r => {
                const rDate = new Date(r.date);
                const formattedDate = `${rDate.getDate().toString().padStart(2, '0')}/${(rDate.getMonth() + 1).toString().padStart(2, '0')}/${rDate.getFullYear()}`;
                
                sheet.addRow({
                    date: formattedDate,
                    time: slotKey,
                    table: r.tables.sort().join(', '), // Comma separated tables
                    name: r.customerName,
                    contact: r.contact,
                    adults: r.adults,
                    kids: r.kids,
                    foodPref: r.foodPref,
                    specialReq: r.specialReq || '-'
                });
            });
        });

        // 5. Stream Response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Reservations_${date}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ message: 'Failed to export excel', error });
    }
}
