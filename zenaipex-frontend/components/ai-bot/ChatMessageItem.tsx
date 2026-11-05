"use client";

import React, { memo } from "react";
import { Sparkles, Edit2, Copy, Check, ThumbsUp, ThumbsDown, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessageMarkdown } from "./ChatMessageMarkdown";

export interface Source {
  label?: string;
  score?: number;
  type?: string;
  verified?: boolean;
  scope?: string;
  period?: string;
  domain?: string;
}

export interface AnswerMeta {
  verified?: boolean;
  scope?: string;
  period?: string;
  source_mode?: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  answerMeta?: AnswerMeta;
  isError?: boolean;
  isLiveVoice?: boolean;
}

interface ChatMessageItemProps {
  message: Message;
  index: number;
  isLast: boolean;
  sending: boolean;
  isCopied: boolean;
  isEditing: boolean;
  editInput: string;
  feedback?: "like" | "dislike";
  onSetEditInput: (text: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: (index: number) => void;
  onStartEdit: (index: number, content: string) => void;
  onCopy: (index: number, text: string) => void;
  onFeedback: (index: number, type: "like" | "dislike") => void;
  onShare: (text: string) => void;
  onRetry: (index: number) => void;
  onSendSuggestion: (text: string) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
  message: m,
  index: i,
  isLast,
  sending,
  isCopied,
  isEditing,
  editInput,
  feedback,
  onSetEditInput,
  onCancelEdit,
  onSaveEdit,
  onStartEdit,
  onCopy,
  onFeedback,
  onShare,
  onRetry,
  onSendSuggestion,
}: ChatMessageItemProps) {
  return (
    <div className={`flex gap-4 sm:gap-6 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
      {m.role === "assistant" && (
        <div className="h-9 w-9 shrink-0 rounded-[14px] bg-gradient-to-br from-[#EAF5EE] to-[#CFE4D6] border border-[#C6DDCE] flex items-center justify-center text-[#356A50] shadow-[0_3px_10px_rgba(53,106,80,0.12)] mt-0.5">
          <Sparkles className="h-[17px] w-[17px]" />
        </div>
      )}

      <div className="flex min-w-0 flex-col max-w-[85%] sm:max-w-[75%]">
        {isEditing ? (
          <div className="flex flex-col gap-2 bg-sage-50 border border-sage-200 p-3 rounded-2xl w-full text-slate-800 shadow-sm">
            <textarea
              value={editInput}
              onChange={(e) => onSetEditInput(e.target.value)}
              className="w-full bg-transparent resize-none border-0 outline-none focus:ring-0 text-[15px] p-1"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancelEdit}
                className="h-7 text-xs text-slate-500 hover:text-slate-700"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => onSaveEdit(i)}
                disabled={!editInput.trim() || sending}
                className="h-7 text-xs bg-sage-600 hover:bg-sage-700 text-white shadow-sm"
              >
                Send
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={`px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-[14px] leading-snug ${
              m.role === "user"
                ? "bg-[#5F786D] text-white rounded-[20px] rounded-tr-[4px] shadow-sm"
                : "bg-white text-[#1C2421] rounded-[20px] rounded-tl-[4px] border border-[#E3E3DF] shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
            }`}
          >
            {m.role === "assistant" && !(m as any).isLiveVoice ? (
              <div>
                {(() => {
                  const lines = (m.content || "").split(/(?:\n)/);
                  const suggestions: string[] = [];
                  const cleanLines: string[] = [];

                  let extractingSuggestions = true;
                  for (let j = lines.length - 1; j >= 0; j--) {
                    const rawLine = lines[j];
                    const trimmed = rawLine.trim();

                    if (extractingSuggestions) {
                      if (!trimmed) continue;
                      const matchBullet = trimmed.match(
                        /^(?:[\-\*•]|\d+\.)\s*['"‘“]?([^'"’”]+?\?)['"’”]?$/
                      );
                      if (
                        matchBullet &&
                        matchBullet[1] &&
                        matchBullet[1].length > 6 &&
                        matchBullet[1].length < 120
                      ) {
                        suggestions.unshift(matchBullet[1].trim());
                        continue;
                      } else {
                        extractingSuggestions = false;
                      }
                    }

                    cleanLines.unshift(rawLine);
                  }

                  const cleanContent = cleanLines
                    .join("\n")
                    .replace(/\n(?:Kya aap|Would you like|Aap yeh bhi)\b[^\n]*(?:\n|$)/gi, "\n")
                    .replace(/Suggested questions(?:\s+you\s+can\s+ask)?\s*:\s*$/i, "")
                    .trim();

                  return (
                    <div>
                      <ChatMessageMarkdown content={cleanContent} />

                      {isLast && !sending && suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                          <div className="w-full text-[11px] font-semibold text-emerald-800/80 mb-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Suggested questions:</span>
                          </div>
                          {suggestions.slice(0, 4).map((sugg, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => onSendSuggestion(sugg)}
                              className="text-[12px] text-emerald-900 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/80 rounded-full px-3 py-1 transition-all text-left flex items-center gap-1.5 font-medium hover:scale-[1.02] active:scale-[0.98]"
                            >
                              <span>{sugg}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="whitespace-pre-wrap break-words">{m.content}</div>
            )}
          </div>
        )}

        {/* Actions & Sources */}
        {!isEditing && (
          <div
            className={`mt-1 flex items-center gap-1.5 sm:gap-2 ${
              m.role === "user" ? "justify-end mr-2" : "ml-2 flex-wrap"
            }`}
          >
            {m.role === "user" && (
              <button
                onClick={() => onStartEdit(i, m.content)}
                className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 text-[11px] font-medium p-1"
                title="Edit message"
                aria-label="Edit message"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}

            <button
              onClick={() => onCopy(i, m.content)}
              className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 text-[11px] font-medium p-1"
              title="Copy message"
              aria-label="Copy message"
            >
              {isCopied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="hidden sm:inline text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>

            {m.role === "assistant" && (
              <>
                <div className="w-px h-3 bg-slate-200 mx-0.5 hidden sm:block"></div>
                <button
                  onClick={() => onFeedback(i, "like")}
                  className={`transition-colors flex items-center gap-1.5 text-[11px] font-medium p-1 ${
                    feedback === "like"
                      ? "text-sage-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="Helpful response"
                  aria-label="Helpful response"
                >
                  <ThumbsUp className={`h-3.5 w-3.5 ${feedback === "like" ? "fill-current" : ""}`} />
                  <span className="hidden sm:inline">Like</span>
                </button>
                <button
                  onClick={() => onFeedback(i, "dislike")}
                  className={`transition-colors flex items-center gap-1.5 text-[11px] font-medium p-1 ${
                    feedback === "dislike"
                      ? "text-red-500"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="Not helpful response"
                  aria-label="Not helpful response"
                >
                  <ThumbsDown
                    className={`h-3.5 w-3.5 ${feedback === "dislike" ? "fill-current" : ""}`}
                  />
                  <span className="hidden sm:inline">Dislike</span>
                </button>

                <div className="w-px h-3 bg-slate-200 mx-0.5 hidden sm:block"></div>
                <button
                  onClick={() => onShare(m.content)}
                  className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 text-[11px] font-medium p-1"
                  title="Share response"
                  aria-label="Share response"
                >
                  <Share className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              </>
            )}

            {/* Retry for error messages */}
            {m.role === "assistant" && m.isError && isLast && (
              <button
                onClick={() => onRetry(i)}
                className="text-slate-400 hover:text-sage-600 transition-colors flex items-center gap-1.5 text-[11px] font-medium ml-1"
                title="Retry message"
                aria-label="Retry message"
              >
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

