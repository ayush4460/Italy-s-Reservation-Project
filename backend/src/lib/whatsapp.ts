import axios from 'axios';
import prisma from '../utils/prisma';
import { getIO } from './socket';

const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY || '';
const GUPSHUP_APP_NAME = process.env.GUPSHUP_APP_NAME || '';
const GUPSHUP_SRC_PHONE = process.env.GUPSHUP_SRC_PHONE || '';

// Base axios instance for Gupshup V1 API
const gupshupClient = axios.create({
  baseURL: 'https://api.gupshup.io/wa/api/v1',
  headers: {
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/x-www-form-urlencoded',
    'apikey': GUPSHUP_API_KEY
  }
});

// Helper to format phone number
const formatPhone = (phone: string): string => {
  let p = phone.trim();
  if (!p.startsWith('91') && !p.startsWith('+91')) p = `91${p}`;
  if (p.startsWith('+')) p = p.substring(1);
  return p;
};

// 1. Mark Message as Read
export const markMessageAsRead = async (messageId: string) => {
  if (!messageId) return;
  
  try {
    // Gupshup V1 endpoint for marking read
    // PUT /msg/markRead
    const params = new URLSearchParams();
    params.append('channel', 'whatsapp');
    params.append('msgId', messageId);

    console.log(`[WhatsApp] Marking message ${messageId} as read...`);
    
    await gupshupClient.put('/msg/markRead', params);
    return true;
  } catch (error: any) {
    // Log but don't crash - often ID might be invalid or old
    console.error(`[WhatsApp] Error marking message ${messageId} as read:`, error?.response?.data || error.message);
    return false;
  }
};

// 2. Send Typing Indicator (User Status)
export const sendTypingIndicator = async (phone: string) => {
  try {
    const destination = formatPhone(phone);
    
    // As per generic Gupshup/WhatsApp documentation, sending a 'typing' status 
    // often involves the same /msg endpoint but with a specific type or a /status endpoint.
    // However, Gupshup V1 documentation on this is sparse. 
    // We will try the most common known payload for "Is Typing":
    // Sending a separate POST to /msg with type=is_typing or similar is common.
    
    // Attempting a text message with type="is_typing" (Standard in some V1 implementations)
    // or type="typing"
    const params = new URLSearchParams();
    params.append('channel', 'whatsapp');
    params.append('source', GUPSHUP_SRC_PHONE);
    params.append('destination', destination);
    params.append('src.name', GUPSHUP_APP_NAME);
    // Some implementations use type='is_typing' with empty text
    params.append('message', JSON.stringify({ type: 'is_typing' }));

    // console.log(`[WhatsApp] Sending typing indicator to ${destination}`);
    // await gupshupClient.post('/msg', params);
    // FIXME: 'is_typing' type is not standard and is appearing as text. Disabling for now.
    return true;

  } catch (error: any) {
    console.error(`[WhatsApp] Error sending typing indicator:`, error?.message);
    return false;
  }
};

// 3. Send Text Message (Moving from controller to here)
export const sendWhatsAppText = async (phone: string, text: string) => {
  try {
    const destination = formatPhone(phone);
    const params = new URLSearchParams();
    params.append('channel', 'whatsapp');
    params.append('source', GUPSHUP_SRC_PHONE);
    params.append('destination', destination);
    params.append('src.name', GUPSHUP_APP_NAME);
    params.append('message', JSON.stringify({ type: 'text', text: text }));

    console.log(`[WhatsApp] Sending text to ${destination}`);
    const res = await gupshupClient.post('/msg', params);
    return res.data;
  } catch (error: any) {
    console.error(`[WhatsApp] Error sending text to ${phone}:`, error?.response?.data || error.message);
    throw new Error('Failed to send WhatsApp message');
  }
};

