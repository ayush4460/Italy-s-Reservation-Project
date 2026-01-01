import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendReservationConfirmation } from '../lib/gupshup'; // We use this purely for sending logic? 
// Actually we need a generic send function. The one in lib/gupshup is specific to reservation template?
// Let's verify lib/gupshup.ts content or create a new generic send.
import axios from 'axios';

const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: number; role?: string; restaurantId?: number };
}

// Get Active Chats (Grouped by Phone)
export const getChats = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });
        
        const chats = await prisma.$queryRaw`
            SELECT 
                t1."phoneNumber",
                t1."content",
                t1."timestamp",
                t1."direction",
                t1."status",
                (
                    SELECT u."customerName"
                    FROM "WhatsAppMessage" u
                    WHERE u."phoneNumber" = t1."phoneNumber"
                      AND u."customerName" IS NOT NULL
                    ORDER BY u."timestamp" DESC
                    LIMIT 1
                ) as "customerName",
                COALESCE(unread_stats.cnt, 0)::int as "unreadCount"
            FROM "WhatsAppMessage" t1
            INNER JOIN (
                SELECT "phoneNumber", MAX("timestamp") as max_timestamp
                FROM "WhatsAppMessage"
                WHERE "restaurantId" = ${restaurantId}
                GROUP BY "phoneNumber"
            ) t2 ON t1."phoneNumber" = t2."phoneNumber" AND t1."timestamp" = t2.max_timestamp
            LEFT JOIN (
                SELECT "phoneNumber", COUNT(*)::int as cnt
                FROM "WhatsAppMessage"
                WHERE "restaurantId" = ${restaurantId} 
                  AND "direction" = 'inbound' 
                  AND "isRead" = false
                GROUP BY "phoneNumber"
            ) unread_stats ON t1."phoneNumber" = unread_stats."phoneNumber"
            WHERE t1."restaurantId" = ${restaurantId}
            ORDER BY t1."timestamp" DESC
        `;

        const sortedChats = (chats as any[]).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json(sortedChats);

    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ message: 'Error fetching chats' });
    }
};

// Mark messages as read for a phone number
export const markAsRead = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { phone } = req.params;

        // 1. Find unread inbound messages to get their external IDs
        const unreadMessages = await prisma.whatsAppMessage.findMany({
            where: {
                restaurantId,
                phoneNumber: phone,
                direction: 'inbound',
                isRead: false,
                messageId: { not: null } // Only those with valid external IDs
            },
            select: { messageId: true }
        });

        // 2. Call Gupshup API for each unique message ID
        // Note: Done in background or parallel to avoid blocking response too long
        if (unreadMessages.length > 0) {
            const { markMessageAsRead } = await import('../lib/whatsapp');
            const processedIds = new Set();
            
            // Limit parallelism if needed, but Promise.all is usually fine for small batches.
            // Map IDs processing
            await Promise.all(unreadMessages.map(async (msg) => {
                if (msg.messageId && !processedIds.has(msg.messageId)) {
                    processedIds.add(msg.messageId);
                    await markMessageAsRead(msg.messageId);
                }
            }));
        }

        // 3. Update DB
        await prisma.whatsAppMessage.updateMany({
            where: {
                restaurantId,
                phoneNumber: phone,
                direction: 'inbound',
                isRead: false
            },
            data: {
                isRead: true
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error marking as read:', error);
        res.status(500).json({ message: 'Error marking messages as read' });
    }
};

// Get Messages for a specific Phone
export const getMessages = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { phone } = req.params;

        const messages = await prisma.whatsAppMessage.findMany({
            where: {
                restaurantId,
                phoneNumber: phone
            },
            orderBy: { timestamp: 'asc' }
        });

        res.json(messages);

    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Error fetching messages' });
    }
};

// Send Typing Indicator
export const sendTyping = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { phone } = req.body;
        if (!phone) return res.status(400).json({ message: 'Phone required' });

        const { sendTypingIndicator } = await import('../lib/whatsapp');
        await sendTypingIndicator(phone);

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending typing:', error);
        res.status(500).json({ message: 'Error sending typing indicator' });
    }
};

// Send Template Message
export const sendTemplate = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { phone, templateId, params } = req.body;

        // Ensure phone starts with 91 for consistency in DB and API
        let formattedPhone = phone.replace(/\D/g, "");
        if (!formattedPhone.startsWith("91")) {
            formattedPhone = `91${formattedPhone}`;
        }
        
        // 1. Send via Helper (V3 with Location)
        const { sendTemplateV3, hydrateTemplate } = await import('../lib/whatsapp');
        
        // Define Location for Brunch di Gala (Hardcoded for now as it's the restaurant location)
        const location = {
            latitude: "22.270041",
            longitude: "73.149727",
            name: "Italy's Traditional Pizzeria",
            address: "Opp. HDFC Bank, Sun Pharma Road, Vadodara"
        };

        // Only send location if it's this specific template (or generally if we decide later)
        if (templateId === 'brunch_di_gala_reservation_confirmation') {
             await sendTemplateV3(formattedPhone, templateId, params || [], location);
        } else {
             await sendTemplateV3(formattedPhone, templateId, params || []);
        }

        // 2. Save to DB (Hydrated content)
        // detailed template text for better UX
        const content = hydrateTemplate(templateId, params || []);
        
        const savedMsg = await prisma.whatsAppMessage.create({
            data: {
                restaurantId,
                phoneNumber: formattedPhone,
                type: 'template',
                content: content, 
                direction: 'outbound',
                status: 'sent',
                timestamp: new Date()
            }
        });

        res.json(savedMsg);

    } catch (error) {
        console.error('Error sending template:', error);
        res.status(500).json({ message: 'Error sending template' });
    }
};

// Send Message
export const sendMessage = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const { phone, message } = req.body;

        // 1. Send via Helper
        const { sendWhatsAppText } = await import('../lib/whatsapp');
        await sendWhatsAppText(phone, message);

        // 2. Save to DB
        const savedMsg = await prisma.whatsAppMessage.create({
            data: {
                restaurantId,
                phoneNumber: phone,
                type: 'text',
                content: message,
                direction: 'outbound',
                status: 'sent',
                timestamp: new Date()
            }
        });

        res.json(savedMsg);

    } catch (error) {
         console.error('Error sending message:', error);
        res.status(500).json({ message: 'Error sending message' });
    }
};

// Get Total Unread Count
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
    try {
        const restaurantId = req.user?.restaurantId;
        if (!restaurantId) return res.status(401).json({ message: 'Unauthorized' });

        const count = await prisma.whatsAppMessage.count({
            where: {
                restaurantId,
                direction: 'inbound',
                isRead: false
            }
        });

        res.json({ count });

    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ message: 'Error fetching unread count' });
    }
};
