"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, Copy, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/hooks/use-public-ai-chat";

interface ChatMessageProps {
  message: ChatMessageType;
  isLatestAssistant?: boolean;
  onRetry?: () => void;
  onAction?: (action: NonNullable<ChatMessageType["action"]>) => void;
}

export function ChatMessageItem({
  message,
  isLatestAssistant,
  onRetry,
  onAction,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div
      className={cn(
        "group flex w-full gap-3 animate-message-in py-1",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl shadow-2xs transition-transform duration-200",
          isUser
            ? "bg-[#3E4E47] text-white"
            : "bg-sage-100 text-sage-800 border border-sage-200/80"
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4 text-sage-700" />
        )}
      </div>

      {/* Message Content Container */}
      <div
        className={cn(
          "relative flex max-w-[88%] sm:max-w-[80%] flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Header: Sender name & timestamp */}
        <div className="flex items-center gap-2 px-1 text-[11px] font-medium text-[#737C76]">
          <span className="text-[#3E4E47] font-semibold">{isUser ? "You" : "ZeniaOne AI"}</span>
          <span className="text-[10px] text-[#A2A9A4]">•</span>
          <span className="text-[10px] text-[#737C76]">{message.timestamp}</span>
        </div>

        {/* Message Bubble */}
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3 text-sm leading-relaxed transition-all shadow-2xs",
            message.isError
              ? "bg-[#FFF8F5] text-[#7B3F32] border border-[#E9C6BC] rounded-tl-xs"
              : isUser
              ? "bg-sage-100/90 text-[#1C2421] border border-sage-200/90 rounded-tr-xs"
              : "bg-white text-[#1C2421] border border-[#E6E3DB] rounded-tl-xs shadow-xs"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none break-words text-[#1C2421]">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-base font-bold text-[#1C2421] mt-2 mb-1.5 first:mt-0">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-sm font-bold text-[#1C2421] mt-2 mb-1 first:mt-0">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-sage-700 mt-2 mb-1 first:mt-0">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 leading-relaxed text-sm text-[#2D3732]">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-1.5 ml-4 list-disc space-y-1 text-sm text-[#2D3732]">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-1.5 ml-4 list-decimal space-y-1 text-sm text-[#2D3732]">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-[#1C2421]">{children}</strong>
                  ),
                  table: ({ children }) => (
                    <div className="my-3 overflow-x-auto rounded-lg border border-[#E3DFD5]">
                      <table className="w-full text-left text-xs">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-[#F7F5EE] text-[#3E4E47] font-semibold">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 font-semibold border-b border-[#E3DFD5]">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-3 py-1.5 border-b border-[#EFECE5] text-[#2D3732]">{children}</td>
                  ),
                  code: ({ inline, children, ...props }: React.ComponentProps<"code"> & { inline?: boolean }) => {
                    const codeString = String(children).replace(/\n$/, "");
                    if (inline) {
                      return (
                        <code
                          className="rounded bg-[#F4F2EC] px-1.5 py-0.5 font-mono text-[12px] text-sage-800 border border-[#E3DFD5]"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <div className="relative my-2 rounded-xl bg-[#26312B] p-3 font-mono text-xs text-[#F2EFE9] border border-[#3E4E47] overflow-hidden">
                        <div className="flex items-center justify-between border-b border-[#3E4E47] pb-1.5 mb-2 text-[11px] text-[#A2A9A4]">
                          <span>code</span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(codeString)}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[#34413C] transition-colors text-[#D1DFD9] hover:text-white"
                            aria-label="Copy code snippet"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre className="overflow-x-auto pb-1 text-[#E8F0EC]">
                          <code>{codeString}</code>
                        </pre>
                      </div>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>

              {message.action && onAction && !message.isStreaming && (
                <button
                  type="button"
                  onClick={() => onAction(message.action!)}
                  className="mt-2 rounded-lg border border-sage-300 bg-sage-50 px-3 py-1.5 text-xs font-medium text-sage-800 hover:bg-sage-100 transition-colors"
                >
                  {message.action.label}
                </button>
              )}

              {message.isStreaming && (
                <span className="inline-block h-3.5 w-1.5 ml-1 bg-sage-600 animate-caret align-middle rounded-xs" />
              )}
              {!!message.sources?.length && !message.isStreaming && (
                <details className="mt-3 border-t border-[#E7ECE5] pt-2 text-xs text-[#586A60]">
                  <summary className="cursor-pointer font-medium">Knowledge used ({message.sources.length})</summary>
                  <ul className="mt-2 space-y-2">
                    {message.sources.map((source, index) => (
                      <li key={`${message.id}-source-${index}`} className="rounded-lg bg-[#F5F8F3] p-2 leading-relaxed">{source}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Hover / Message Actions */}
        {!message.isStreaming && (
          <div
            className={cn(
              "flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity duration-200 px-1 pt-0.5",
              isUser ? "justify-end" : "justify-start"
            )}
          >
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[#68706C] hover:text-[#1C2421] hover:bg-[#EFECE6] transition-colors"
              aria-label="Copy message text"
              title="Copy message"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-sage-600" />
                  <span className="text-sage-600 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {!isUser && isLatestAssistant && onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[#68706C] hover:text-[#1C2421] hover:bg-[#EFECE6] transition-colors"
                aria-label={message.isError ? "Retry message" : "Regenerate response"}
                title={message.isError ? "Retry" : "Regenerate answer"}
              >
                <RotateCcw className="h-3 w-3" />
                <span>{message.isError ? "Retry" : "Regenerate"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
