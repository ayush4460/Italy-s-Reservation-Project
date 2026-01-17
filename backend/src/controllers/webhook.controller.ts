import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// Handle Incoming Webhook
export const handleGupshupWebhook = async (req: Request, res: Response) => {
    try {
        const payload = req.body;
        console.log('[Webhook] Received:', JSON.stringify(payload, null, 2));

        let customerPhone = '';
        let content = '';
        let type = '';
        let messageId = '';
        let customerName = '';

        // Strategy A: Meta/WhatsApp Cloud API Format (from user logs)
        if (payload.object === 'whatsapp_business_account' && payload.entry) {
            const entry = payload.entry[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            if (value?.messages && value.messages.length > 0) {
                const message = value.messages[0];
                customerPhone = message.from; // e.g. "917878065085"
                type = message.type;
                messageId = message.id;

                if (type === 'text') {
                    content = message.text?.body || '';
                } else {
                    content = `[${type} message]`;
                }

                // Extract Customer Name
                if (value.contacts && value.contacts.length > 0) {
                    const contact = value.contacts[0];
                    if (contact.profile && contact.profile.name) {
                        customerName = contact.profile.name;
                    }
                }
            } else if (value?.statuses && value.statuses.length > 0) {
                console.log('[Webhook] Status Update:', JSON.stringify(value.statuses, null, 2));
                return res.status(200).send('OK');
            } else {
                // Status update or other event (ignored for now)
                return res.status(200).send('OK'); 
            }
        } 
        // Strategy B: Gupshup Legacy/Proprietary Format (fallback)
        else if (payload.type === 'message') {
            const incoming = payload.payload;
            customerPhone = incoming.source;
            type = incoming.type;
            customerName = incoming.sender?.name || ''; // Try to get name if available in this format
            
            if (type === 'text') {
                content = incoming.payload.text;
            } else {
                 content = JSON.stringify(incoming.payload);
            }
        } else {
            // Unknown format or status update
            return res.status(200).send('OK');
        }

        if (!customerPhone || !content) {
             return res.status(200).send('OK');
        }

        // Logic to identify Restaurant
        // Try to match exact phone or without 91 prefix
        const phoneWithoutPrefix = customerPhone.startsWith('91') ? customerPhone.substring(2) : customerPhone;
        
        const latestReservation = await prisma.reservation.findFirst({
            where: {
                OR: [
                    { contact: customerPhone },
                    { contact: phoneWithoutPrefix },
                    { contact: `+${customerPhone}` },
                    { contact: `+${phoneWithoutPrefix}` }
                ]
            },
            orderBy: { createdAt: 'desc' },
            include: { table: true } // to get restaurantId
        });

        let restaurantId = 1; // Default fallback (e.g., Admin or Main Branch)
        
        if (latestReservation && latestReservation.table.restaurantId) {
            restaurantId = latestReservation.table.restaurantId;
        }

        // Save to DB
        const savedMessage = await prisma.whatsAppMessage.create({
            data: {
                restaurantId,
                phoneNumber: customerPhone,
                customerName,
                type,
                content,
                messageId,
                direction: 'inbound',
                status: 'received',
                timestamp: new Date()
            }
        });
        
        console.log(`[Webhook] Saved message from ${customerPhone} for Restaurant ${restaurantId}`);

        // Emit Socket Event
        try {
            const { getIO } = await import('../lib/socket');
            const io = getIO();
            io.to(`restaurant_${restaurantId}`).emit('new_message', savedMessage);

            // Send Email Notification (Async/Non-blocking)
            // Fetch restaurant email first
            prisma.restaurant.findUnique({
                where: { id: restaurantId },
                select: { email: true, name: true, username: true }
            }).then(restaurant => {
                if (restaurant && restaurant.email && savedMessage.direction === 'inbound') {
                    import('../services/email.service').then(({ EmailService }) => {
                         EmailService.sendWhatsAppNotification(restaurant.email, {
                            customerName: savedMessage.customerName || 'Unknown',
                            phoneNumber: savedMessage.phoneNumber,
                            message: savedMessage.content,
                            timestamp: savedMessage.timestamp,
                            restaurantName: restaurant.name,
                            ownerName: restaurant.username || 'Admin' 
                        }).catch(err => console.error('[Webhook] Email Notification Fail:', err));
                    });
                }
            }).catch(err => console.error('[Webhook] Failed to fetch restaurant for email:', err));

        } catch (socketError) {
            console.error('[Webhook] Socket emit error:', socketError);
        }

        // Always return 200 to acknowledge receipt
        res.status(200).send('OK');

    } catch (error) {
        console.error('[Webhook] Error:', error);
        res.status(500).send('Error processing webhook');
    }
};
