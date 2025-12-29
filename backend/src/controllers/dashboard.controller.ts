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

        // CHECKS CACHE
        const cacheKey = `dashboard:stats:v5:${restaurantId}:${dateKey}`;
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

        // Convert Map to Array for recentReservations and sort
        // The Map iteration order is insertion order, which follows the 'orderBy' from Prisma (startTime asc).
        // However, we merged items. Usually the first item of the group determines position, which is fine.
        const recentReservations = Array.from(groupedReservationsMap.values());

        const responseData = {
            totalTables,
            todayBookings: bookingsCount,
            guestsExpected: guestsCount,
            recentReservations
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
