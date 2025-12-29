import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: number; role?: string; restaurantId?: number };
}

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        phone: true,
        bannerUrl: true,
        logoUrl: true,
        createdAt: true
      }
    });

    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    res.json(restaurant);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

    // Restrict profile update to ADMIN
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Admins only' });
    }

    const { name, address, phone, bannerUrl, logoUrl } = req.body;

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        name,
        address,
        phone,
        bannerUrl,
        logoUrl
      },
      select: {
        id: true,
        name: true,
        email: true,
        address: true,
        phone: true,
        bannerUrl: true,
        logoUrl: true
      }
    });

    res.json(updatedRestaurant);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error });
  }
};
