"use client";

import React from "react";
import { Bot, Sparkles } from "lucide-react";

interface TypingIndicatorProps {
  statusText?: string;
}

export function TypingIndicator({ statusText = "Thinking..." }: TypingIndicatorProps) {
  return (
    <div className="flex w-full items-start gap-3 animate-message-in py-1">
      {/* Bot Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage-800 border border-sage-200/80 shadow-2xs">
        <Bot className="h-4 w-4 text-sage-700" />
      </div>

      {/* Bubble */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-[#737C76]">
          <span className="text-[#3E4E47] font-semibold">ZeniaOne Assistant</span>
          <span className="text-[10px] text-[#A2A9A4]">•</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-sage-700 font-medium">
            <Sparkles className="h-2.5 w-2.5 animate-pulse" />
            {statusText}
          </span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-2xl rounded-tl-xs border border-[#E6E3DB] bg-white px-4 py-3 shadow-2xs">
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="h-2 w-2 rounded-full bg-sage-600 animate-typing-1" />
            <span className="h-2 w-2 rounded-full bg-sage-500 animate-typing-2" />
            <span className="h-2 w-2 rounded-full bg-sage-400 animate-typing-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
