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
    const fetchProfile = async () => {
      try {
        const res = await api.get("/restaurants/me");
        setProfile(res.data);
      } catch (err) {
        console.error("Failed to fetch profile for header", err);
      }
    };
    fetchProfile();
  }, []);

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
    <div className="min-h-screen bg-gradient-mesh text-white font-sans">
      {/* Top Header */}
      <header className="h-16 glass-panel border-b border-white/10 sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between backdrop-blur-md bg-black/20">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-3">
          {profile?.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              className="h-10 w-auto object-contain max-w-[120px]"
            />
          ) : (
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg p-1">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
          )}
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 hidden md:block">
            {profile?.name || "Dashboard"}
          </span>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-300 text-sm font-medium",
                    isActive
                      ? "bg-blue-500/20 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-blue-500/30"
                      : "text-gray-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Right: User Profile & Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 bg-white/5 pl-3 pr-1 py-1 rounded-full border border-white/10 hover:bg-white/10 transition-colors focus:outline-none"
          >
            <span className="text-sm font-medium text-gray-300 hidden lg:block">
              {profile?.name}
            </span>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 overflow-hidden border border-white/20">
              {profile?.bannerUrl ? (
                <img
                  src={profile.bannerUrl}
                  alt="User"
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-full w-full p-2 text-gray-400" />
              )}
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 glass-panel border border-white/10 rounded-xl shadow-2xl py-1 z-50 bg-[#1a1a2e]/95 backdrop-blur-xl">
              <Link
                href="/dashboard/profile"
                className="flex items-center px-4 py-3 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                onClick={() => setIsDropdownOpen(false)}
              >
                <User className="mr-3 h-4 w-4" />
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Navigation (Bottom) */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center gap-6 z-50 shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "p-2 rounded-full transition-all duration-200",
                  isActive ? "text-blue-400 bg-blue-500/20" : "text-gray-400"
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
