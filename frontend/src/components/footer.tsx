"use client";

import React from "react";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  const isAuthPage = pathname === "/" || pathname?.startsWith("/signup");

  if (isAuthPage) {
    return (
      <footer className="w-full py-4 text-center">
        <p className="text-sm font-medium text-white/50">
          Powered by{" "}
          <span className="text-white hover:text-cyan-400 transition-colors">
            Axiom HiTech
          </span>
        </p>
      </footer>
    );
  }

  // Regular footer for Dashboard and other pages
  return (
    <footer className="w-full py-6 pb-20 md:pb-6 mt-auto border-t border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()}{" "}
            <span className="text-foreground font-semibold">TheItalys</span>.
            All rights reserved.
          </p>
        </div>
        <div className="text-center md:text-right">
          <p className="text-sm text-muted-foreground">
            Made with ❤️ by{" "}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-purple-500 font-bold hover:from-cyan-300 hover:to-purple-400 transition-all cursor-default">
              Axiom HiTech
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
