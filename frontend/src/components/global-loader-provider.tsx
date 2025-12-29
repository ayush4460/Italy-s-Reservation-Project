"use client";

import React, { useEffect, useState } from "react";
import { LoaderSpinner } from "@/components/ui/loader-spinner";

export function GlobalLoaderProvider() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Listen for custom events dispatched by API or other components
    const handleStart = () => setIsLoading(true);
    const handleStop = () => setIsLoading(false);

    window.addEventListener("ax-loading-start", handleStart);
    window.addEventListener("ax-loading-stop", handleStop);

    return () => {
      window.removeEventListener("ax-loading-start", handleStart);
      window.removeEventListener("ax-loading-stop", handleStop);
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
      <LoaderSpinner />
    </div>
  );
}

// Helper to trigger loader from non-React files
export const showGlobalLoader = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ax-loading-start"));
  }
};

export const hideGlobalLoader = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ax-loading-stop"));
  }
};