// 4. Send Template Message (Generic)
export const sendTemplate = async (phone: string, templateId: string, params: string[]) => {
  try {
    const destination = formatPhone(phone);
    const body = new URLSearchParams();
    body.append('channel', 'whatsapp');
    body.append('source', GUPSHUP_SRC_PHONE);
    body.append('destination', destination);
    body.append('src.name', GUPSHUP_APP_NAME);
    
    // Construct template JSON object
    const templateData = {
        id: templateId,
        params: params
    };
    body.append('template', JSON.stringify(templateData));

    console.log(`[WhatsApp] Sending template ${templateId} to ${destination} with params:`, params);

    const res = await gupshupClient.post('/template/msg', body);
    return res.data;
  } catch (error: any) {
    console.error(`[WhatsApp] Error sending template ${templateId} to ${phone}:`, error?.response?.data || error.message);
    throw new Error('Failed to send WhatsApp template');
  }
};

// 4.1 Send Template Message (Gupshup V3 - supports Headers/Complex types)
export const sendTemplateV3 = async (
    phone: string, 
    templateName: string, 
    params: string[], 
    location?: { latitude: string; longitude: string; name: string; address: string }
) => {
    try {
        const destination = formatPhone(phone);
        
        // Construct V3 Payload (Standard WhatsApp Cloud API format wrapped for Gupshup)
        // API: https://api.gupshup.io/sm/api/v3/msg
        
        // Create the inner Cloud API compatible payload
        const cloudPayload: any = {
            type: "template",
            template: {
                name: templateName,
                language: { code: "en_IN" },
                components: [
                    {
                        type: "body",
                        parameters: params.map(p => ({ type: "text", text: p }))
                    }
                ]
            }
        };

        // Add Location Header if provided
        if (location) {
            // @ts-ignore
            cloudPayload.template.components.unshift({
                type: "header",
                parameters: [
                    {
                        type: "location",
                        location: {
                            latitude: parseFloat(location.latitude),
                            longitude: parseFloat(location.longitude),
                            name: location.name,
                            address: location.address
                        }
                    }
                ]
            });
        }


        console.log(`[WhatsApp V3] Sending Cloud Template to ${destination}`);
        console.log('[WhatsApp V3 Payload]:', JSON.stringify(cloudPayload, null, 2));
        
        // Use the standard Gupshup V1 /msg endpoint which accepts Cloud API payloads 
        // if passed as a stringified JSON in the 'message' field.
        // Endpoint: https://api.gupshup.io/wa/api/v1/msg
        const body = new URLSearchParams();
        body.append('channel', 'whatsapp');
        body.append('source', GUPSHUP_SRC_PHONE);
        body.append('destination', destination);
        body.append('src.name', GUPSHUP_APP_NAME);
        body.append('message', JSON.stringify(cloudPayload));

        const res = await gupshupClient.post('/msg', body);
        console.log('[Gupshup V3 Response]:', JSON.stringify(res.data, null, 2));
        return res.data;

    } catch (error: any) {
        console.error(`[WhatsApp V3] Error sending template ${templateName} to ${phone}:`, error?.response?.data || error.message);
        throw new Error('Failed to send WhatsApp template via V3');
    }
};


