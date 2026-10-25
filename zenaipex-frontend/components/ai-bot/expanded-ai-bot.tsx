"use client";

import React, { useEffect, useRef } from "react";
import { Bot, X, Zap, Sparkles, CalendarDays, Trash2, Minimize2 } from "lucide-react";
import type { ChatMessage } from "@/hooks/use-public-ai-chat";
import { useSharedAIChat } from "./ai-chat-context";
import { ChatMessageItem } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { ChatComposer } from "./chat-composer";

const SUGGESTED_PROMPTS = [
  { label: "How does voice automation work?", icon: Zap },
  { label: "What can ZeniaOne do?", icon: Sparkles },
  { label: "Book a demo", icon: CalendarDays },
];

export function ExpandedAIBotModal() {
  const {
    isExpanded,
    setIsExpanded,
    messages,
    isSending,
    statusText,
    sendMessage,
    retryLastMessage,
    clearChat,
    config,
    connectionState,
  } = useSharedAIChat();

  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const quickPrompts = latestAssistant?.suggestions?.length
    ? latestAssistant.suggestions
    : SUGGESTED_PROMPTS.map((prompt) => prompt.label);

  const handleAction = (action: NonNullable<ChatMessage["action"]>) => {
    if (action.type === "lead_capture" || action.type === "handoff") {
      setIsExpanded(false);
      window.setTimeout(() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" }), 0);
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

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Body scroll lock and Escape key listener
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsExpanded(false);
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isExpanded, setIsExpanded]);

  // Auto-scroll logic
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  useEffect(() => {
    if (isExpanded && isNearBottomRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isSending, isExpanded]);

  if (!isExpanded) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6 lg:p-8 animate-message-in"
    >
      {/* Subtle backdrop */}
      <div 
        className="absolute inset-0 bg-[#FAF8F5]/60 backdrop-blur-[2px] transition-opacity" 
        onClick={() => setIsExpanded(false)}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div 
        className="relative flex flex-col w-full max-w-[680px] h-[100dvh] sm:h-[min(660px,calc(100dvh-48px))] bg-[#fffefa] rounded-none sm:rounded-[24px] border border-[#D9E8D9] shadow-[0_28px_90px_rgba(7,49,31,0.2)] overflow-hidden"
        role="dialog"
        aria-label="ZeniaOne AI Chatbot Expanded"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DDEBDD] px-4 sm:px-5 py-3 sm:py-3.5 bg-[#F5F9F2] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF8F5] text-sage-800 border border-[#EAE5DC] shadow-sm shrink-0">
              <Bot className="h-5 w-5 text-[#3E5448]" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </span>
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-[#1C2421] truncate">
                  {config?.agent_name || "ZeniaOne Assistant"}
                </h3>
                <span className="text-[#7A756D] text-[10px] sm:text-xs">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-[#3E5448] shrink-0">
                  <span className={`h-1.5 w-1.5 rounded-full ${connectionState === "ready" ? "bg-emerald-500" : connectionState === "checking" ? "bg-amber-400" : "bg-rose-400"}`} />
                  {connectionState === "ready" ? "Ready" : connectionState === "checking" ? "Checking" : "Unavailable"}
                </span>
              </div>
              <p className="text-[12px] sm:text-[13px] text-[#7A756D] truncate mt-0.5">
                Ask about chat, voice, and calls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <button
              type="button"
              onClick={clearChat}
              disabled={messages.length <= 1 && !isSending}
              className="group flex items-center gap-1.5 rounded-lg px-2 sm:px-2.5 py-1.5 text-xs sm:text-[13px] font-medium text-[#B84A4A] hover:text-[#9A3C3C] hover:bg-[#B84A4A]/10 active:scale-95 active:bg-[#B84A4A]/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              aria-label="Clear chat conversation"
              title="Clear conversation"
            >
              <Trash2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Clear</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-[#68706C] hover:text-[#1C2421] hover:bg-[#EFECE6] active:scale-95 transition-all"
              aria-label="Restore assistant"
              title="Restore"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#68706C] hover:text-[#1C2421] hover:bg-[#EFECE6] active:scale-95 transition-all"
              aria-label="Close assistant"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 bg-[#F8FBF6]"
        >
          {messages.length === 0 || (messages.length === 1 && messages[0].role === "assistant") ? (
            <div className="mx-auto flex min-h-full w-full max-w-[520px] flex-col justify-center py-6">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#B9D7BE] bg-[radial-gradient(circle_at_30%_20%,#DDF8DF,#F7FCF4_70%)] shadow-[0_14px_34px_rgba(30,93,59,0.13)]">
                  <Bot className="h-7 w-7 text-[#276447]" />
                </div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#559271]">Your AI assistant</p>
                <h3 className="text-2xl font-semibold tracking-tight text-[#183629] sm:text-[30px]">What can I help you with?</h3>
                <p className="mx-auto mt-3 max-w-[410px] text-sm leading-relaxed text-[#65756B]">Ask about ZeniaOne, explore what your agent can do, or book a personal demo.</p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {SUGGESTED_PROMPTS.map((prompt, i) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handlePrompt(prompt.label)}
                      disabled={isSending}
                      className="flex min-h-[74px] items-center gap-3 rounded-2xl border border-[#DCE9DC] bg-white px-4 py-3 text-left text-[13px] font-medium text-[#314A3B] shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#A6CFAC] hover:shadow-md disabled:opacity-50"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-[#478962]" />
                      <span>{prompt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
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
            })
          )}

          {isSending && messages[messages.length - 1]?.role === "user" && (
            <TypingIndicator statusText={statusText} />
          )}
        </div>

        {messages.length > 1 && !!latestAssistant?.suggestions?.length && <div className="border-t border-[#DDEBDD] bg-[#fffefa] px-4 sm:px-5 py-2 shrink-0">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handlePrompt(prompt)}
                disabled={isSending}
                className="shrink-0 rounded-full border border-[#DDD9CE] bg-white px-3 py-1.5 text-[11px] text-[#3E4E47] hover:border-[#B2C7BF] hover:bg-[#F4F8F4] disabled:opacity-50 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>}

        {/* Input Composer Area */}
        <div className="border-t border-[#DDEBDD] bg-[#fffefa] px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <ChatComposer
            onSend={sendMessage}
            disabled={isSending}
            placeholder="Ask ZeniaOne anything..."
            compact={false}
            autoFocus={true}
          />
        </div>
      </div>
    </div>
  );
}
