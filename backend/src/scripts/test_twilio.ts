import twilio from 'twilio';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g., whatsapp:+14155238886

console.log("--- Twilio Test Script ---");
console.log(`AccountSID: ${accountSid ? 'Found ' + accountSid.substring(0,6) + '...' : 'MISSING'}`);
console.log(`AuthToken: ${authToken ? 'Found' : 'MISSING'}`);
console.log(`WhatsApp Number: ${whatsappNumber || 'MISSING'}`);

if (!accountSid || !authToken || !whatsappNumber) {
    console.error("❌ Missing credentials. Please check .env file.");
    process.exit(1);
}

const client = twilio(accountSid, authToken);

async function testSend() {
    try {
        console.log("Attempting to send test message...");
        
        // Ensure prefixes are present - using non-null assertion (!) as we checked it exists above
        const safeNumber: string = whatsappNumber!;
        const fromNumber = safeNumber.startsWith('whatsapp:') ? safeNumber : `whatsapp:${safeNumber}`;
        
        const message = await client.messages.create({
            body: "Test message from Italy Reservation App",
            from: fromNumber,
            to: 'whatsapp:+917878065085' // Hardcoded to user's number for testing
        });

        console.log("✅ Message Sent Successfully!");
        console.log("SID:", message.sid);
    } catch (error: any) {
        console.error("❌ Setup Failed:", error.message);
        if (error.code === 21608) {
            console.error("\n⚠️  You have not joined the Sandbox yet!");
            console.error("1. Add the Sandbox number to your contacts.");
            console.error("2. Send the 'join code' to it via WhatsApp.");
        }
    }
}

testSend();
