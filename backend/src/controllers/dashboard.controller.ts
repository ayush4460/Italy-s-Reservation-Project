import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: number };
}

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        // Get date from query or default to today
        const { date } = req.query;
        let startOfDay: Date, endOfDay: Date;

        if (date) {
             const selectedDate = new Date(date as string);
             startOfDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        } else {
             const now = new Date();
             startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        
        endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);

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
                    customerName: true,
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

        res.json({
            totalTables,
            todayBookings: bookingsCount,
            guestsExpected: guestsCount,
            recentReservations
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: 'Error fetching stats', error });
    }
};
