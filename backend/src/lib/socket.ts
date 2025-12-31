import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        process.env.FRONTEND_URL || "https://italy-reservation.vercel.app"
      ],
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