// ==========================================
// TEMPLATE DEFINITIONS (For local logging/hydration in DB)
// ==========================================
const TEMPLATES: Record<string, string> = {
  "RESERVATION_CONFIRMATION": `Italy's Cena All'Italiana Reservation Confirmation

*Name:* {{1}}
*Date:* {{2}} 
*Day:* {{3}}
*Batch:* {{4}}
*Time:* {{5}}
*Guests:* {{6}} adults, {{7}} kids (5-10 yrs)
*Contact:* {{8}}
*Food Preparation:* {{9}}

📍*Location:* Italy's Traditional Pizzeria, Opp Earth The Landmark, Nr. BMW Showroom, Sun Pharma Road, Vadodara-390012
🗺️*Google Maps:* https://maps.app.goo.gl/SXtQ6vkx2ho7KBCF7

*Menu:* Cena All'Italiana

*Payment:* CASH/CARD/UPI at restaurant only. No third-party apps (Dineout/Zomato/etc.).

*Reservation Policy:* Held 15 minutes past slot time.

*Support:* Contact 9909000317 for changes.

Thank you. ❤️
Italy's Traditional Pizzeria | Vadodara | [Going] | [Not Going]`,

  "WEEKDAY_BRUNCH": `Italy's Brunch All'Italiana Reservation Confirmation

*Name:* {{1}}
*Date:* {{2}}
*Day:* {{3}}
*Batch:* {{4}}
*Time:* {{5}}
*Guests:* {{6}} adults, {{7}} kids (5–10 yrs)
*Contact:* {{8}}
*Food Preparation:* {{9}}

📍*Location:* Italy's Traditional Pizzeria, Opp Earth The Landmark, Nr. BMW Showroom, Sun Pharma Road, Vadodara-390012
🗺️*Google Maps:* https://maps.app.goo.gl/SXtQ6vkx2ho7KBCF7

*Menu:* Brunch All'Italiana

*Payment:* CASH/CARD/UPI at restaurant only. No third-party apps (Dineout/Zomato/etc.).

*Reservation Policy:* Held 15 minutes past slot time.

*Support:* Contact 9909000317 for changes.

Thank you. ❤️
Italy's Traditional Pizzeria | Vadodara | [Going] | [Not Going]`,

  "WEEKEND_BRUNCH": `Brunch Di Gala All'Italiana Reservation Confirmation

*Name:* {{1}}
*Date:* {{2}}
*Day:* {{3}}
*Batch:* {{4}}
*Time:* {{5}}
*Guests:* {{6}} adults, {{7}} kids (5–10 yrs)
*Contact:* {{8}}
*Food Preparation:* {{9}}

📍*Location:* Italy's Traditional Pizzeria, Opp Earth The Landmark, Nr. BMW Showroom, Sun Pharma Road, Vadodara-390012
🗺️*Google Maps:* https://maps.app.goo.gl/SXtQ6vkx2ho7KBCF7

*Menu:* Brunch Di Gala All'Italiana

*Payment:* CASH/CARD/UPI at restaurant only. No third-party apps (Dineout/Zomato/etc.).

*Reservation Policy:* Held 15 minutes past slot time.

*Support:* Contact 9909000317 for changes.

Thank you. ❤️
Italy's Traditional Pizzeria | Vadodara | [Going] | [Not Going]`,

  "A_LA_CARTE": `Italy’s Traditional Pizzeria
Table Reservation Confirmation

*Name:* {{1}}
*Date:* {{2}} 
*Day:* {{3}}
*Batch:* {{4}}
*Time:* {{5}}
*Guests:* {{6}} adults, {{7}} kids (5-10 yrs)
*Contact:* {{8}}
*Food Preparation:* {{9}}

📍*Location:* Italy's Traditional Pizzeria, Opp Earth The Landmark, Nr. BMW Showroom, Sun Pharma Road, Vadodara-390012
🗺️*Google Maps:* https://maps.app.goo.gl/SXtQ6vkx2ho7KBCF7

*Menu:* A La Carte

*Payment:* CASH/CARD/UPI at restaurant only. No third-party apps (Dineout/Zomato/etc.).

*Reservation Policy:* Held 15 minutes past slot time.

*Support:* Contact 9909000317 for changes.

Thank you. ❤️
Italy's Traditional Pizzeria | Vadodara | [Going] | [Not Going]`,

  "RESERVATION_REQUEST": `Table Reservation Request Received:

*Customer Details:*
Name: {{1}}
Contact: {{2}}

*Booking Request:*
Date: {{3}} ({{4}})
Slot: {{5}}
Adults: {{6}}
Kids: {{7}} (5-10 yrs)
Menu: {{8}}
Sitting: {{9}}
Food Preparation: {{10}}
Special Requirements: {{11}}

Booking Link: https://reservation.theitalys.com/dashboard/reservations
Italy's Traditional Pizzeria | Vadodara | [Click here to book,https://reservation.theitalys.com/dashboard/reservations]`,

  "RESERVATION_REQUEST_GUEST": `*Dear {{1}}*

Thank you for your table reservation request.

We have successfully received your request.

⏳ Our team will share your reservation status within 1 hour.

*📞 Need Immediate Assistance?*
If you do not receive a response within 1 hour, kindly call us at *9909000317* and our team will be happy to assist you.

We truly appreciate your patience and look forward to hosting you for a delightful Italian dining experience.

*Warm regards,*
*Team Italy’s Traditional Pizzeria*
Opp. Earth The Landmark, Nr. BMW Showroom, Sun Pharma Road, Vadodara. | [Call Now,+919909000317]`
};

