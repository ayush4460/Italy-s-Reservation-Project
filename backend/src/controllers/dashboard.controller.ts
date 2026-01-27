import { Request, Response } from 'express';
import prisma from '../utils/prisma';

interface AuthRequest extends Request {
  user?: { userId: number; role?: string; restaurantId?: number };
}

import redis from '../lib/redis';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        // Get date from query or default to today
        const { date } = req.query;
        let startOfDay: Date, endOfDay: Date;

        const dateKey = date ? (date as string) : new Date().toISOString().split('T')[0];

        if (date) {
             // Treat input date string (YYYY-MM-DD) as UTC start
             startOfDay = new Date(`${date}T00:00:00.000Z`);
        } else {
             const now = new Date();
             const todayStr = now.toISOString().split('T')[0];
             startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
        }
        
        endOfDay = new Date(startOfDay);
        endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

        // --- ANALYTICS RANGE ---
        const chartStartStr = (req.query.chartStart as string) || "";
        const chartEndStr = (req.query.chartEnd as string) || "";

        // CHECKS CACHE
        const cacheKey = `dashboard:stats:v13:${restaurantId}:${dateKey}:${chartStartStr}:${chartEndStr}`;
        let cachedData = null;
        try {
            cachedData = await redis.get(cacheKey);
        } catch (err) {
            console.warn("Redis Fetch Error (Skipping Cache):", err);
        }

        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        
        console.log(`[Dashboard] Fetching fresh stats (v12) for ${dateKey} (Restaurant: ${restaurantId})`);

        // Efficiently aggregate data
        // Fetch ALL reservations for the day to aggregate in memory (avoids complex SQL group logic for now)
        
        // Determine Day of Week for Slot Filtering
        const dayOfWeek = startOfDay.getDay(); // 0-6

        // Calculate Yesterday's Range
        const yesterdayStart = new Date(startOfDay);
        yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
        const yesterdayEnd = new Date(startOfDay);

        const [totalTables, allSlots, dayReservations, yesterdayReservations] = await Promise.all([
            prisma.table.count({ where: { restaurantId } }),
            prisma.slot.findMany({ 
                where: { 
                    restaurantId, 
                    isActive: true,
                    OR: [
                        { dayOfWeek: dayOfWeek },
                        { date: startOfDay }
                    ]
                },
                orderBy: { startTime: 'asc' }
            }),
            prisma.reservation.findMany({
                where: {
                    table: { restaurantId },
                    date: {
                        gte: startOfDay,
                        lt: endOfDay
                    },
                    // Fetch ALL statuses, we will filter in memory
                },
                select: {
                    id: true,
                    date: true,
                    slotId: true,
                    customerName: true,
                    contact: true,
                    adults: true,
                    kids: true,
                    foodPref: true,
                    specialReq: true,
                    // @ts-ignore
                    notificationType: true,
                    status: true,
                    // @ts-ignore
                    cancellationReason: true,
                    groupId: true,
                    table: {
                        select: { tableNumber: true }
                    },
                    slot: {
                        select: { startTime: true, endTime: true }
                    }
                },
                orderBy: {
                    slot: { startTime: 'asc' }
                }
            }),
            prisma.reservation.findMany({
                where: {
                    table: { restaurantId },
                    date: {
                        gte: yesterdayStart,
                        lt: yesterdayEnd
                    },
                    status: { not: 'CANCELLED' } // Only count active for comparison stats
                },
                select: {
                    id: true,
                    adults: true,
                    kids: true,
                    groupId: true
                }
            })
        ]);

        // --- PROCESSING YESTERDAY STATS ---
        // We must deduplicate groups to avoid double counting guests/bookings
        let yesterdayBookings = 0;
        let yesterdayGuests = 0;
        const yGroups = new Set<string>();

        yesterdayReservations.forEach(r => {
             const key = r.groupId || `ID-${r.id}`;
             if (!yGroups.has(key)) {
                 yGroups.add(key);
                 yesterdayBookings++;
                 yesterdayGuests += (r.adults || 0) + (r.kids || 0);
             }
        });

        // Today's Stats will be calculated in the main loop below (bookingsCount, guestsCount)
        // We will compute percentages after that loop.

        // Process Reservations for Stats
        let bookingsCount = 0;
        let guestsCount = 0;
        const processedGroups = new Set<string>();
        const groupedReservationsMap = new Map<string, any>(); 
        const cancelledReservationsMap = new Map<string, any>(); // Group cancelled ones too
        
        // ... (slotMap setup remains)
        const slotMap = new Map<string, { timeDisplay: string, bookings: Set<string>, guests: number, startTime: string }>();

        // Pre-fill with empty slots
        const formatTime = (t: string) => {
            const [h, m] = t.split(':');
            const hour = parseInt(h);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const h12 = hour % 12 || 12;
            return `${h12}:${m} ${ampm}`;
        };

        allSlots.forEach(s => {
            slotMap.set(s.startTime, {
                 timeDisplay: `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`,
                 bookings: new Set(),
                 guests: 0,
                 startTime: s.startTime
            });
        });

        dayReservations.forEach(res => {
            if (res.status === 'CANCELLED') {
                // Cancelled Logic
                if (res.groupId) {
                     if (!cancelledReservationsMap.has(res.groupId)) {
                        cancelledReservationsMap.set(res.groupId, { ...res, table: { tableNumber: res.table.tableNumber.toString() } });
                     } else {
                        const existing = cancelledReservationsMap.get(res.groupId);
                        if (existing) existing.table.tableNumber += `+${res.table.tableNumber}`;
                     }
                } else {
                    cancelledReservationsMap.set(`ID-${res.id}`, { ...res, table: { tableNumber: res.table.tableNumber.toString() } });
                }
                return; // Skip stats for cancelled
            }

            // Active Stats Group Logic
            if (res.groupId) {
                if (!processedGroups.has(res.groupId)) {
                    processedGroups.add(res.groupId);
                    bookingsCount++;
                    guestsCount += (res.adults + res.kids);
                    groupedReservationsMap.set(res.groupId, { ...res, table: { tableNumber: res.table.tableNumber.toString() } });
                } else {
                    const existing = groupedReservationsMap.get(res.groupId);
                    if (existing) existing.table.tableNumber += `+${res.table.tableNumber}`;
                }
            } else {
                bookingsCount++;
                guestsCount += (res.adults + res.kids);
                groupedReservationsMap.set(`ID-${res.id}`, { ...res, table: { tableNumber: res.table.tableNumber.toString() } });
            }

            // --- SLOT ANALYTICS UPDATE ---
            const slotKey = res.slot.startTime;
            
            if (!slotMap.has(slotKey)) {
                slotMap.set(slotKey, {
                    timeDisplay: `${formatTime(res.slot.startTime)} - ${formatTime(res.slot.endTime)}`,
                    bookings: new Set(),
                    guests: 0,
                    startTime: res.slot.startTime
                });
            }
            
            const slotData = slotMap.get(slotKey)!;
            const bookingKey = res.groupId || `ID-${res.id}`;
            
            if (!slotData.bookings.has(bookingKey)) {
                slotData.guests += (res.adults + res.kids);
                slotData.bookings.add(bookingKey);
            }
        });

        const slotAnalytics = Array.from(slotMap.values())
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map(s => ({
                timeSlot: s.timeDisplay,
                bookings: s.bookings.size,
                guests: s.guests
            }));

        const recentReservations = Array.from(groupedReservationsMap.values());
        const cancelledReservations = Array.from(cancelledReservationsMap.values());

        // --- NEW: ANALYTICS TREND DATA ---
        let aStart: Date, aEnd: Date;
        if (chartStartStr && chartEndStr) {
            // Force UTC parsing
            aStart = new Date(`${chartStartStr}T00:00:00.000Z`);
            aEnd = new Date(`${chartEndStr}T23:59:59.999Z`);
        } else {
            // Default 7 days (UTC based)
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            aEnd = new Date(`${todayStr}T23:59:59.999Z`);
            
            aStart = new Date(`${todayStr}T00:00:00.000Z`);
            aStart.setUTCDate(aStart.getUTCDate() - 6);
        }

        const analyticsReservations = await prisma.reservation.findMany({
            where: {
                table: { restaurantId },
                date: { gte: aStart, lte: aEnd },
                status: { not: 'CANCELLED' }
            },
            select: {
                id: true,
                date: true,
                groupId: true,
                adults: true,
                kids: true
            }
        });

        // Group by Date & Unique Booking
        const dayCounts = new Map<string, { bookings: Set<string>, guests: number }>();
        
        // Initialize all days in range with 0 (using UTC iteration)
        let iter = new Date(aStart);
        while (iter <= aEnd) {
            const dStr = iter.toISOString().split('T')[0];
            dayCounts.set(dStr, { bookings: new Set(), guests: 0 });
            iter.setUTCDate(iter.getUTCDate() + 1);
        }

        analyticsReservations.forEach(res => {
            const dateStr = res.date.toISOString().split('T')[0];
            const bookingKey = res.groupId || `S-${res.id}`;
            const dayData = dayCounts.get(dateStr);
            if (dayData) {
                // If this is a new booking key for this day, add the guests
                if (!dayData.bookings.has(bookingKey)) {
                    dayData.guests += (res.adults + res.kids);
                }
                // Always add to bookings Set to track unique counts
                dayData.bookings.add(bookingKey);
            }
        });

        const analyticsData = Array.from(dayCounts.entries()).map(([date, data]) => {
            const d = new Date(`${date}T00:00:00.000Z`);
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return {
                date,
                display: `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]}`,
                count: data.bookings.size,
                guestCount: data.guests
            };
        }).sort((a, b) => a.date.localeCompare(b.date));

        // Calculate Growth Percentage
        const calcGrowth = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        const bookingsChangePct = calcGrowth(bookingsCount, yesterdayBookings);
        const guestsChangePct = calcGrowth(guestsCount, yesterdayGuests);

        const responseData = {
            totalTables,
            todayBookings: bookingsCount,
            guestsExpected: guestsCount,
            bookingsChangePct,
            guestsChangePct,
            recentReservations,
            analyticsData,
            slotAnalytics,
            cancelledReservations
        };

        // SET CACHE (Expire in 5 minutes)
        try {
            await redis.setex(cacheKey, 300, JSON.stringify(responseData));
        } catch (err) {
            console.warn("Redis Set Error (Cache Skip):", err);
        }

        res.json(responseData);

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: 'Error fetching stats', error });
    }
};
