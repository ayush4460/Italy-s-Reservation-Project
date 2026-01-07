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

const app = express();

const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL || 'https://italy-reservation.vercel.app',
  process.env.APP_URL || 'https://reservation.theitalys.com' 
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser()); // Use cookie-parser middleware

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/chat', chatRoutes);



app.get('/', (req, res) => {
  res.send('Restaurant Reservation API is running');
});

export default app;