export const hydrateTemplate = (templateId: string, params: string[]): string => {
  let text = TEMPLATES[templateId];
  if (!text) {
    // Fallback if template text is unknown
    return `[Template: ${templateId}] Params: ${params.join(', ')}`;
  }

  // Replace {{1}}, {{2}}, etc. with params
  params.forEach((param, index) => {
    // Replace all occurrences of {{i+1}}
    const placeholder = new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g');
    text = text.replace(placeholder, param);
  });

  return text;
};

// ==========================================
// CENTRALIZED TEMPLATE REGISTRY (SCALABLE)
// ==========================================

export type WhatsappNotificationType = 
    | 'RESERVATION_CONFIRMATION' 
    | 'WEEKDAY_BRUNCH' 
    | 'WEEKEND_BRUNCH'
    | 'A_LA_CARTE'
    | 'RESERVATION_REQUEST'
    | 'RESERVATION_REQUEST_GUEST';

interface TemplateConfig {
    templateId: string;
    isNative?: boolean; // If true, uses Gupshup Native API (v1/template/msg)
    // Function that takes any data object and returns the sorted string params array
    mapper: (data: any) => string[];
    // Optional static location or function to get location
    location?: { latitude: string; longitude: string; name: string; address: string };
}

/* 
 * REGISTRY
 * Add new templates here.
 */
const TEMPLATE_REGISTRY: Record<WhatsappNotificationType, TemplateConfig> = {
    'RESERVATION_CONFIRMATION': {
        // Dinner Template
        templateId: "a59ba8db-4b41-476f-8a06-e72f3d66b79d",
        isNative: true, 
        mapper: (data: any) => commonReservationMapper(data),
        location: {
            latitude: "22.270041",
            longitude: "73.149727",
            name: "Italy's Traditional Pizzeria",
            address: "Opp Earth The Landmark, Nr. BMW Showroom, Sun Pharma Road, Vadodara-390012"
        }
    },
    'WEEKDAY_BRUNCH': {
        // Weekday Brunch Template
        templateId: "420acea8-d3f9-41de-85ec-252d77e18933",
        isNative: true,
        mapper: (data: any) => commonReservationMapper(data),
        location: {
            latitude: "22.270041",
            longitude: "73.149727",
            name: "Italy's Traditional Pizzeria",
            address: "Opp Earth The Landmark, Nr. BMW Showroom, Sun Pharma Road, Vadodara-390012"
        }
    },
    'WEEKEND_BRUNCH': {
        // Weekend Brunch Template
        templateId: "8fa43f6b-6472-4e51-a84f-1003d4d83851",
        isNative: true,
        mapper: (data: any) => commonReservationMapper(data),
        location: {
            latitude: "22.270041",
            longitude: "73.149727",
            name: "Italy's Traditional Pizzeria",
            address: "Opp Earth The Landmark, Nr. BMW Showroom, Sun Pharma Road, Vadodara-390012"
        }
    },
    'A_LA_CARTE': {
        // A La Carte Template
        templateId: "4ba994c0-0491-467a-9208-38a0c4781398",
        isNative: true,
        mapper: (data: any) => commonReservationMapper(data),
        location: {
            latitude: "22.270041",
            longitude: "73.149727",
            name: "Italy's Traditional Pizzeria",
            address: "Opp Earth The Landmark, Nr. BMW Showroom, Sun Pharma Road, Vadodara-390012"
        }
    },
    'RESERVATION_REQUEST': {
        // New Public Request Template
        templateId: "ccb066a5-3c73-4b25-bede-f8860be595a4",
        isNative: true,
        mapper: (data: any) => {
            // Data: { name, contact, date(Str/Date), slot(Str), adults, kids, menu, foodPref, specialReq }
            const dateObj = new Date(data.date);
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayName = days[dateObj.getDay()]; // {{4}}
            
            // Format Date DD-MM-YYYY {{3}}
            const dayStr = dateObj.getDate().toString().padStart(2, '0');
            const monthStr = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const yearStr = dateObj.getFullYear().toString();
            const formattedDate = `${dayStr}-${monthStr}-${yearStr}`;

            return [
                data.name,                      // {{1}} Name
                data.contact,                   // {{2}} Contact
                formattedDate,                  // {{3}} Date
                dayName,                        // {{4}} Day
                data.slot,                      // {{5}} Slot
                String(data.adults),            // {{6}} Adults
                String(data.kids || '0'),       // {{7}} Kids
                data.menu || '-',               // {{8}} Menu
                data.sitting || '-',            // {{9}} Sitting
                data.foodPref || '-',           // {{10}} Food Prep
                data.specialReq || '-'          // {{11}} Special Req
            ];
        }
    },
    'RESERVATION_REQUEST_GUEST': {
        // Guest Confirmation Template
        templateId: "bfb79440-e9d6-4cd9-b77b-5e70a80f65aa",
        isNative: true,
        mapper: (data: any) => {
            return [
                data.name  // {{1}} Name
            ];
        }
    }
};

