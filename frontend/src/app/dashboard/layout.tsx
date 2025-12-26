"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Armchair,
  CalendarClock,
  User,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<{
    name: string;
    logoUrl?: string;
    bannerUrl?: string; // Used as User Photo
  } | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await api.get("/restaurants/me");
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to fetch profile for header", err);
        // If error (likely 401/403 or network), redirect to login
        localStorage.removeItem("token");
        router.push("/");
      }
    };
    fetchProfile();
  }, [router]);

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

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/tables", label: "Tables", icon: Armchair },
    {
      href: "/dashboard/reservations",
      label: "Reservations",
      icon: CalendarClock,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-mesh text-white font-sans selection:bg-purple-500/30">
      {/* Top Header - Floating & Funky */}
      <header className="sticky top-4 z-50 px-4 md:px-8">
        <div className="glass-panel rounded-full h-16 px-6 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-white/10 bg-black/40 backdrop-blur-xl">
          {/* Left: Logo & Brand */}
          <div className="flex items-center gap-4">
            {profile?.logoUrl ? (
              <img
                src={profile.logoUrl}
                alt="Logo"
                className="h-10 w-auto object-contain max-w-[120px] drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
              />
            ) : (
              <div className="bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 rounded-xl p-2 shadow-lg shadow-purple-500/20">
                <LayoutDashboard className="h-5 w-5 text-white" />
              </div>
            )}
            <span className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-purple-300 to-pink-300 tracking-tight hidden md:block">
              {profile?.name || "Dashboard"}
            </span>
          </div>

          {/* Center: Navigation Pills */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    className={cn(
                      "relative flex items-center space-x-2 px-5 py-2.5 rounded-full transition-all duration-300 text-sm font-semibold overflow-hidden group",
                      isActive
                        ? "text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    {isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 border border-white/10 rounded-full" />
                    )}
                    {!isActive && (
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 rounded-full transition-all duration-300" />
                    )}

                    <Icon
                      className={cn(
                        "h-4 w-4 relative z-10 transition-transform duration-300",
                        isActive
                          ? "scale-110 text-cyan-300"
                          : "group-hover:scale-110 group-hover:text-purple-300"
                      )}
                    />
                    <span className="relative z-10">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Right: User Profile & Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 pl-1 pr-1 py-1 rounded-full hover:bg-white/5 transition-all duration-300 border border-transparent hover:border-white/10 focus:outline-none group"
            >
              <div className="text-right hidden lg:block mr-2">
                <span className="block text-sm font-bold text-gray-200 group-hover:text-white transition-colors">
                  {profile?.name}
                </span>
                <span className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold group-hover:text-cyan-400 transition-colors">
                  Admin
                </span>
              </div>

              <div className="h-10 w-10 rounded-full p-[2px] bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/20">
                <div className="h-full w-full rounded-full overflow-hidden bg-black/50 backdrop-blur-sm">
                  {profile?.bannerUrl ? (
                    <img
                      src={profile.bannerUrl}
                      alt="User"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-full w-full p-2 text-white/80" />
                  )}
                </div>
              </div>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-4 w-60 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.9)] border border-white/20 z-50 bg-[#12121a] animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/5">
                <div className="p-2 space-y-1">
                  <div className="px-4 py-3 border-b border-white/10 mb-1">
                    <p className="text-sm font-bold text-white">
                      {profile?.name || "User"}
                    </p>
                    <p className="text-xs text-gray-400">Administrator</p>
                  </div>
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center px-4 py-3 rounded-xl text-sm font-semibold text-gray-200 hover:bg-purple-500/20 hover:text-white transition-all group"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <div className="p-2 rounded-lg bg-white/5 group-hover:bg-purple-500/40 mr-3 transition-colors">
                      <User className="h-4 w-4 group-hover:text-white transition-colors" />
                    </div>
                    Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-all group"
                  >
                    <div className="p-2 rounded-lg bg-red-500/10 group-hover:bg-red-500/30 mr-3 transition-colors">
                      <LogOut className="h-4 w-4" />
                    </div>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Navigation (Bottom) - Enhanced */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 glass-panel rounded-full px-6 py-4 flex items-center gap-8 z-50 shadow-[0_10px_40px_rgba(0,0,0,0.5)] bg-black/60 border border-white/10">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "p-3 rounded-full transition-all duration-300 relative",
                  isActive
                    ? "text-white bg-gradient-to-tr from-cyan-500 to-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] scale-110"
                    : "text-gray-400 hover:text-white hover:bg-white/10"
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main className="p-4 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">
        {children}
      </main>
    </div>
  );
}
