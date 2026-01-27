import { Request, Response } from 'express';
import { sendWhatsappNotification } from '../lib/whatsapp';

export const requestReservation = async (req: Request, res: Response) => {
    try {
        const { 
            name, 
            contact, 
            date, 
            slot, 
            adults, 
            kids, 
            menu, 
            foodPref, 
            specialReq 
        } = req.body;

        // Basic Validation
        if (!name || !contact || !date || !slot || !adults || !menu || !foodPref) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const phoneToSend = process.env.RESERVATION_REQUEST_PHONE;

        if (!phoneToSend) {
            console.error('RESERVATION_REQUEST_PHONE not set in .env');
            // We can still return success to user but log error
            return res.status(500).json({ message: 'Server configuration error' });
        }

        // Send WhatsApp Notification to Admin
        const notificationData = {
            name,
            contact,
            date, // frontend sends formatted/ISO string? mapper expects something parseable by new Date(data.date)
            slot,
            adults,
            kids,
            menu,
            foodPref,
            specialReq
        };

        const result = await sendWhatsappNotification(
            phoneToSend, 
            'RESERVATION_REQUEST', 
            notificationData
            // No restaurantId passed -> No DB logging for this (it's admin notification, not customer chat)
            // Or should we log it? User didn't specify. Usually admin alerts don't need to clog customer chat logs.
        );

        if (result) {
            res.status(200).json({ message: 'Request submitted successfully' });
        } else {
            res.status(500).json({ message: 'Failed to send notification' });
        }

    } catch (error) {
        console.error('Error handling reservation request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
