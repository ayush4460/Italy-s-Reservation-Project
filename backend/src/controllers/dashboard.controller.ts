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

        const [totalTables, todayReservations] = await Promise.all([
            prisma.table.count({
                where: { restaurantId }
            }),
            prisma.reservation.findMany({
                where: {
                    table: { restaurantId },
                    date: {
                        gte: startOfDay,
                        lt: endOfDay
                    },
                    status: { not: 'CANCELLED' }
                },
                include: {
                    table: true,
                    slot: true
                },
                orderBy: {
                    slot: { startTime: 'asc' }
                }
            })
        ]);

        const bookingsCount = todayReservations.length;
        const guestsCount = todayReservations.reduce((acc, curr) => acc + curr.adults + curr.kids, 0);

        res.json({
            totalTables,
            todayBookings: bookingsCount,
            guestsExpected: guestsCount,
            recentReservations: todayReservations
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: 'Error fetching stats', error });
    }
};
