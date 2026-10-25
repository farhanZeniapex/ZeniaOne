"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bot, X, Sparkles, Trash2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSharedAIChat } from "./ai-chat-context";
import { ChatMessageItem } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { ChatComposer } from "./chat-composer";
import type { ChatMessage } from "@/hooks/use-public-ai-chat";

const FLOATING_PROMPTS = [
  "How does voice automation work?",
  "How does business knowledge work?",
  "Book a demo",
];

export function FloatingAIBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [showLauncher, setShowLauncher] = useState(false);

  const {
    messages,
    isSending,
    statusText,
    sendMessage,
    retryLastMessage,
    clearChat,
    isExpanded,
    setIsExpanded,
    config,
    connectionState,
  } = useSharedAIChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const quickPrompts = latestAssistant?.suggestions?.length ? latestAssistant.suggestions : FLOATING_PROMPTS;

  // Show floating launcher only after scrolling past the hero showcase
  useEffect(() => {
    const checkScroll = () => {
      setShowLauncher(window.scrollY > 420);
    };
    checkScroll();
    window.addEventListener("scroll", checkScroll, { passive: true });
    return () => window.removeEventListener("scroll", checkScroll);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isSending, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleAction = (action: NonNullable<ChatMessage["action"]>) => {
    if (action.type === "lead_capture" || action.type === "handoff") {
      setIsOpen(false);
      document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
      window.history.replaceState(null, "", "#demo");
      return;
    }
    void sendMessage(action.label);
  };

  const handlePrompt = (prompt: string) => {
    if (/book a demo|talk to a human|human follow-up/i.test(prompt)) {
      handleAction({ type: "lead_capture", label: prompt });
    } else {
      void sendMessage(prompt);
    }
  };

  if (!showLauncher && !isOpen) {
    return null;
  }
  
  if (isExpanded) {
    return null; // Let the ExpandedAIBotModal handle it globally
  }

  return (
    <div className={cn("font-sans", isOpen ? "fixed inset-0 z-[120] sm:inset-auto sm:bottom-7 sm:right-7" : "fixed bottom-5 right-5 z-[50] sm:bottom-7 sm:right-7")}>
      {/* Launcher Button */}
      {!isOpen && (
        <div className="relative group">
          <button
            type="button"
            onClick={handleOpen}
            aria-label="Open ZeniaOne Assistant"
            className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-[1.1rem] sm:rounded-[1.25rem] bg-[#fffefa] text-sage-800 border border-[#D9E8D9] shadow-[0_12px_32px_rgba(7,49,31,0.16)] hover:shadow-[0_16px_40px_rgba(7,49,31,0.24)] hover:border-[#8CC79A] hover:scale-[1.03] hover:-translate-y-1 active:scale-95 transition-all duration-250 focus:outline-hidden focus:ring-2 focus:ring-[#8DE5A8] cursor-pointer animate-pulse-glow"
          >
            <Bot className="h-6 w-6 sm:h-7 sm:w-7 text-sage-700" />
            
            {/* Online Indicator */}
            <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 flex h-3 w-3 sm:h-3.5 sm:w-3.5">
              <span className={`relative inline-flex h-full w-full rounded-full border-2 border-white ${connectionState === "ready" ? "bg-emerald-500" : connectionState === "checking" ? "bg-amber-400" : "bg-rose-400"}`} />
            </span>
          </button>

          {/* Hover tooltip pill */}
          <div className="absolute right-[4.5rem] sm:right-[5rem] top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-1.5 rounded-lg bg-[#25332B] px-3 py-1.5 text-xs font-medium text-[#FAF8F5] shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <Sparkles className="h-3.5 w-3.5 text-sage-300" />
            <span>Ask ZeniaOne</span>
          </div>
        </div>
      )}

      {/* Floating Chat Window Modal */}
      {isOpen && (
        <div
          ref={containerRef}
          role="dialog"
          aria-label="ZeniaOne AI Chatbot"
          className={cn(
            "relative flex h-full w-full flex-col bg-[#fffefa] rounded-none sm:rounded-[24px] border border-[#D9E8D9] shadow-[0_24px_70px_rgba(7,49,31,0.2)] overflow-hidden transition-all duration-250 animate-message-in sm:w-[400px]",
            messages.length <= 1 ? "sm:h-[430px]" : "sm:h-[570px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#DDEBDD] px-4 py-3 bg-[#F5F9F2] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-sage-100 text-sage-800 border border-sage-200 shadow-2xs">
                <Bot className="h-4 w-4 text-sage-700" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white ${connectionState === "ready" ? "bg-emerald-500" : connectionState === "checking" ? "bg-amber-400" : "bg-rose-400"}`} />
                </span>
              </div>
              <div>
                <h4 className="font-semibold text-xs sm:text-sm text-[#1C2421]">
                  {config?.agent_name || "ZeniaOne Assistant"}
                </h4>
                <p className="text-[11px] text-[#68706C]">
                  {connectionState === "ready" ? "Ready to help" : connectionState === "checking" ? "Checking connection" : "Temporarily unavailable"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearChat}
                disabled={messages.length <= 1 && !isSending}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#68706C] hover:text-[#1C2421] hover:bg-[#EFECE6] disabled:opacity-40 transition-colors"
                aria-label="Clear chat"
                title="Reset conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="hidden sm:flex h-7 w-7 items-center justify-center rounded-lg text-[#68706C] hover:text-[#1C2421] hover:bg-[#EFECE6] transition-colors"
                aria-label="Expand window"
                title="Expand"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#68706C] hover:text-[#1C2421] hover:bg-[#EFECE6] transition-colors"
                aria-label="Close chat window"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div role="log" aria-live="polite" aria-relevant="additions text" className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-[#F8FBF6]">
            {messages.length <= 1 ? (
              <div className="flex h-full min-h-[290px] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[20px] border border-[#B9D7BE] bg-[radial-gradient(circle_at_30%_20%,#DDF8DF,#F7FCF4_70%)] shadow-[0_12px_30px_rgba(30,93,59,0.12)]">
                  <Bot className="h-6 w-6 text-[#276447]" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#559271]">ZeniaOne Assistant</p>
                <h3 className="mt-2 text-[22px] font-semibold tracking-tight text-[#183629]">How can I help?</h3>
                <p className="mt-2 max-w-[290px] text-[13px] leading-relaxed text-[#65756B]">Explore chat, live voice, phone calls, or book a personal demo.</p>
                <div className="mt-5 grid w-full gap-2">
                  {FLOATING_PROMPTS.map((prompt) => (
                    <button key={prompt} type="button" onClick={() => handlePrompt(prompt)} disabled={isSending} className="rounded-xl border border-[#DCE9DC] bg-white px-3 py-2.5 text-left text-xs font-medium text-[#314A3B] transition-colors hover:border-[#A6CFAC] hover:bg-[#F5FBF5] disabled:opacity-50">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((msg, idx) => {
              const isLatest = idx === messages.length - 1 && msg.role === "assistant";
              return (
                <ChatMessageItem
                  key={msg.id || idx}
                  message={msg}
                  isLatestAssistant={isLatest}
                  onRetry={retryLastMessage}
                  onAction={handleAction}
                />
              );
            })}

            {isSending && messages[messages.length - 1]?.role === "user" && (
              <TypingIndicator statusText={statusText} />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length > 1 && !!latestAssistant?.suggestions?.length && <div className="border-t border-[#DDEBDD] bg-[#fffefa] px-3 py-2 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {quickPrompts.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePrompt(prompt)}
                  disabled={isSending}
                  className="rounded-full border border-[#DDD9CE] bg-white hover:bg-sage-50 hover:border-sage-300 px-2.5 py-1 text-[11px] text-[#3E4E47] hover:text-sage-900 transition-colors shrink-0 disabled:opacity-50 shadow-2xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>}

          {/* Input Area */}
          <div className="border-t border-[#DDEBDD] bg-[#fffefa] p-3 shrink-0">
            <ChatComposer
              onSend={sendMessage}
              disabled={isSending}
              placeholder="Ask a question..."
              autoFocus={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