// Reusable mapper function since all 3 templates share the EXACT SAME parameters in the same order
export const commonReservationMapper = (data: any): string[] => {
    // Expecting data to contain: 
    // { customerName, date (Date/Str), slot: { startTime, endTime }, adults, kids, contact, foodPref }
    
    const dateObj = new Date(data.date);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[dateObj.getDay()]; // {{3}} Day
    
    const dayStr = dateObj.getDate().toString().padStart(2, '0');
    const monthStr = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const yearStr = dateObj.getFullYear().toString().slice(-2);
    const formattedDate = `${dayStr}/${monthStr}/${yearStr}`; // {{2}} Date

    const startTime = data.slot?.startTime || 'Unknown'; // {{5}} Time
    const endTime = data.slot?.endTime || '';
    const batch = `${startTime} - ${endTime}`; // {{4}} Batch

    const adultsCount = parseInt(data.adults || '0');
    const kidsCount = parseInt(data.kids || '0');
    
    // {{8}} Food Preparation
    const foodPreparation = data.foodPref || 'Not Specified';

    return [
        (data.customerName || 'Guest').trim(),  // {{1}} Name
        formattedDate,                 // {{2}} Date
        dayName,                       // {{3}} Day
        batch,                         // {{4}} Batch
        startTime,                     // {{5}} Time
        adultsCount.toString(),        // {{6}} No. of Adults
        kidsCount.toString(),          // {{7}} No. of Kids
        data.contact || '',            // {{8}} Contact Number
        foodPreparation                // {{9}} Food Preparation
    ];
};

// NEW: Gupshup Native Template Sender (Mimics user's curl)
const sendGupshupNativeTemplate = async (
    destination: string, 
    templateId: string, 
    params: string[], 
    location?: { latitude: string; longitude: string; name: string; address: string }
) => {
    try {
        const source = process.env.GUPSHUP_SRC_PHONE || "919909442317";
        const appName = process.env.GUPSHUP_APP_NAME || "TheItalysReservation";

        // Construct Body as URL Encoded Form Data
        const body = new URLSearchParams();
        body.append('channel', 'whatsapp');
        body.append('source', source);
        body.append('destination', destination);
        body.append('src.name', appName);
        
        // Template Param JSON (params array directly)
        const templateJson = JSON.stringify({
            id: templateId,
            params: params
        });
        body.append('template', templateJson);

        // Location as 'message' param if exists
        if (location) {
            const messageJson = JSON.stringify({
                type: 'location',
                location: {
                    latitude: parseFloat(location.latitude), 
                    longitude: parseFloat(location.longitude),
                    name: location.name,
                    address: location.address
                }
            });
            body.append('message', messageJson);
        }

        console.log(`[Gupshup Native] Sending Template ${templateId} to ${destination}`);
        console.log(`[Gupshup Native] Params:`, JSON.stringify(params));

        const res = await gupshupClient.post('/template/msg', body);
        console.log('[Gupshup Native Response]:', JSON.stringify(res.data, null, 2));
        return res.data;

    } catch (error: any) {
        console.error('[Gupshup Native] Error:', error.response?.data || error.message);
        throw error;
    }
}


/**
 * Scalable Wrapper to send any notification by Type
 * AUTOMATICALLY HANDLES DISPATCH TO NATIVE OR V3
 */
