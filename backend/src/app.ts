import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import tableRoutes from './routes/tables.routes';
import restaurantRoutes from './routes/restaurant.routes';
import reservationRoutes from './routes/reservations.routes';
import dashboardRoutes from './routes/dashboard.routes';

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/dashboard', dashboardRoutes);



app.get('/', (req, res) => {
  res.send('Restaurant Reservation API is running');
});

export default app;
