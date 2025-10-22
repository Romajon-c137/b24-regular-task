"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: number;
};

export default function Modal({ open, onClose, title, children, width = 720 }: Props) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="bx-modal-overlay" onClick={onClose}>
      <div
        className="bx-modal"
        style={{ width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bx-modal-header">
          <h3>{title ?? "Диалог"}</h3>
          <button className="bx-icon-btn" aria-label="Закрыть" onClick={onClose}>✕</button>
        </div>
        <div className="bx-modal-body">{children}</div>
      </div>
    </div>
  );
}
