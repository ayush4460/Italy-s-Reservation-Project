"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Armchair,
  CalendarClock,
  User,
  LogOut,
  Phone,
  MessageCircle,
  Users, // Import Users icon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

import { ProfileProvider, useProfile } from "@/context/profile-context";
import { SocketProvider } from "@/context/socket-context";
import { UnreadProvider, useUnread } from "@/context/unread-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      <SocketProvider>
        <UnreadProvider>
          <InnerDashboardLayout>{children}</InnerDashboardLayout>
        </UnreadProvider>
      </SocketProvider>
    </ProfileProvider>
  );
}

function InnerDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, restaurant, loading } = useProfile();

  // Create a combined data object to match previous structure or use context directly
  const data = { user, restaurant };

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    router.push("/");
  };

  const [isChecking, setIsChecking] = useState(true);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // If not loading and no user, redirect
    // Note: ProfileContext handles the fetch, if it fails (401), user is null
    if (!loading && !user) {
      router.push("/");
    } else if (user) {
      // Defer state update to avoid synchronous setState warning
      setTimeout(() => setIsChecking(false), 0);
    }
  }, [user, loading, router]);

  if (isChecking || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/tables", label: "Tables", icon: Armchair },
    {
      href: "/dashboard/reservations",
      label: "Reservations",
      icon: CalendarClock,
    },
    ...(user?.role === "ADMIN"
      ? [
          {
            href: "/dashboard/chat",
            label: "Live Chat",
            icon: MessageCircle,
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-mesh text-white font-sans selection:bg-purple-500/30">
      {/* Top Header - Floating & Funky */}
      <header className="sticky top-2 md:top-4 z-50 px-3 md:px-8">
        <div className="glass-panel rounded-full h-12 md:h-16 px-4 md:px-6 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/10 bg-black/40 backdrop-blur-xl">
          {/* Left: Logo & Brand (Restaurant Info) */}
          <div className="flex items-center gap-4">
            <Image
              src="/italy_logo_white.png"
              alt="Italy's Logo"
              width={120}
              height={40}
              className="h-7 md:h-10 w-auto object-contain max-w-[100px] md:max-w-[120px] drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              priority
            />
          </div>

          {/* Center: Navigation Pills */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          {/* Right: User Profile & Dropdown (User Info) */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 pl-1 pr-1 py-1 rounded-full hover:bg-white/5 transition-all duration-300 border border-transparent hover:border-white/10 focus:outline-none group"
            >
              <div className="text-right hidden lg:block mr-2">
                <span className="block text-sm font-bold text-gray-200 group-hover:text-white transition-colors">
                  {data?.user?.username || data?.user?.name}
                </span>
                <span className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold group-hover:text-cyan-400 transition-colors">
                  {data?.user?.role || "ADMIN"}
                </span>
              </div>

              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full p-[2px] bg-linear-to-tr from-cyan-400 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/20">
                <div className="h-full w-full rounded-full overflow-hidden bg-black/50 backdrop-blur-sm">
                  <User className="h-full w-full p-1.5 md:p-2 text-white/80" />
                </div>
              </div>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 md:mt-4 w-52 md:w-60 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-white/20 z-50 bg-[#12121a] animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/5">
                <div className="p-1.5 md:p-2 space-y-0.5 md:space-y-1">
                  <div className="px-3 py-2 md:px-4 md:py-3 border-b border-white/10 mb-1">
                    <p className="text-xs md:text-sm font-bold text-white">
                      {data?.user?.username || data?.user?.name || "User"}
                    </p>
                    <p className="text-[10px] md:text-xs text-gray-400">
                      {data?.user?.role || "Administrator"}
                    </p>
                  </div>
                  {data?.user?.role === "ADMIN" && (
                    <Link
                      href="/dashboard/profile"
                      className="flex items-center px-3 py-2 md:px-4 md:py-3 rounded-xl text-xs md:text-sm font-semibold text-gray-200 hover:bg-purple-500/20 hover:text-white transition-all group"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <div className="p-1.5 md:p-2 rounded-lg bg-white/5 group-hover:bg-purple-500/40 mr-2 md:mr-3 transition-colors">
                        <User className="h-3.5 w-3.5 md:h-4 md:w-4 group-hover:text-white transition-colors" />
                      </div>
                      Profile
                    </Link>
                  )}

                  {/* Manage Staff - Admin Only */}
                  {data?.user?.role === "ADMIN" && (
                    <Link
                      href="/dashboard/staff"
                      className="flex items-center px-3 py-2 md:px-4 md:py-3 rounded-xl text-xs md:text-sm font-semibold text-gray-200 hover:bg-purple-500/20 hover:text-white transition-all group"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <div className="p-1.5 md:p-2 rounded-lg bg-white/5 group-hover:bg-purple-500/40 mr-2 md:mr-3 transition-colors">
                        <Users className="h-3.5 w-3.5 md:h-4 md:w-4 group-hover:text-white transition-colors" />
                      </div>
                      Manage Staff
                    </Link>
                  )}

                  {/* Customer Support */}
                  {/* Customer Support */}
                  <div className="border-t border-white/10 my-1 pt-1">
                    <p className="px-3 md:px-4 py-1 text-[9px] md:text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                      Customer Support
                    </p>
                    <a
                      href="tel:+917878065085"
                      className="flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all group"
                    >
                      <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-cyan-500/20 mr-2 md:mr-3 transition-colors">
                        <Phone className="h-3 w-3 md:h-3.5 md:w-3.5 group-hover:text-cyan-400 transition-colors" />
                      </div>
                      Call (+91 7878065085)
                    </a>
                    <a
                      href="https://wa.me/917878065085"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs md:text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all group"
                    >
                      <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-green-500/20 mr-2 md:mr-3 transition-colors">
                        <MessageCircle className="h-3 w-3 md:h-3.5 md:w-3.5 group-hover:text-green-400 transition-colors" />
                      </div>
                      WhatsApp
                    </a>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-3 py-2 md:px-4 md:py-3 rounded-xl text-xs md:text-sm font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all group"
                  >
                    <div className="p-1.5 md:p-2 rounded-lg bg-red-500/10 group-hover:bg-red-500/30 mr-2 md:mr-3 transition-colors">
                      <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </div>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation (Bottom) - Enhanced & Compact */}
      <nav className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 glass-panel rounded-full px-4 py-2.5 flex items-center gap-5 z-50 shadow-[0_10px_30px_rgba(0,0,0,0.5)] bg-black/70 border border-white/10 backdrop-blur-md">
        {navItems.map((item) => (
          <div key={item.href}>
            <Link href={item.href}>
              <div
                className={cn(
                  "p-2 rounded-full transition-all duration-300 relative",
                  pathname === item.href
                    ? "text-white bg-linear-to-tr from-cyan-500 to-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)] scale-105"
                    : "text-gray-400 hover:text-white hover:bg-white/10",
                )}
              >
                <item.icon className="h-6 w-6" />
                {item.label === "Live Chat" && <MobileBadge />}
              </div>
            </Link>
          </div>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
        {children}
      </main>
    </div>
  );
}

interface NavItemData {
  href: string;
  label: string;
  icon: React.ElementType;
}

function NavItem({ item, pathname }: { item: NavItemData; pathname: string }) {
  const Icon = item.icon;
  const isActive = pathname === item.href;
  const { unreadCount } = useUnread();

  return (
    <Link href={item.href}>
      <div
        className={cn(
          "relative flex items-center space-x-2 px-5 py-2.5 rounded-full transition-all duration-300 text-sm font-semibold group", // Removed overflow-hidden
          isActive
            ? "text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            : "text-gray-400 hover:text-white",
        )}
      >
        {isActive && (
          <div className="absolute inset-0 bg-linear-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 border border-white/10 rounded-full" />
        )}
        {/* Badge Logic */}
        {item.label === "Live Chat" && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center bg-red-600 text-white text-[10px] font-bold px-1 rounded-full z-50 shadow-lg ring-4 ring-[#0f0f13] border border-white/10">
            {unreadCount}
          </span>
        )}

        {!isActive && (
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-full transition-all duration-300" />
        )}

        <Icon
          className={cn(
            "h-4 w-4 relative z-10 transition-transform duration-300",
            isActive
              ? "scale-110 text-cyan-300"
              : "group-hover:scale-110 group-hover:text-purple-300",
          )}
        />
        <span className="relative z-10">{item.label}</span>
      </div>
    </Link>
  );
}

function MobileBadge() {
  const { unreadCount } = useUnread();
  if (unreadCount === 0) return null;
  return (
    <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-20 shadow-md ring-1 ring-black">
      {unreadCount}
    </span>
  );
}
