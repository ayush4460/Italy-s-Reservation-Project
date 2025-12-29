import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { EmailService } from '../services/email.service';

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
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { name, email, password, otp } = req.body;

        if (!name || !email || !password || !otp) {
            return res.status(400).json({ message: 'All fields including OTP are required' });
        }

        // 1. Verify OTP
        const record = await prisma.otpVerification.findUnique({ where: { email } });
        if (!record) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        if (new Date() > record.expiresAt) {
            await prisma.otpVerification.delete({ where: { email } });
            return res.status(400).json({ message: 'OTP has expired' });
        }

        const isValid = await bcrypt.compare(otp, record.otp);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // 2. Check if email exists
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

        // 3. Cleanup OTP
        await prisma.otpVerification.delete({ where: { email } });

        res.status(201).json({ message: 'Staff created successfully', staff: newStaff });

    } catch (error) {
        console.error('Create Staff Error:', error);
        res.status(500).json({ message: 'Error creating staff', error });
    }
};

export const sendStaffOtp = async (req: AuthRequest, res: Response) => {
    try {
        const { email } = req.body;
        const restaurantId = req.user?.restaurantId;

        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        // 1. Check if email exists
        const admin = await prisma.restaurant.findUnique({ where: { email } });
        const staff = await prisma.staff.findUnique({ where: { email } });

        if (admin || staff) {
            return res.status(400).json({ message: 'Email address already in use' });
        }

        // 2. Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

        // 3. Store OTP
        await prisma.otpVerification.upsert({
            where: { email },
            update: { otp: hashedOtp, expiresAt },
            create: { email, otp: hashedOtp, expiresAt },
        });

        // 4. Send Email
        const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
        const restaurantName = restaurant?.name || "Italy's Reservation";

        await EmailService.sendStaffRegistrationOTP(email, otp, restaurantName);

        res.json({ message: 'OTP sent to staff email' });

    } catch (error) {
        console.error('Send Staff OTP Error:', error);
        res.status(500).json({ message: 'Error sending OTP', error });
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
        const { name, email, password, otp } = req.body;

        // 1. Fetch current staff to check for email change
        const currentStaff = await prisma.staff.findFirst({
            where: { id: parseInt(id), restaurantId }
        });
        if (!currentStaff) return res.status(404).json({ message: 'Staff not found' });

        // 2. Email Change Logic
        if (email && email !== currentStaff.email) {
            if (!otp) {
                return res.status(400).json({ message: 'OTP is required to change staff email' });
            }

            // Verify OTP for the new email
            const record = await prisma.otpVerification.findUnique({ where: { email } });
            if (!record) {
                return res.status(400).json({ message: 'Invalid or expired OTP' });
            }

            if (new Date() > record.expiresAt) {
                await prisma.otpVerification.delete({ where: { email } });
                return res.status(400).json({ message: 'OTP has expired' });
            }

            const isValid = await bcrypt.compare(otp, record.otp);
            if (!isValid) {
                return res.status(400).json({ message: 'Invalid OTP' });
            }

            // OTP verified, check if email is taken by others
            const existingStaff = await prisma.staff.findUnique({ where: { email } });
            const existingRestaurant = await prisma.restaurant.findUnique({ where: { email } });
            if (existingStaff || existingRestaurant) {
                return res.status(400).json({ message: 'New email address already in use' });
            }

            // Cleanup OTP
            await prisma.otpVerification.delete({ where: { email } });
        }

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

export const sendStaffEmailChangeOtp = async (req: AuthRequest, res: Response) => {
    try {
        const { newEmail, staffId } = req.body;
        const restaurantId = req.user?.restaurantId;

        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        // 1. Check if email exists elsewhere
        const admin = await prisma.restaurant.findUnique({ where: { email: newEmail } });
        const staff = await prisma.staff.findUnique({ where: { email: newEmail } });

        if (admin || staff) {
            return res.status(400).json({ message: 'Email address already in use' });
        }

        // 2. Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

        // 3. Store OTP
        await prisma.otpVerification.upsert({
            where: { email: newEmail },
            update: { otp: hashedOtp, expiresAt },
            create: { email: newEmail, otp: hashedOtp, expiresAt },
        });

        // 4. Send Email
        const staffMember = await prisma.staff.findUnique({ where: { id: parseInt(staffId) } });
        const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
        const restaurantName = restaurant?.name || "Italy's Reservation";

        await EmailService.sendStaffEmailChangeOTP(newEmail, otp, staffMember?.name || "Staff Member", restaurantName);

        res.json({ message: 'OTP sent to the new email address' });

    } catch (error) {
        console.error('Send Staff Email Change OTP Error:', error);
        res.status(500).json({ message: 'Error sending OTP', error });
    }
};
