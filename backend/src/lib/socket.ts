import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export const initializeSocket = (server: HttpServer) => {
  const socketAllowedOrigins = [
    "http://localhost:3000",
    "http://localhost:4000",
    "http://localhost:5000",
    "https://italy-reservation.vercel.app",
    "http://italy-reservation.vercel.app",
    "https://reservation.theitalys.com",
    "http://reservation.theitalys.com",
    "https://www.reservation.theitalys.com",
    "http://www.reservation.theitalys.com",
    "https://susanne-lockable-forrest.ngrok-free.dev",
  ];

  if (process.env.FRONTEND_URL) {
    socketAllowedOrigins.push(process.env.FRONTEND_URL);
  }
  if (process.env.APP_URL) {
    socketAllowedOrigins.push(process.env.APP_URL);
  }

  io = new Server(server, {
    cors: {
      origin: socketAllowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    // console.log('Client connected:', socket.id);

    // Client (Frontend) will emit this event to join their restaurant's room
    socket.on('join_restaurant', (restaurantId) => {
        if(restaurantId) {
            socket.join(`restaurant_${restaurantId}`);
            console.log(`Socket ${socket.id} joined restaurant_${restaurantId}`);
        }
    });

    socket.on('disconnect', () => {
      // console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
