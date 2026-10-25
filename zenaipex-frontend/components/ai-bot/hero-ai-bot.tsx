"use client";

import React, { useRef, useEffect } from "react";
import { Sparkles, Trash2, Bot, ShieldCheck, Zap, Maximize2 } from "lucide-react";
import { useSharedAIChat } from "./ai-chat-context";
import { ChatMessageItem } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { ChatComposer } from "./chat-composer";

const SUGGESTED_PROMPTS = [
  { label: "Voice automation?", icon: Zap },
  { label: "What can ZeniaOne do?", icon: Sparkles },
  { label: "How is data protected?", icon: ShieldCheck },
];

export function HeroAIBot() {
  const {
    messages,
    isSending,
    statusText,
    sendMessage,
    retryLastMessage,
    clearChat,
    setIsExpanded,
  } = useSharedAIChat();

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  useEffect(() => {
    if (isNearBottomRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isSending]);

  return (
    <div className="relative w-full max-w-[420px] lg:max-w-[485px] xl:max-w-[520px] 2xl:max-w-[540px] ml-auto mr-0">
      {/* Decorative ambient background blur */}
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-sage-200/35 via-[#E8F0EC]/25 to-sage-300/25 blur-lg opacity-70 pointer-events-none transition-all" />

      {/* Main Bot Card: Viewport-aware desktop vertical anchor with laptop safe constraint */}
      <div className="relative flex flex-col h-[395px] sm:h-[410px] lg:h-[530px] xl:h-[565px] 2xl:h-[595px] max-h-[calc(100dvh-6rem)] w-full rounded-2xl sm:rounded-3xl border border-[#E3DFD5] bg-[#FFFFFF] overflow-hidden transition-all animate-ai-glow">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#EBE8E0] px-3.5 sm:px-4 py-2 bg-[#FAF9F6] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-sage-100 text-sage-800 border border-sage-200 shadow-2xs shrink-0">
              <Bot className="h-4 w-4 text-sage-700" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full border border-white bg-emerald-500" />
              </span>
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-xs sm:text-sm text-[#1C2421] truncate">
                  ZeniaOne Assistant
                </h3>
                <span className="text-[#7A756D] text-[10px]">•</span>
                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-[#3E5448] shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              </div>
              <p className="text-[11px] text-[#7A756D] truncate mt-0.5">
                Ask about autonomous voice agents & automation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={clearChat}
              disabled={messages.length <= 1 && !isSending}
              className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#B84A4A] hover:text-[#9A3C3C] hover:bg-[#B84A4A]/10 active:scale-95 active:bg-[#B84A4A]/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              aria-label="Clear chat conversation"
              title="Clear conversation"
            >
              <Trash2 className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline text-[11px]">Clear</span>
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#68706C] hover:text-[#1C2421] hover:bg-[#EFECE6] active:scale-95 transition-all"
              aria-label="Expand assistant"
              title="Expand"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-3.5 sm:px-4 py-2.5 space-y-2.5 bg-[#FAF9F6]"
        >
          {messages.length === 0 || (messages.length === 1 && messages[0].role === "assistant") ? (
            <div className="flex flex-col flex-1 px-1 py-3 gap-6">
              {/* Empty state / Welcome */}
              <div className="flex gap-3 animate-message-in max-w-[90%]">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FAF8F5] text-sage-800 border border-[#EAE5DC] shrink-0 shadow-2xs">
                  <Bot className="h-3.5 w-3.5 text-[#3E5448]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 px-0.5">
                    <span className="text-[12.5px] font-semibold text-[#1C2421]">ZeniaOne</span>
                  </div>
                  <div className="space-y-2 text-[13.5px] leading-relaxed text-[#2C3631] bg-white border border-[#EBE8E0] shadow-sm shadow-[#1C2421]/5 rounded-2xl rounded-tl-sm px-4 py-3">
                    <p>Hi, I’m <strong>ZeniaOne</strong>.</p>
                    <p>I can help with business information, automation, voice agents, and more.</p>
                    <p>What would you like to know?</p>
                  </div>
                </div>
              </div>
              
              {/* Suggestions inside chat */}
              <div className="flex flex-wrap gap-2 animate-message-in" style={{ animationDelay: "150ms" }}>
                {SUGGESTED_PROMPTS.map((prompt, i) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(prompt.label)}
                      disabled={isSending}
                      className="inline-flex flex-1 min-w-[120px] justify-center sm:justify-start items-center gap-2 rounded-xl border border-[#EBE8E0] bg-[#FAF9F6] hover:bg-white hover:border-[#B2C7BF] px-3.5 py-2.5 text-[12px] font-medium text-[#3E4E47] hover:text-[#25332B] hover:shadow-[0_2px_10px_rgba(178,199,191,0.2)] transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Icon className="h-3 w-3 text-[#7A9184]" />
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
                />
              );
            })
          )}

          {isSending && messages[messages.length - 1]?.role === "user" && (
            <TypingIndicator statusText={statusText} />
          )}
        </div>



        {/* Input Composer Area */}
        <div className="border-t border-[#EDEAE2] bg-[#FFFFFF] px-3 sm:px-3.5 py-2 shrink-0">
          <ChatComposer
            onSend={sendMessage}
            disabled={isSending}
            placeholder="Ask ZeniaOne anything..."
            compact={true}
          />
        </div>
      </div>
    </div>
  );
}
