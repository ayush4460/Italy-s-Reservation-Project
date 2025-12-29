import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import redis from '../lib/redis';
import { sendWhatsAppMessage, sendReservationTemplate } from '../lib/whatsapp';

const prisma = new PrismaClient();

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
        // We need to invalidate for the specific date of the reservation
        const dateKey = new Date(date).toISOString().split('T')[0];
        const cacheKey = `dashboard:stats:v5:${restaurantId}:${dateKey}`;
        try {
            await redis.del(cacheKey);
        } catch (e) { console.warn("Redis Invalidate Error (Ignored):", e); }

        // Send WhatsApp Notification (Only once)
        console.log(`[CreateReservation] Contact: ${contact}, SlotId: ${slotId}`);
        if (contact) {
            try {
                const slotObj = await prisma.slot.findUnique({ where: { id: parseInt(slotId) } });
                
                if (slotObj) {
                    const [year, month, day] = dateKey.split('-');
                    const formattedDate = `${day}/${month}`;
                    let formattedContact = contact.trim();
                    if (/^\d{10}$/.test(formattedContact)) {
                        formattedContact = '+91' + formattedContact;
                    }
                    
                    const tableNumbers = tables.map(t => t.tableNumber).join(', ');
                    const textBody = `Hello ${customerName}, your reservation for tables ${tableNumbers} is confirmed for ${formattedDate} at ${slotObj.startTime}.`;
                    
                    const testTarget = 'whatsapp:+917878065085'; // Keep validation number for now
                    await sendWhatsAppMessage(testTarget, textBody);
                }
            } catch (err) {
               console.error("Failed to send WhatsApp:", err);
            }
        }

        res.status(201).json({ message: 'Reservation created', groupId });

    } catch (error) {
        console.error('Error creating reservation:', error);
        res.status(500).json({ message: 'Error creating reservation', error });
    }
}
// Move Reservation
export const moveReservation = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

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
        const cacheKey = `dashboard:stats:v5:${restaurantId}:${dateKey}`;
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
            // Let's refetch one to return proper object or just return { count: n } if frontend handles it?
            // Existing frontend expects 'updated' object structure usually? 
            // Checking frontend 'reservationService': just returns response.data.
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

        // Invalidate Cache
        const dateKey = new Date(reservation.date).toISOString().split('T')[0];
        const cacheKey = `dashboard:stats:v5:${restaurantId}:${dateKey}`;
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
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        if (req.user?.role !== 'ADMIN') return res.status(403).json({ message: 'Forbidden' });

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
