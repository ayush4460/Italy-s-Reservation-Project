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
                language: { code: "en" },
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
                            latitude: location.latitude,
                            longitude: location.longitude,
                            name: location.name,
                            address: location.address
                        }
                    }
                ]
            });
        }

        console.log(`[WhatsApp V3] Sending Cloud Template to ${destination}`);
        
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
        return res.data;

    } catch (error: any) {
        console.error(`[WhatsApp V3] Error sending template ${templateName} to ${phone}:`, error?.response?.data || error.message);
        throw new Error('Failed to send WhatsApp template via V3');
    }
};

// 5. Template Definitions & Hydration
// Store known templates here to reconstruct the message content for the DB
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
