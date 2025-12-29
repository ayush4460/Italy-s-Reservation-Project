import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateCaptcha } from '../utils/captcha';
import { EmailService } from '../services/email.service';
import crypto from 'crypto';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Removed getCaptcha function

export const signup = async (req: Request, res: Response) => {
  try {
    const { name, username, email, password, otp } = req.body;

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

    // 2. Create Restaurant
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.restaurant.create({
      data: {
        name,      // Restaurant Name
        username,  // Owner Name
        email,
        password: hashedPassword,
      },
    });

    // 3. Cleanup OTP
    await prisma.otpVerification.delete({ where: { email } });

    res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ message: 'Error creating user', error });
  }
};

export const sendSignupOtp = async (req: Request, res: Response) => {
  try {
    const { email, restaurantName } = req.body;

    // 1. Check if email exists
    const admin = await prisma.restaurant.findUnique({ where: { email } });
    const staff = await prisma.staff.findUnique({ where: { email } });

    if (admin || staff) {
      return res.status(400).json({ message: 'Email already registered' });
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
    await EmailService.sendSignupOTP(email, otp, restaurantName);

    res.json({ message: 'Signup OTP sent successfully' });
  } catch (error) {
    console.error('Send Signup OTP Error:', error);
    res.status(500).json({ message: 'Error processing request', error });
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

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // 1. Check if user exists (Admin or Staff)
    let user = await prisma.restaurant.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.staff.findUnique({ where: { email } }) as any;
    }

    if (!user) {
      return res.status(404).json({ message: 'Email not registered' });
    }

    // 2. Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

    // 3. Store OTP
    await prisma.otpVerification.upsert({
      where: { email },
      update: {
        otp: hashedOtp,
        expiresAt,
      },
      create: {
        email,
        otp: hashedOtp,
        expiresAt,
      },
    });

    // 4. Send Email
    // Fetch restaurant name if staff, or own name if admin
    let restaurantName = "Italy's Reservation";
    if ((user as any).restaurantId) {
        const r = await prisma.restaurant.findUnique({ where: { id: (user as any).restaurantId } });
        if (r) restaurantName = r.name;
    } else {
        restaurantName = user.name;
    }

    await EmailService.sendOTP(email, otp, restaurantName);

    res.json({ message: 'OTP sent successfully' });

  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ message: 'Error processing request', error });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;

    // 1. Verify OTP Record
    const record = await prisma.otpVerification.findUnique({ where: { email } });
    
    if (!record) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // 2. Check Expiry
    if (new Date() > record.expiresAt) {
      await prisma.otpVerification.delete({ where: { email } });
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // 3. Verify Hash
    const isValid = await bcrypt.compare(otp, record.otp);
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // 4. Hash New Password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 5. Update User (Try Admin then Staff)
    let updated = false;
    
    // Try Admin
    const admin = await prisma.restaurant.findUnique({ where: { email } });
    if (admin) {
        await prisma.restaurant.update({
            where: { email },
            data: { password: hashedPassword }
        });
        updated = true;
    } else {
        // Try Staff
        const staff = await prisma.staff.findUnique({ where: { email } });
        if (staff) {
            await prisma.staff.update({
                where: { email },
                data: { password: hashedPassword }
            });
            updated = true;
        }
    }

    if (!updated) {
        return res.status(404).json({ message: 'User not found' });
    }

    // 6. Delete OTP Record
    await prisma.otpVerification.delete({ where: { email } });

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ message: 'Error resetting password', error });
  }
};



export const sendLoginOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // 1. Check if user exists (Admin or Staff)
    let user: any = await prisma.restaurant.findUnique({ where: { email } });
    let role = 'ADMIN';

    if (!user) {
        user = await prisma.staff.findUnique({ where: { email } });
        role = 'STAFF';
    }

    if (!user) {
      return res.status(404).json({ message: 'Email not registered' }); // Enforced validation
    }

    // 2. Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

    // 3. Store OTP
    await prisma.otpVerification.upsert({
      where: { email },
      update: {
        otp: hashedOtp,
        expiresAt,
      },
      create: {
        email,
        otp: hashedOtp,
        expiresAt,
      },
    });

    // 4. Send Email
    let restaurantName = "Italy's Reservation";
    if (role === 'ADMIN') {
        const r = await prisma.restaurant.findUnique({ where: { id: user.id } });
        if (r) restaurantName = r.name;
    } else {
         const r = await prisma.restaurant.findUnique({ where: { id: user.restaurantId } });
         if (r) restaurantName = r.name;
    }

    // Name formatting
    let displayName = user.name;
    if (role === 'ADMIN' && user.username) displayName = user.username;

    await EmailService.sendLoginOTP(email, otp, displayName, restaurantName);

    res.json({ message: 'Login OTP sent successfully' });

  } catch (error) {
    console.error('Send Login OTP Error:', error);
    res.status(500).json({ message: 'Error processing request', error });
  }
};

export const verifyLoginOtp = async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;
  
      // 1. Verify OTP Record
      const record = await prisma.otpVerification.findUnique({ where: { email } });
      
      if (!record) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }
  
      // 2. Check Expiry
      if (new Date() > record.expiresAt) {
        await prisma.otpVerification.delete({ where: { email } });
        return res.status(400).json({ message: 'OTP has expired' });
      }
  
      // 3. Verify Hash
      const isValid = await bcrypt.compare(otp, record.otp);
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid OTP' });
      }

      // 4. Get User Details
      let user: any = await prisma.restaurant.findUnique({ where: { email } });
      let role = 'ADMIN';
  
      if (!user) {
          user = await prisma.staff.findUnique({ where: { email } });
          role = 'STAFF';
      }

      if (!user) return res.status(404).json({ message: 'User not found' });
  
      // 5. Generate Token (Same as Password Login)
      const tokenPayload = { 
          userId: user.id, 
          role, 
          restaurantId: role === 'ADMIN' ? user.id : user.restaurantId 
      };
  
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '1d' });
      
      // 6. Delete OTP Record
      await prisma.otpVerification.delete({ where: { email } });

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
      console.error('Verify Login OTP Error:', error);
      res.status(500).json({ message: 'Error verifying OTP', error });
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
