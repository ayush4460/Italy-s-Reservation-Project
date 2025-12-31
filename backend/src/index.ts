import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import { initializeSocket } from './lib/socket';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
initializeSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Loaded WhatsApp Number: ${process.env.TWILIO_WHATSAPP_NUMBER || 'NOT SET'}`);
});
