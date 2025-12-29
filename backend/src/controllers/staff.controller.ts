import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: number; role?: string; restaurantId?: number };
}

// Get all staff for the logged-in restaurant
export const getStaff = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId; // Now guaranteed by token
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const staff = await prisma.staff.findMany({
            where: { restaurantId },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        });

        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching staff', error });
    }
};

// Create new staff
export const createStaff = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if email exists (in Staff or Restaurant)
        const existingStaff = await prisma.staff.findUnique({ where: { email } });
        const existingRestaurant = await prisma.restaurant.findUnique({ where: { email } });

        if (existingStaff || existingRestaurant) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newStaff = await prisma.staff.create({
            data: {
                restaurantId,
                name,
                email,
                password: hashedPassword,
                role: 'STAFF'
            }
        });

        res.status(201).json({ message: 'Staff created successfully', staff: newStaff });

    } catch (error) {
        res.status(500).json({ message: 'Error creating staff', error });
    }
};

// Delete staff
export const deleteStaff = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.userId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { id } = req.params;

        await prisma.staff.deleteMany({
            where: {
                id: parseInt(id),
                restaurantId // Ensure ownership
            }
        });

        res.json({ message: 'Staff deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting staff', error });
    }
};

export const updateStaff = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        // Restrict update to ADMIN
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Forbidden: Admins only' });
        }
        
        const { id } = req.params;
        const { name, email, password } = req.body;

        const updateData: any = {
            name,
            email
        };

        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateData.password = hashedPassword;
        }

        const updatedStaff = await prisma.staff.update({
            where: { id: parseInt(id), restaurantId },
            data: updateData
        });

        res.json(updatedStaff);
    } catch (error) {
        console.error("Update Staff Error:", error);
        res.status(500).json({ message: 'Error updating staff', error });
    }
};