export const sendWhatsappNotification = async (
    phone: string,
    type: WhatsappNotificationType,
    data: any,
    restaurantId?: number
) => {
    const config = TEMPLATE_REGISTRY[type];
    if (!config) {
        console.error(`[WhatsApp] Unknown notification type: ${type}`);
        return null;
    }

    try {
        const params = config.mapper(data);
        
        let response;
        if (config.isNative) {
            response = await sendGupshupNativeTemplate(phone, config.templateId, params, config.location);
        } else {
            // Use sendTemplateV3 which supports location headers (Cloud API style)
            response = await sendTemplateV3(phone, config.templateId, params, config.location);
        }

        // --- Log to DB if restaurantId is provided ---
        if (restaurantId && response) {
            try {
                const content = hydrateTemplate(type, params);
                const savedMsg = await prisma.whatsAppMessage.create({
                    data: {
                        restaurantId,
                        phoneNumber: formatPhone(phone),
                        type: 'template',
                        content,
                        direction: 'outbound',
                        status: 'sent',
                        timestamp: new Date()
                    }
                });

                // Emit socket event to update Chat UI
                try {
                    const io = getIO();
                    io.to(`restaurant_${restaurantId}`).emit('new_message', savedMsg);
                } catch (socketErr) {
                    console.error('[WhatsApp] Socket emit failed:', socketErr);
                }
            } catch (dbErr) {
                console.error('[WhatsApp] Failed to log outbound message to DB:', dbErr);
            }
        }

        return response;
    } catch (error) {
        console.error(`[WhatsApp] Failed to send centralized notification [${type}]:`, error);
        return null;
    }
};

/**
 * SMART TEMPLATE SENDER
 * Use this when you have a template ID (UUID) directly and a params array.
 * It checks the registry to see if this UUID is known to be a Native template.
 * If so, it uses the Native API. usage: Dashboard manual send.
 */
export const sendSmartWhatsAppTemplate = async (
    phone: string, 
    templateIdOrKey: string, 
    params: string[], 
    location?: { latitude: string; longitude: string; name: string; address: string },
    restaurantId?: number
) => {
    // 1. Check if input matches a Registry Key (e.g. "WEEKDAY_BRUNCH")
    let config: TemplateConfig | undefined = TEMPLATE_REGISTRY[templateIdOrKey as WhatsappNotificationType];
    let resolvedKey = config ? templateIdOrKey : null;

    // 2. If not a key, check if it matches a UUID in the registry
    if (!config) {
        const entry = Object.entries(TEMPLATE_REGISTRY).find(([key, c]) => c.templateId === templateIdOrKey);
        if (entry) {
            resolvedKey = entry[0];
            config = entry[1];
        }
    }

    try {
        let response;
        if (config && config.isNative) {
            // Use Native
            const loc = location || config.location;
            console.log(`[SmartWhatsApp] Resolved '${templateIdOrKey}' to UUID '${config.templateId}' (Native)`);
            response = await sendGupshupNativeTemplate(phone, config.templateId, params, loc);
        } else {
            // Fallback or V3
            console.log(`[SmartWhatsApp] Sending '${templateIdOrKey}' via V3 (Cloud API)`);
            response = await sendTemplateV3(phone, templateIdOrKey, params, location);
        }

        // --- Log to DB if restaurantId is provided ---
        if (restaurantId && response) {
            try {
                // Determine template key for hydration
                // If not in registry, we'll just show the raw template ID/params
                const content = resolvedKey 
                    ? hydrateTemplate(resolvedKey, params)
                    : `[Template: ${templateIdOrKey}] Params: ${params.join(', ')}`;

                const savedMsg = await prisma.whatsAppMessage.create({
                    data: {
                        restaurantId,
                        phoneNumber: formatPhone(phone),
                        type: 'template',
                        content,
                        direction: 'outbound',
                        status: 'sent',
                        timestamp: new Date()
                    }
                });

                // Emit socket event to update Chat UI
                try {
                    const io = getIO();
                    io.to(`restaurant_${restaurantId}`).emit('new_message', savedMsg);
                } catch (socketErr) {
                    console.error('[WhatsApp] Socket emit failed:', socketErr);
                }
            } catch (dbErr) {
                console.error('[WhatsApp] Failed to log outbound message to DB:', dbErr);
            }
        }

        return response;
    } catch (error) {
        console.error('[SmartWhatsApp] Error:', error);
        throw error;
    }
};

