import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateCaptcha } from '../utils/captcha';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Removed getCaptcha function

export const signup = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.restaurant.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    let user: any = await prisma.restaurant.findUnique({ where: { email } });
    let role = 'ADMIN';

    if (!user) {
        user = await prisma.staff.findUnique({ where: { email } });
        role = 'STAFF';
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const tokenPayload = { 
        userId: user.id, 
        role, 
        restaurantId: role === 'ADMIN' ? user.id : user.restaurantId 
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
    
    // Return unified structure
    res.json({ 
        token, 
        user: { 
            id: user.id, 
            name: user.name, 
            email: user.email, 
            role,
            restaurantId: role === 'ADMIN' ? user.id : user.restaurantId
        } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Login error', error });
  }
};

export const getMe = async (req: any, res: Response) => {
    try {
        const userId = req.user?.userId;
        const role = req.user?.role || 'ADMIN';
        const restaurantId = req.user?.restaurantId;

        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        // 1. Fetch User Details
        let user: any;
        if (role === 'STAFF') {
            user = await prisma.staff.findUnique({
                where: { id: userId },
                select: { id: true, name: true, email: true, role: true }
            });
        } else {
            user = await prisma.restaurant.findUnique({
                where: { id: userId },
                select: { 
                    id: true, 
                    name: true, 
                    username: true, // Added username
                    email: true 
                }
            });
            if (user) user.role = 'ADMIN';
        }

        if (!user) return res.status(404).json({ message: 'User not found' });

        // 2. Fetch Restaurant Details (Brand)
        const restaurant = await prisma.restaurant.findUnique({
             where: { id: restaurantId },
             select: { id: true, name: true, logoUrl: true, bannerUrl: true }
        });

        res.json({
            user,
            restaurant
        });

    } catch (error) {
        console.error('GetMe Error:', error);
        res.status(500).json({ message: 'Error fetching user details', error });
    }
};
