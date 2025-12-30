"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Pizza,
  UtensilsCrossed,
  AlertCircle,
  Home,
  LayoutDashboard,
} from "lucide-react";

export default function NotFound() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer state updates to avoid synchronous setState warning and improve performance
    const timer = setTimeout(() => {
      setMounted(true);
      const token = localStorage.getItem("token");
      setIsLoggedIn(!!token);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-mesh p-4 text-white overflow-hidden relative">
      {/* Floating Background Icons */}
      <div className="absolute top-20 left-20 opacity-20 animate-bounce delay-700">
        <Pizza size={64} />
      </div>
      <div className="absolute bottom-20 right-20 opacity-20 animate-bounce delay-1000">
        <UtensilsCrossed size={64} />
      </div>
      <div className="absolute top-40 right-1/4 opacity-10 animate-pulse">
        <span className="text-6xl">🍕</span>
      </div>
      <div className="absolute bottom-40 left-1/4 opacity-10 animate-pulse delay-500">
        <span className="text-6xl">🍝</span>
      </div>

      <div className="z-10 text-center space-y-6 max-w-lg mx-auto glass-panel p-12 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl">
        <div className="relative inline-block">
          <h1 className="text-9xl font-black text-transparent bg-clip-text bg-linear-to-r from-orange-400 via-red-500 to-purple-600 drop-shadow-sm">
            404
          </h1>
          <div className="absolute -top-6 -right-8 rotate-12 bg-yellow-400 text-black font-bold text-xs px-2 py-1 rounded shadow-lg">
            Oops!
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Mama Mia! Page Not Found</h2>
          <p className="text-gray-300">
            Looks like this dish isn&apos;t on the menu. We looked
            everywhere—even under the pizza dough!
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={isLoggedIn ? "/dashboard" : "/"}>
            <Button className="w-full sm:w-auto glass-button bg-white/10 hover:bg-white/20 text-white border border-white/20 text-lg px-8 py-6 h-auto group transition-all duration-300 hover:scale-105">
              {isLoggedIn ? (
                <>
                  <LayoutDashboard className="mr-2 h-5 w-5 group-hover:text-purple-300 transition-colors" />
                  Back to Dashboard
                </>
              ) : (
                <>
                  <Home className="mr-2 h-5 w-5 group-hover:text-cyan-300 transition-colors" />
                  Go Home
                </>
              )}
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-12 text-sm text-gray-500 flex items-center gap-2">
        <AlertCircle size={16} />
        <span>Lost? Don&apos;t worry, the kitchen is still open.</span>
      </div>
    </div>
  );
}
