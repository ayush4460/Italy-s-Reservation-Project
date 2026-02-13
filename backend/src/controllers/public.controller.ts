import { Request, Response } from 'express';
import { sendWhatsappNotification } from '../lib/whatsapp';
import prisma from '../utils/prisma';

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
            sitting,
            foodPref, 
            specialReq 
        } = req.body;

        // Basic Validation
        if (!name || !contact || !date || !slot || !adults || !menu || !sitting || !foodPref) {
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
            sitting,
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

        // Send WhatsApp Notification to Guest
        await sendWhatsappNotification(
            contact,
            'RESERVATION_REQUEST_GUEST',
            { name },
            // Optional: If we want to log this in a "Public/General" restaurant scope, we'd need an ID. 
            // For now, not logging interaction to avoiding clogging unrelated restaurant logs.
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

export const getPublicSlots = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date is required' });

    // Assuming restaurant ID 1 for the project (Single Restaurant)
    const restaurantId = 1;

    const dateObj = new Date(date as string);
    const dayOfWeek = dateObj.getDay();
    const startOfDay = new Date(dateObj);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Fetch active slots for this day of week
    const slots = await prisma.slot.findMany({
      where: {
        restaurantId,
        isActive: true,
        OR: [
          { dayOfWeek: dayOfWeek },
          { date: dateObj }
        ]
      },
      orderBy: { startTime: 'asc' }
    });

    // Fetch overrides, total tables, and occupied tables
    const [availabilities, reservationsCountBySlot, totalTables] = await Promise.all([
      prisma.slotAvailability.findMany({
        where: {
          restaurantId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          }
        }
      }),
      prisma.reservation.findMany({
        where: {
          table: { restaurantId },
          date: {
            gte: startOfDay,
            lt: endOfDay,
          },
          status: { not: 'CANCELLED' }
        },
        select: { slotId: true, tableId: true }
      }),
      prisma.table.count({ where: { restaurantId } })
    ]);

    // Merge and filter
    const result = slots.map(slot => {
      const avail = availabilities.find(a => a.slotId === slot.id);
      
      const occupiedTables = new Set(
        reservationsCountBySlot
          .filter(r => r.slotId === slot.id)
          .map(r => r.tableId)
      );
      const isAutoDisabled = occupiedTables.size >= totalTables && totalTables > 0;

      return {
        ...slot,
        availability: avail || {
          isSlotDisabled: false,
          isIndoorDisabled: false,
          isOutdoorDisabled: false
        },
        isAutoDisabled
      };
    }).filter(s => !s.availability.isSlotDisabled && !s.isAutoDisabled);

    res.json(result);
  } catch (error) {
    console.error('Error fetching public slots:', error);
    res.status(500).json({ message: 'Error fetching slots' });
  }
};
