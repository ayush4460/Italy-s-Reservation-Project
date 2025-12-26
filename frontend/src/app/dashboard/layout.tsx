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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

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
    { href: "/dashboard/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="flex h-screen bg-gradient-mesh text-white">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-white/10 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Italy's Reservation
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-white/20 text-white shadow-lg backdrop-blur-sm"
                      : "text-gray-400 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
