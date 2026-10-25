"use client";

import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

export function ChatComposer({
  onSend,
  disabled = false,
  placeholder = "Ask ZeniaOne anything...",
  autoFocus = false,
  compact = false,
}: ChatComposerProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const prevDisabled = useRef(disabled);

  useEffect(() => {
    // If transitioning from disabled (assistant responding) to enabled (ready)
    if (prevDisabled.current && !disabled) {
      const activeEl = document.activeElement;
      
      // Check if user is typing elsewhere
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' || 
        (activeEl as HTMLElement).isContentEditable
      );
      
      // Check if a modal is open (heuristic)
      const isModalOpen = document.querySelector('[role="dialog"], dialog[open]');

      // If no other input is focused and no modal is stealing focus, we safely restore focus
      if (!isInputFocused && !isModalOpen && textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
      }
    }
    prevDisabled.current = disabled;
  }, [disabled]);

  // Auto-resize textarea height based on content
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const canSubmit = input.trim().length > 0 && !disabled;

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center rounded-2xl border border-[#D4CFC4] bg-white p-1.5 shadow-sm focus-within:border-[#7A9184] focus-within:shadow-[0_0_0_3px_rgba(178,199,191,0.35)] transition-all duration-200">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={1000}
          className="w-full resize-none bg-transparent px-3 py-2 text-sm text-[#1C2421] placeholder:text-[#919994] focus:outline-hidden disabled:opacity-50 max-h-[120px] leading-relaxed"
          style={{ minHeight: "38px" }}
          aria-label="Ask ZeniaOne AI a question"
        />

        <div className="flex items-center gap-1.5 pl-1 pr-1 shrink-0 self-end mb-1">
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Send message"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200 shrink-0 group",
              canSubmit
                ? "bg-[#3E5448] hover:bg-[#25332B] active:scale-95 text-white shadow-md cursor-pointer"
                : "bg-[#F4EFEA] text-[#B8B2A7] cursor-not-allowed"
            )}
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className={cn("h-4 w-4 transition-transform duration-200", canSubmit && "group-hover:-translate-y-0.5")} />
            )}
          </button>
        </div>
      </div>

      {!compact && (
        <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-[#8C938F]">
          <span>Enter to send · Shift + Enter for new line</span>
          {input.length > 500 && (
            <span>{input.length}/1000</span>
          )}
        </div>
      )}
    </form>
  );
}
