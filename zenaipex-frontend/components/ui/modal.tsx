"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
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
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0F1F18]/45 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-modal-title"
        className={cn(
          "flex max-h-[min(90vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#DCE7DF] bg-white shadow-[0_24px_70px_rgba(27,59,48,0.22)] animate-in fade-in zoom-in-95 duration-200",
          className,
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E8EEE9] px-6 py-5">
          <div className="min-w-0">
            <h2
              id="shared-modal-title"
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
            aria-label="Close dialog"
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
      </section>
    </div>,
    document.body,
  );
}
