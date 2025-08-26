"use client";
import React from "react";

type Props = { open: boolean; onClose: () => void; children: React.ReactNode };

export default function Modal({ open, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative z-10 w-[92vw] max-w-3xl max-h-[85vh] overflow-y-auto
                   rounded-2xl bg-white shadow-xl ring-1 ring-black/5 p-4"
      >
        {children}
      </div>
    </div>
  );
}
