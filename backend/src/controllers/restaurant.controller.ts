import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: number };
}

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: userId },
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
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { name, address, phone, bannerUrl, logoUrl } = req.body;

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: userId },
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
