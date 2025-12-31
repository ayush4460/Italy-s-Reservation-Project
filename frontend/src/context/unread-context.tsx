"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";
import { useSocket } from "./socket-context";
import { useProfile } from "./profile-context";

interface UnreadContextType {
  unreadCount: number;
  refreshUnreadCount: () => void;
}

const UnreadContext = createContext<UnreadContextType>({
  unreadCount: 0,
  refreshUnreadCount: () => {},
});

export const useUnread = () => useContext(UnreadContext);

export const UnreadProvider = ({ children }: { children: React.ReactNode }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const { socket } = useSocket();
  const { user } = useProfile();

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get("/chat/unread-count");
      setUnreadCount(res.data.count);
    } catch (error) {
      console.error("Failed to fetch unread count", error);
    }
  };

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchUnreadCount();
    }
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    // Refresh on connect to ensure sync
    const handleConnect = () => {
      if (user?.role === "ADMIN") fetchUnreadCount();
    };

    socket.on("connect", handleConnect);

    // @ts-expect-error: Message type is implicitly any for now
    const handleNewMessage = (message: any) => {
      // Only increment for inbound messages
      if (message.direction === "inbound") {
        setUnreadCount((prev) => prev + 1);
      }
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("new_message", handleNewMessage);
    };
  }, [socket]); // Removed user dependency to keep listener stable

  return (
    <UnreadContext.Provider
      value={{
        unreadCount,
        refreshUnreadCount: fetchUnreadCount,
      }}
    >
      {children}
    </UnreadContext.Provider>
  );
};
