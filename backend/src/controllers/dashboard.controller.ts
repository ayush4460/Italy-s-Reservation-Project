import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
             const selectedDate = new Date(date as string);
             startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        } else {
             const now = new Date();
             startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        
        endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

        // --- ANALYTICS RANGE ---
        const chartStartStr = (req.query.chartStart as string) || "";
        const chartEndStr = (req.query.chartEnd as string) || "";

        // CHECKS CACHE
        const cacheKey = `dashboard:stats:v10:${restaurantId}:${dateKey}:${chartStartStr}:${chartEndStr}`;
        let cachedData = null;
        try {
            cachedData = await redis.get(cacheKey);
        } catch (err) {
            console.warn("Redis Fetch Error (Skipping Cache):", err);
        }

        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        // Efficiently aggregate data
        // Fetch ALL reservations for the day to aggregate in memory (avoids complex SQL group logic for now)
        const [totalTables, dayReservations] = await Promise.all([
            prisma.table.count({ where: { restaurantId } }),
            prisma.reservation.findMany({
                where: {
                    table: { restaurantId },
                    date: {
                        gte: startOfDay,
                        lt: endOfDay
                    },
                    status: { not: 'CANCELLED' }
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
                    status: true,
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
            })
        ]);

        // Process Reservations for Stats
        let bookingsCount = 0;
        let guestsCount = 0;
        const processedGroups = new Set<string>();
        const groupedReservationsMap = new Map<string, any>(); // Key can be groupId or "ID-<id>"
        const standaloneReservations = [];

        dayReservations.forEach(res => {
            // Group Logic
            if (res.groupId) {
                if (!processedGroups.has(res.groupId)) {
                    // New Group encountered
                    processedGroups.add(res.groupId);
                    bookingsCount++;
                    guestsCount += (res.adults + res.kids); // Count guests once per group

                    // Initialize grouped object for list
                    groupedReservationsMap.set(res.groupId, {
                        ...res, // Copy base fields
                        table: { tableNumber: res.table.tableNumber.toString() } // Start table list
                    });
                } else {
                    // Existing Group - just append table number to the grouped object
                    const existing = groupedReservationsMap.get(res.groupId);
                    if (existing) {
                        existing.table.tableNumber += `+${res.table.tableNumber}`;
                    }
                }
            } else {
                // Standalone
                bookingsCount++;
                guestsCount += (res.adults + res.kids);
                groupedReservationsMap.set(`ID-${res.id}`, {
                    ...res,
                    table: { tableNumber: res.table.tableNumber.toString() }
                });
            }
        });

        // конвертируем Map в Array для recentReservations и сортируем
        const recentReservations = Array.from(groupedReservationsMap.values());

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

        const responseData = {
            totalTables,
            todayBookings: bookingsCount,
            guestsExpected: guestsCount,
            recentReservations,
            analyticsData
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
