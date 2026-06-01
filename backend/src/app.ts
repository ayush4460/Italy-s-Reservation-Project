import express from 'express'; 
import cors from 'cors';
import cookieParser from 'cookie-parser'; // Import cookie-parser
import authRoutes from './routes/auth.routes';
import tableRoutes from './routes/tables.routes';
import restaurantRoutes from './routes/restaurant.routes';
import reservationRoutes from './routes/reservations.routes';
import dashboardRoutes from './routes/dashboard.routes';
import staffRoutes from './routes/staff.routes';
import webhookRoutes from './routes/webhook.routes';
import chatRoutes from './routes/chat.routes';
import publicRoutes from './routes/public.routes';
import slotAvailabilityRoutes from './routes/slot-availability.routes';

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:5000',
  'https://italy-reservation.vercel.app',
  'http://italy-reservation.vercel.app',
  'https://reservation.theitalys.com',
  'http://reservation.theitalys.com',
  'https://www.reservation.theitalys.com',
  'http://www.reservation.theitalys.com',
  'https://susanne-lockable-forrest.ngrok-free.dev',
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.APP_URL) {
  allowedOrigins.push(process.env.APP_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser()); // Use cookie-parser middleware

// Serve Static Files from 'uploads' directory
import path from 'path';
import fs from 'fs';
const uploadsPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/api/uploads', express.static(uploadsPath));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/slot-availability', slotAvailabilityRoutes);



app.get('/', (req, res) => {
  res.send('Restaurant Reservation API is running');
});

export default app;
