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

        // Get start and end of today in UTC or server time (simplified for now)
        // Ideally should respect restaurant timezone if we had that stored
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay);
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
                select: {
                    adults: true,
                    kids: true
                }
            })
        ]);

        const bookingsCount = todayReservations.length;
        const guestsCount = todayReservations.reduce((acc, curr) => acc + curr.adults + curr.kids, 0);

        res.json({
            totalTables,
            todayBookings: bookingsCount,
            guestsExpected: guestsCount
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ message: 'Error fetching stats', error });
    }
};
