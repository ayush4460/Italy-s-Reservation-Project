import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { EmailService } from '../services/email.service';
// Force restart

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
        username: true, // Added username
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

    const { name, username, email, address, phone, bannerUrl, logoUrl, otp } = req.body;

    // Fetch current profile to check for email change
    const current = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!current) return res.status(404).json({ message: 'Restaurant not found' });

    // 1. Email Change Verification Logic
    if (email && email !== current.email) {
        if (!otp) {
            return res.status(400).json({ message: 'OTP is required to change email' });
        }

        // Verify OTP for the new email
        const record = await prisma.otpVerification.findUnique({ where: { email } });
        if (!record) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Check Expiry
        if (new Date() > record.expiresAt) {
            await prisma.otpVerification.delete({ where: { email } });
            return res.status(400).json({ message: 'OTP has expired' });
        }

        // Verify Hash
        const isValid = await bcrypt.compare(otp, record.otp);
        if (!isValid) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Delete OTP Record
        await prisma.otpVerification.delete({ where: { email } });
    }

    const updatedRestaurant = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        name,
        username,
        email,    
        address,
        phone,
        bannerUrl,
        logoUrl
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        address: true,
        phone: true,
        bannerUrl: true,
        logoUrl: true
      }
    });

    res.json(updatedRestaurant);
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: 'Error updating profile', error });
  }
};

export const sendEmailChangeOtp = async (req: AuthRequest, res: Response) => {
    try {
        const { newEmail } = req.body;
        const restaurantId = req.user?.restaurantId;

        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        // 1. Check if email is already taken
        const admin = await prisma.restaurant.findUnique({ where: { email: newEmail } });
        const staff = await prisma.staff.findUnique({ where: { email: newEmail } });

        if (admin || staff) {
            return res.status(400).json({ message: 'Email address already in use' });
        }

        // 2. Generate OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);
        const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

        // 3. Store OTP for the new email
        await prisma.otpVerification.upsert({
            where: { email: newEmail },
            update: { otp: hashedOtp, expiresAt },
            create: { email: newEmail, otp: hashedOtp, expiresAt },
        });

        // 4. Send Email
        const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
        const displayName = restaurant?.username || restaurant?.name || "Admin";
        const restaurantName = restaurant?.name || "Italy's Reservation";

        await EmailService.sendEmailChangeOTP(newEmail, otp, displayName, restaurantName);

        res.json({ message: 'OTP sent to your new email' });

    } catch (error) {
        console.error('Send Email Change OTP Error:', error);
        res.status(500).json({ message: 'Error sending OTP', error });
    }
};
