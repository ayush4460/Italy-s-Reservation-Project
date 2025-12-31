"use client";

import React, { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { useSocket } from "@/context/socket-context";
import { useProfile } from "@/context/profile-context";
import { useUnread } from "@/context/unread-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Phone, User, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WhatsAppTemplateSelector } from "@/components/chat/whatsapp-template-selector";
import { MessageFormatter } from "@/components/chat/message-formatter";

interface ChatPreview {
  phoneNumber: string;
  content: string;
  timestamp: string;
  direction: string;
  status: string;
  unreadCount?: number;
  customerName?: string;
}

interface Message {
  id: number;
  content: string;
  direction: "inbound" | "outbound";
  timestamp: string;
  status: string;
  type: string;
}

export default function ChatPage() {
  const [chats, setChats] = useState<ChatPreview[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingChats, setLoadingChats] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  const { user, loading } = useProfile();
  const { refreshUnreadCount } = useUnread();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  // Fetch Chat List
  const fetchChats = async () => {
    try {
      const res = await api.get("/chat");
      setChats(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load chats");
    } finally {
      setLoadingChats(false);
    }
  };

  // Fetch Messages for Selected Phone
  const fetchMessages = async (phone: string) => {
    // setLoadingMessages(true);
    try {
      const res = await api.get(`/chat/${phone}`);
      setMessages(res.data);
      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load messages");
    } finally {
      // setLoadingMessages(false);
    }
  };

  // Send Message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPhone || !newMessage.trim()) return;

    const tempMsg: Message = {
      id: Date.now(),
      content: newMessage,
      direction: "outbound",
      timestamp: new Date().toISOString(),
      status: "sending",
      type: "text",
    };

    // Optimistic UI
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage("");

    try {
      await api.post("/chat/send", {
        phone: selectedPhone,
        message: tempMsg.content,
      });
      // Refresh messages to get the real one with correct status
      fetchMessages(selectedPhone);
    } catch {
      toast.error("Failed to send message");
    }
  };

  // Typing Indicator Logic
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = () => {
    if (!selectedPhone) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing status (throttled/debounced logic if needed, but for now simple trigger)
    // Actually, standard typing indicators last for X seconds.
    // We should send it once every few seconds if user keeps typing.
    // Simple approach: Send on first keypress, then debounce clearing?
    // Better: Debounce the API call itself to avoid spamming every char.

    // We want to send "typing" event, then wait a bit before allowing another one.
    // But usually "typing" means "I started typing".

    // Let's implement a simple debounce:
    if (!typingTimeoutRef.current) {
      api.post("/chat/typing", { phone: selectedPhone }).catch(console.error);
    }

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 3000); // Only allow sending "typing" once every 3 seconds
  };

  // Initial Load
  useEffect(() => {
    fetchChats();
  }, []);

  // Socket Integration
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on(
      "new_message",
      (message: Message & { phoneNumber: string; customerName?: string }) => {
        // 1. Update Messages if looking at this chat
        if (selectedPhone === message.phoneNumber) {
          setMessages((prev) => [...prev, message]);
          // Scroll to bottom
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollIntoView({ behavior: "smooth" });
            }
          }, 100);
        }

        // 2. Update Chat List (Move to top)
        setChats((prevChats) => {
          const otherChats = prevChats.filter(
            (c) => c.phoneNumber !== message.phoneNumber
          );
          const existingChat = prevChats.find(
            (c) => c.phoneNumber === message.phoneNumber
          );

          // Increment unread count if it's an inbound message and we are NOT looking at this chat
          let newUnreadCount = existingChat?.unreadCount || 0;
          if (
            message.direction === "inbound" &&
            selectedPhone !== message.phoneNumber
          ) {
            newUnreadCount += 1;
          }

          const newChatEntry = {
            phoneNumber: message.phoneNumber,
            content: message.content,
            timestamp: message.timestamp || new Date().toISOString(),
            direction: message.direction,
            status: message.status,
            unreadCount: newUnreadCount,
            customerName: message.customerName || existingChat?.customerName,
          };

          return [newChatEntry, ...otherChats];
        });
      }
    );

    return () => {
      socket.off("new_message");
    };
  }, [socket, selectedPhone]);

  // Initial Message Load for Selected Phone
  useEffect(() => {
    if (!selectedPhone) return;

    // Mark as Read
    api.put(`/chat/${selectedPhone}/read`).then(() => {
      // Refresh GLOBAL unread count after marking as read
      refreshUnreadCount();
    });

    // Reset local unread count
    setChats((prev) =>
      prev.map((c) =>
        c.phoneNumber === selectedPhone ? { ...c, unreadCount: 0 } : c
      )
    );

    fetchMessages(selectedPhone);
  }, [selectedPhone, refreshUnreadCount]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <div className="pt-6 h-[calc(100vh-100px)] flex gap-6">
      {/* Sidebar: Chat List */}
      <Card
        className={cn(
          "glass-panel border-none flex flex-col h-full transition-all duration-300",
          "w-full md:w-1/3", // Full width on mobile, 1/3 on desktop
          selectedPhone ? "hidden md:flex" : "flex" // Hide on mobile if chat selected
        )}
      >
        <CardHeader className="pb-4 border-b border-white/10">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold text-white">
              Chats
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchChats}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {loadingChats ? (
              <div className="p-4 text-center text-gray-400">Loading...</div>
            ) : chats.length === 0 ? (
              <div className="p-4 text-center text-gray-400">
                No conversations yet
              </div>
            ) : (
              <div className="flex flex-col">
                {chats.map((chat) => (
                  <button
                    key={chat.phoneNumber}
                    onClick={() => setSelectedPhone(chat.phoneNumber)}
                    className={cn(
                      "flex items-start gap-3 p-4 text-left transition-colors border-b border-white/5",
                      selectedPhone === chat.phoneNumber
                        ? "bg-white/10"
                        : "hover:bg-white/5"
                    )}
                  >
                    <Avatar>
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${chat.phoneNumber}`}
                      />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium text-white">
                          {chat.phoneNumber}
                          {chat.customerName && (
                            <span className="text-gray-400 font-normal ml-2 text-sm">
                              ~ {chat.customerName}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {!!chat.unreadCount && chat.unreadCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {chat.unreadCount}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(chat.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 truncate">
                        {chat.direction === "outbound" && "You: "}
                        {chat.content}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Area: Chat Window */}
      <Card
        className={cn(
          "glass-panel border-none flex-col h-full",
          "flex-1",
          !selectedPhone ? "hidden md:flex" : "flex w-full md:w-auto" // Show only on desktop if no selection, full width on mobile if selected
        )}
      >
        {selectedPhone ? (
          <>
            {/* Chat Header */}
            <CardHeader className="py-4 border-b border-white/10 flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Back Button for Mobile */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-gray-400 hover:text-white -ml-2"
                  onClick={() => setSelectedPhone(null)}
                >
                  <X className="h-5 w-5 rotate-45" />{" "}
                  {/* Using X as back or we can import ChevronLeft */}
                </Button>

                <Avatar>
                  <AvatarImage
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedPhone}`}
                  />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg text-white">
                    {selectedPhone}
                  </CardTitle>
                  <div className="flex items-center gap-1 text-xs text-green-400">
                    <Phone className="h-3 w-3" /> WhatsApp
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPhone(null)}
                className="text-gray-400 hover:text-white hover:bg-white/10 hidden md:flex" // Hide close on mobile, use Back instead
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            {/* Messages Area */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={cn(
                    "flex w-full",
                    msg.direction === "outbound"
                      ? "justify-end"
                      : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] md:max-w-[70%] rounded-2xl px-4 py-2 shadow-sm text-sm md:text-base", // Adjust text size/width for mobile
                      msg.direction === "outbound"
                        ? "bg-blue-600 text-white rounded-br-none"
                        : "bg-white/10 text-white rounded-bl-none"
                    )}
                  >
                    <MessageFormatter content={msg.content} />
                    <span className="text-[10px] opacity-70 block text-right mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                      {msg.status &&
                        msg.direction === "outbound" &&
                        ` • ${msg.status}`}
                    </span>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </CardContent>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-black/20">
              <div className="flex flex-row items-center gap-2">
                <div className="shrink-0">
                  <WhatsAppTemplateSelector
                    phone={selectedPhone}
                    onSendSuccess={() => fetchMessages(selectedPhone)}
                  />
                </div>
                <form
                  onSubmit={handleSend}
                  className="flex gap-2 flex-1 items-center"
                >
                  <Input
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Type a message..."
                    className="glass-input flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="glass-button bg-blue-600 hover:bg-blue-700 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="bg-white/5 p-6 rounded-full mb-4">
              <Phone className="h-12 w-12 opacity-50" />
            </div>
            <p className="text-lg font-medium">
              Select a conversation to start chatting
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
