"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex justify-end bg-[#0F1F18]/45 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-drawer-title"
        className={cn(
          "flex h-full w-full max-w-xl flex-col border-l border-[#DCE7DF] bg-white shadow-[-18px_0_55px_rgba(27,59,48,0.16)] animate-in slide-in-from-right duration-200",
          className,
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E8EEE9] px-6 py-5">
          <div className="min-w-0">
            <h2
              id="shared-drawer-title"
              className="text-lg font-bold text-[#17372A]"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-[#718197]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="shrink-0 rounded-lg p-2 text-[#6C8B7B] transition hover:bg-[#F1F8F3] hover:text-[#087F5B]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        {footer && (
          <footer className="flex shrink-0 justify-end gap-3 border-t border-[#E8EEE9] bg-[#FBFDFC] px-6 py-4">
            {footer}
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
