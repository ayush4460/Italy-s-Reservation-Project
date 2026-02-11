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
import {
  Send,
  Phone,
  User,
  RefreshCw,
  X,
  Search,
  ArrowLeft,
} from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredChats = chats.filter(
    (chat) =>
      chat.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.customerName &&
        chat.customerName.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const { user, loading } = useProfile();
  const { refreshUnreadCount } = useUnread();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== "ADMIN") {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  // Fetch Chat List
  const fetchChats = async (background = false) => {
    try {
      const res = await api.get("/chat", {
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Expires: "0",
        },
        // @ts-expect-error: skipLoader is custom config
        skipLoader: background,
      });
      setChats(res.data);
    } catch (err) {
      console.error(err);
      if (!background) toast.error("Failed to load chats");
    } finally {
      if (!background) setLoadingChats(false);
    }
  };

  // Fetch Messages for Selected Phone
  const fetchMessages = async (phone: string) => {
    // setLoadingMessages(true); // Uncomment if we implement local loading UI later
    try {
      const res = await api.get(`/chat/${phone}`, {
        // @ts-expect-error: skipLoader is custom config
        skipLoader: true,
      });
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

          // If we are looking at it, mark as read immediately?
          // We usually do this in useEffect dependency on selectedPhone.
          // But for real-time, we might want to ACK read?
          // For now, let's just refresh list which will show unread=0 if we read it?
          // Actually if we just received it, it is Unread in DB.
          // We need to mark it read if we are viewing it.
          api.put(`/chat/${message.phoneNumber}/read`).then(refreshUnreadCount);
        }

        // 2. Update Chat List by fetching fresh data (Single Source of Truth)
        // This ensures unread counts and sorting are always correct based on DB
        fetchChats(true);
      },
    );

    return () => {
      socket.off("new_message");
    };
  }, [socket, selectedPhone, refreshUnreadCount]);

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
        c.phoneNumber === selectedPhone ? { ...c, unreadCount: 0 } : c,
      ),
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
          selectedPhone ? "hidden md:flex" : "flex", // Hide on mobile if chat selected
        )}
      >
        <CardHeader className="pb-4 border-b border-white/10 space-y-4">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-bold text-foreground">
              Chats
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchChats(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-background/50"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {loadingChats ? (
              <div className="p-4 text-center text-muted-foreground">
                Loading...
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchQuery ? "No results found" : "No conversations yet"}
              </div>
            ) : (
              <div className="flex flex-col">
                {filteredChats.map((chat) => (
                  <button
                    key={chat.phoneNumber}
                    onClick={() => setSelectedPhone(chat.phoneNumber)}
                    className={cn(
                      "flex items-start gap-3 p-3 text-left transition-colors border-b border-border/50",
                      selectedPhone === chat.phoneNumber
                        ? "bg-accent"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <Avatar className="w-8 h-8 md:w-10 md:h-10">
                      <AvatarImage
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${chat.phoneNumber}`}
                      />
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 overflow-hidden text-left">
                      <div className="grid grid-cols-[1fr_auto] items-center gap-2 mb-0.5 w-full">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate text-sm md:text-base">
                            {chat.phoneNumber}
                            {chat.customerName && (
                              <span className="text-muted-foreground font-normal ml-2 text-xs md:text-sm">
                                ~ {chat.customerName}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          {(Number(chat.unreadCount) || 0) > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center inline-flex items-center justify-center">
                              {chat.unreadCount}
                            </span>
                          )}
                          <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">
                            {chat.timestamp
                              ? new Date(chat.timestamp).toLocaleTimeString(
                                  [],
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  },
                                )
                              : ""}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground truncate block w-full">
                        {chat.direction === "outbound" && "You: "}
                        {chat.content.length > 30
                          ? chat.content.slice(0, 30) + "..."
                          : chat.content}
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
          !selectedPhone ? "hidden md:flex" : "flex w-full md:w-auto", // Show only on desktop if no selection, full width on mobile if selected
        )}
      >
        {selectedPhone ? (
          <>
            {/* Chat Header */}
            <CardHeader className="py-4 border-b border-border flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Back Button for Mobile */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-muted-foreground hover:text-foreground -ml-2"
                  onClick={() => setSelectedPhone(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>

                <Avatar className="h-8 w-8 md:h-10 md:w-10">
                  <AvatarImage
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedPhone}`}
                  />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base md:text-lg text-foreground">
                    {selectedPhone}
                  </CardTitle>
                  <div className="flex items-center gap-1 text-[10px] md:text-xs text-green-600 dark:text-green-400">
                    <Phone className="h-3 w-3" /> WhatsApp
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedPhone(null)}
                className="text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 hidden md:flex" // Hide close on mobile, use Back instead
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
                      : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-1.5 md:px-4 md:py-2 shadow-sm text-sm md:text-base", // Adjust text size/width for mobile
                      msg.direction === "outbound"
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-muted text-foreground rounded-bl-none",
                    )}
                  >
                    <MessageFormatter content={msg.content} />
                    <span className="text-[9px] md:text-[10px] opacity-70 block text-right mt-0.5 md:mt-1">
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
            <div className="p-2 md:p-4 border-t border-border bg-muted/20">
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
                    className="flex-1 bg-background"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <div className="bg-muted p-6 rounded-full mb-4 border border-border">
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
