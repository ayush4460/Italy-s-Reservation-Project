import axios from 'axios';

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

    console.log(`[WhatsApp] Sending typing indicator to ${destination}`);
    await gupshupClient.post('/msg', params);
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
  "brunch_di_gala_reservation_confirmation": `Hello {{1}}, 👋  

Your reservation for *Brunch Di Gala All'Italiana* is confirmed!🍕

📅 *Date:* {{2}}  
🗓️ *Day:* {{3}}  
🕑 *Batch:* {{4}}  
⏰ *Time:* {{5}}  
👨‍👩‍👧‍👦 *Guests:* {{6}}  
📞 *Contact:* {{7}}  
🍽️ *Food Preparation:* {{8}}

📍 *Location:* Opp. HDFC Bank, Sun Pharma Road, Vadodara  
🔗 [Google Maps Location](https://maps.app.goo.gl/SXtQ6vkx2ho7KBCF7)

We look forward to serving you *18+ traditional Italian dishes* — including Woodfired Pizza, Pasta, and Risotto — along with *mocktails and desserts (single serve).* 🍝🥗🍰

💳 *Payment Options:*  
CASH / UPI only via restaurant payment gateways.  
❌ Payments via Dineout, EazyDiner, or Zomato are *not accepted.*

⚠️ *Note:* Reservations will be held for 15 minutes beyond your scheduled time.  
If you expect a delay, please inform us in advance so we can accommodate you in the next available slot (subject to availability).  

For more information, contact us at *9909000317*.

Grazie! ❤️  
See you soon at *Italy’s Traditional Pizzeria*`,
  "italys_unlimited_dinner_reservation": `Hello {{1}}, 👋  

Your reservation for *Cena All'Italiana* is confirmed!🍕

📅 *Date:* {{2}}  
🗓️ *Day:* {{3}}  
🕑 *Batch:* {{4}}  
⏰ *Time:* {{5}}  
👨‍👩‍👧‍👦 *Guests:* {{6}} Adults, {{7}} Kids  
📞 *Contact:* {{8}}  
🍽️ *Food Preparation:* {{9}}

📍 *Location:* Opp. HDFC Bank, Sun Pharma Road, Vadodara  
🔗 [Google Maps Location](https://maps.app.goo.gl/SXtQ6vkx2ho7KBCF7)

We look forward to serving you *18+ traditional Italian dishes* — including Woodfired Pizza, Pasta, and Risotto — along with *mocktails and desserts (single serve).* 🍝🥗🍰

💳 *Payment Options:*  
CASH / UPI only via restaurant payment gateways.  
❌ Payments via Dineout, EazyDiner, or Zomato are *not accepted.*

⚠️ *Note:* Reservations will be held for 15 minutes beyond your scheduled time.  
If you expect a delay, please inform us in advance so we can accommodate you in the next available slot (subject to availability).  

For more information, contact us at *9909000317*.

Grazie! ❤️  
See you soon at *Italy’s Traditional Pizzeria*`
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
    | 'WEEKEND_BRUNCH';

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
        // UUID from user's curl command (Unlimited Dinner)
        templateId: "7cdf4e95-3789-485f-931d-7471305996c3",
        isNative: true, 
        mapper: (data: any) => commonReservationMapper(data),
        location: {
            latitude: "22.270041",
            longitude: "73.149727",
            name: "Italy's Traditional Pizzeria",
            address: "Opp. HDFC Bank, Sun Pharma Road, Vadodara"
        }
    },
    'WEEKDAY_BRUNCH': {
        // UUID for Weekday Brunch
        templateId: "4dbf5ed7-cc67-4dc0-ab5a-c75e3c0950e4",
        isNative: true,
        mapper: (data: any) => commonReservationMapper(data),
        location: {
            latitude: "22.270041",
            longitude: "73.149727",
            name: "Italy's Traditional Pizzeria",
            address: "Opp. HDFC Bank, Sun Pharma Road, Vadodara"
        }
    },
    'WEEKEND_BRUNCH': {
        // UUID for Weekend Brunch
        templateId: "191c6096-d9b5-432e-ab90-f3a2e86f6046",
        isNative: true,
        mapper: (data: any) => commonReservationMapper(data),
        location: {
            latitude: "22.270041",
            longitude: "73.149727",
            name: "Italy's Traditional Pizzeria",
            address: "Opp. HDFC Bank, Sun Pharma Road, Vadodara"
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
    data: any
) => {
    const config = TEMPLATE_REGISTRY[type];
    if (!config) {
        console.error(`[WhatsApp] Unknown notification type: ${type}`);
        return null;
    }

    try {
        const params = config.mapper(data);
        
        if (config.isNative) {
            return await sendGupshupNativeTemplate(phone, config.templateId, params, config.location);
        } else {
            // Use sendTemplateV3 which supports location headers (Cloud API style)
            return await sendTemplateV3(phone, config.templateId, params, config.location);
        }
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
    location?: { latitude: string; longitude: string; name: string; address: string }
) => {
    // 1. Check if input matches a Registry Key (e.g. "WEEKDAY_BRUNCH")
    // Explicitly type config to allow undefined (since find can return undefined)
    let config: TemplateConfig | undefined = TEMPLATE_REGISTRY[templateIdOrKey as WhatsappNotificationType];
    
    // 2. If not a key, check if it matches a UUID in the registry
    if (!config) {
        config = Object.values(TEMPLATE_REGISTRY).find(c => c.templateId === templateIdOrKey);
    }

    if (config && config.isNative) {
        // Use Native
        const loc = location || config.location;
        console.log(`[SmartWhatsApp] Resolved '${templateIdOrKey}' to UUID '${config.templateId}' (Native)`);
        return await sendGupshupNativeTemplate(phone, config.templateId, params, loc);
    } else {
        // Fallback or V3
        console.log(`[SmartWhatsApp] Sending '${templateIdOrKey}' via V3 (Cloud API)`);
        return await sendTemplateV3(phone, templateIdOrKey, params, location);
    }
};

