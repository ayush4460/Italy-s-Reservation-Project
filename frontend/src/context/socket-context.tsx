"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useProfile } from "./profile-context";

/*
 * Socket Context
 * Manages the single persistent socket connection for the dashboard.
 * Joins the restaurant's room upon connection.
 */

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { restaurant } = useProfile();

  useEffect(() => {
    if (!restaurant) return;

    // Determine Socket URL dynamically matching the current window host (for mobile/LAN access)
    // or fallback to localhost if server-side (though this component is client-only).
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL &&
      window.location.hostname !== "localhost"
        ? process.env.NEXT_PUBLIC_SOCKET_URL
        : typeof window !== "undefined"
          ? `http://${window.location.hostname}:5000`
          : "http://localhost:5000";

    const socketInstance = io(socketUrl, {
      withCredentials: true,
      autoConnect: true,
    });

    socketInstance.on("connect", () => {
      console.log("Socket connected:", socketInstance.id);
      setIsConnected(true);

      // Join Restaurant Room
      socketInstance.emit("join_restaurant", restaurant.id);
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    // Avoid synchronous state update warning
    setTimeout(() => {
      setSocket(socketInstance);
    }, 0);

    return () => {
      socketInstance.disconnect();
    };
  }, [restaurant]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
