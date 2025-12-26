import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import tableRoutes from './routes/tables.routes';
import restaurantRoutes from './routes/restaurant.routes';

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.use((req, res, next) => {
    console.log('Incoming request:', req.method, req.path);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/restaurants', restaurantRoutes);

app.get('/api/test', (req, res) => {
  res.send('Test route works');
});

app.get('/', (req, res) => {
  console.log('Root hit!');
  res.send('Restaurant Reservation API is running');
});

export default app;
