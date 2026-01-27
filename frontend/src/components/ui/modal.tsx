"use client";

import React from "react";
import { Button } from "./button";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl glass-panel border border-white/20 flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 sm:p-6 pb-2 sm:pb-4 border-b border-white/10">
          <h2 className="text-lg sm:text-xl font-bold text-white truncate mr-4">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
