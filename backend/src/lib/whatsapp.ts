import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g., whatsapp:+14155238886

// Initialize client
const client = (accountSid && authToken) ? twilio(accountSid, authToken) : null;

export const sendReservationTemplate = async (
  to: string, 
  dateStr: string, 
  timeStr: string
) => {
  if (!client) {
    console.error("Twilio client not initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
    return;
  }
  if (!whatsappNumber) {
    console.error("TWILIO_WHATSAPP_NUMBER is missing in .env");
    return;
  }

  const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const formattedFrom = whatsappNumber.startsWith('whatsapp:') ? whatsappNumber : `whatsapp:${whatsappNumber}`;

  // DEBUG: explicitly log what we are sending
  console.log(`[Twilio] Sending from ${formattedFrom} to ${formattedTo}`);
  console.log(`[Twilio] ContentSid: HXb5b62575e6e4ff6129ad7c8efe1f983e`);
  
  try {
    const message = await client.messages.create({
      from: formattedFrom,
      to: formattedTo,
      contentSid: 'HXb5b62575e6e4ff6129ad7c8efe1f983e', 
      contentVariables: JSON.stringify({
        "1": dateStr,
        "2": timeStr
      })
    });

    console.log(`[Twilio] Message Sent! SID: ${message.sid}`);
  } catch (error: any) {
    console.error("[Twilio] Error Sending Message:", error.message || error);
    if (error.code === 21608) {
       console.warn("Tip: This is a 'verified' sandbox number check. Make sure your phone number has joined the sandbox by sending 'join <your-code>' to the sandbox number.");
    }
  }
};

export const sendWhatsAppMessage = async (to: string, body: string) => {
   console.log(`[Twilio Service] Attempting to send text to ${to}`);
   
   if (!client) {
       console.error("[Twilio Service] ERROR: Client is NULL. Credentials invalid?");
       return;
   }
   if (!whatsappNumber) {
       console.error("[Twilio Service] ERROR: WhatsApp Number is NULL.");
       return;
   }

   try {
     const from = whatsappNumber.startsWith('whatsapp:') ? whatsappNumber : `whatsapp:${whatsappNumber}`;
     const formatTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
     
     console.log(`[Twilio Service] calling client.messages.create... From: ${from}, To: ${formatTo}`);

     const msg = await client.messages.create({
        from: from,
        to: formatTo,
        body
     });
     console.log(`[Twilio Service] SUCCESS! SID: ${msg.sid}`);
   } catch (e: any) {
     console.error("[Twilio Service] EXCEPTION:", e.message || e);
   }
};
