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
  MessageCircle,
  Users,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";

import { ProfileProvider, useProfile } from "@/context/profile-context";
import { SocketProvider } from "@/context/socket-context";
import { UnreadProvider, useUnread } from "@/context/unread-context";
import { ThemeToggle } from "@/components/theme-toggle";

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
  const { unreadCount } = useUnread();

  const data = { user, restaurant };

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    router.push("/");
  };

  const [isChecking, setIsChecking] = useState(true);

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
    if (!loading && !user) {
      router.push("/");
    } else if (user) {
      setTimeout(() => setIsChecking(false), 0);
    }
  }, [user, loading, router]);

  if (isChecking || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loader"></div>
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
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Top Header - Strict B&W */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-16 items-center px-4 md:px-8">
          {/* Logo */}
          <div className="mr-4 flex items-center gap-2 md:mr-6">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Image
                src="/italy_logo_white.png"
                alt="Italy's Logo"
                width={100}
                height={32}
                className="h-8 w-auto object-contain dark:block hidden"
                priority
              />
              <Image
                src="/italy_logo_white.png"
                alt="Italy's Logo"
                width={100}
                height={32}
                className="h-8 w-auto object-contain dark:hidden block invert hue-rotate-180"
                priority
              />
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </nav>

          {/* Right Side */}
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 rounded-full border border-transparent hover:bg-accent hover:text-accent-foreground px-2 py-1 transition-colors focus:outline-none"
              >
                <div className="text-right hidden lg:block">
                  <span className="block text-sm font-medium leading-none">
                    {data?.user?.username || data?.user?.name}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {data?.user?.role || "ADMIN"}
                  </span>
                </div>
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border border-border">
                  <User className="h-4 w-4" />
                </div>
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2">
                  <div className="px-2 py-1.5 text-sm font-semibold">
                    My Account
                  </div>
                  <div className="h-px bg-border my-1" />

                  {data?.user?.role === "ADMIN" && (
                    <>
                      <Link
                        href="/dashboard/profile"
                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                      <Link
                        href="/dashboard/staff"
                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        <span>Manage Staff</span>
                      </Link>
                      <Link
                        href="/dashboard/manage-booking"
                        className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50"
                        onClick={() => setIsDropdownOpen(false)}
                      >
                        <Settings2 className="mr-2 h-4 w-4" />
                        <span>Manage Booking</span>
                      </Link>
                    </>
                  )}

                  <div className="h-px bg-border my-1" />
                  <button
                    onClick={handleLogout}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-red-500/10 text-red-600 hover:text-red-700 data-disabled:pointer-events-none data-disabled:opacity-50 transition-colors"
                  >
                    <LogOut className="mr-2 h-4 w-4 text-red-600" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav Bottom */}
      <nav
        className={cn(
          "md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background h-16 pb-[env(safe-area-inset-bottom)]",
          "grid",
          navItems.length === 4 ? "grid-cols-4" : "grid-cols-3",
        )}
      >
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-col items-center justify-center w-full h-full space-y-0.5 hover:bg-muted/20 transition-colors py-1 min-w-0 overflow-hidden"
          >
            <div
              className={cn(
                "p-1 rounded-full transition-colors relative shrink-0",
                pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label === "Live Chat" && unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full ring-1 ring-background">
                  {unreadCount}
                </span>
              )}
            </div>
            <span
              className={cn(
                "text-[9px] font-medium text-center leading-none w-full px-0.5 wrap-break-word line-clamp-2",
                pathname === item.href
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {item.label === "Live Chat" ? "Chat" : item.label}
            </span>
          </Link>
        ))}
      </nav>

      <main className="container max-w-7xl mx-auto p-4 md:p-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  );
}

function NavItem({
  item,
  pathname,
}: {
  item: { href: string; label: string; icon: React.ElementType };
  pathname: string;
}) {
  const Icon = item.icon;
  const isActive = pathname === item.href;
  const { unreadCount } = useUnread();

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center text-sm font-medium transition-colors hover:text-foreground/80",
        isActive ? "text-foreground font-bold" : "text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "mr-2 h-4 w-4",
          isActive ? "text-foreground" : "text-muted-foreground",
        )}
      />
      <span className="relative">
        {item.label}
        {item.label === "Live Chat" && unreadCount > 0 && (
          <span className="absolute -top-2 -right-3 flex h-4 w-4 items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
            {unreadCount}
          </span>
        )}
      </span>
    </Link>
  );
}
