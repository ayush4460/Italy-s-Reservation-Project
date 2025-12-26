import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: number };
}

import redis from '../lib/redis';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.userId;
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
        const cacheKey = `dashboard:stats:v4:${restaurantId}:${dateKey}`;
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
        const [totalTables, bookingsCount, guestsAggregation, recentReservations] = await Promise.all([
            // 1. Total Tables
            prisma.table.count({
                where: { restaurantId }
            }),
            // 2. Total Bookings for date
            prisma.reservation.count({
                where: {
                    table: { restaurantId },
                    date: {
                        gte: startOfDay,
                        lt: endOfDay
                    },
                    status: { not: 'CANCELLED' }
                }
            }),
            // 3. Aggregate Guests
            prisma.reservation.aggregate({
                where: {
                    table: { restaurantId },
                    date: {
                        gte: startOfDay,
                        lt: endOfDay
                    },
                    status: { not: 'CANCELLED' }
                },
                _sum: {
                    adults: true,
                    kids: true
                }
            }),
            // 4. Recent Reservations (Fetching only necessary fields, limited to 50 for performance)
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
                    table: {
                        select: { tableNumber: true }
                    },
                    slot: {
                        select: { startTime: true, endTime: true }
                    }
                },
                orderBy: {
                    slot: { startTime: 'asc' }
                },
                take: 50 
            })
        ]);

        const guestsCount = (guestsAggregation._sum.adults || 0) + (guestsAggregation._sum.kids || 0);

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
