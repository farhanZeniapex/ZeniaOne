"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { agentsApi, Agent } from "@/lib/api/agents";
import { conversationsApi } from "@/lib/api/conversations";
import { fetchApi, ApiError } from "@/lib/api/client";
import { knowledgeApi } from "@/lib/api/knowledge";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/hooks/use-company";
import {
  Bot, Loader2, Send, Trash2, Database, ShieldCheck, Sparkles, Plus, Paperclip, Mic, Copy, Check, FileText, X,
  ThumbsUp, ThumbsDown, Share, Edit2, History, ChevronDown, PanelTop
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VoiceModeDock } from "@/components/ai-bot/voice-mode-overlay";
import { canonicalizeCustomerFacingName, cn } from "@/lib/utils";

interface Source {
  label?: string;
  score?: number;
  type?: string;
  verified?: boolean;
  scope?: string;
  period?: string;
  domain?: string;
}

interface AnswerMeta {
  verified?: boolean;
  scope?: string;
  period?: string;
  source_mode?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  answerMeta?: AnswerMeta;
  isError?: boolean;
  isLiveVoice?: boolean;
}

/** Internal workspace suggested questions — platform/admin relevant, not customer-service.
 *  Purely deterministic — no LLM call. */
const DEFAULT_SUGGESTIONS = [
  "How many calls came today?",
  "Which company used the most this month?",
  "What provider and model are active now?",
  "What was discussed in the last call?",
];

function buildSuggestions(): string[] {
  return DEFAULT_SUGGESTIONS;
}

// ─── First-time setup screen ──────────────────────────────────────────────────
function SetupScreen({
  onCreated,
  companyId,
}: {
  onCreated: (agent: Agent) => void;
  companyId: string;
}) {
  const [name, setName] = useState("Platform Assistant");
  const [prompt, setPrompt] = useState(
    "You are ZeniaOne's internal platform assistant. " +
      "You help super admins with platform operations, configuration questions, " +
      "internal documentation, and usage insights. " +
      "Be concise, professional, and helpful."
  );
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const agent = await agentsApi.create(companyId, {
        name,
        system_prompt: prompt,
        status: "active" as const,
        default_language: "en-IN",
        tts_voice: "anushka",
        llm_model: "sarvam-105b",
        greeting_messages: { "en-IN": "Hello! How can I help you today?" },
      });
      onCreated(agent);
    } catch {
      setError("Failed to create agent. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 bg-sage-100 text-sage-600 rounded-2xl flex items-center justify-center shrink-0">
            <Bot className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">My AI isn&apos;t set up yet</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Create your personal AI assistant for internal platform management.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Agent Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">System Prompt / Role</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={creating || !name.trim()}
              className="bg-sage-600 hover:bg-sage-700 text-white px-6"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Create My AI Agent
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Chat screen ──────────────────────────────────────────────────────────────
function ChatScreen({
  agent,
  companyId,
  agents,
  onSwitchAgent,
}: {
  agent: Agent;
  companyId: string;
  agents: Agent[];
  onSwitchAgent: (a: Agent) => void;
}) {
  const searchParams = useSearchParams();
  const convIdParam = searchParams.get("id");
  const router = useRouter();
  const lastActiveStorageKey = "adminMyAiLastActiveConvId";
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("adminMyAiDraft") || "";
    return "";
  });
  const [sending, setSending] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(convIdParam);
  const activeConvIdRef = useRef<string | null>(convIdParam);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const agentPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentMenuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!agentPickerRef.current?.contains(event.target as Node)) setAgentMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [agentMenuOpen]);
  
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
    if (activeConvId && activeConvId !== "tmp" && activeConvId !== "temp") {
      sessionStorage.setItem(lastActiveStorageKey, activeConvId);
    }
  }, [activeConvId]);

  useEffect(() => {
    if (input) sessionStorage.setItem("adminMyAiDraft", input);
    else sessionStorage.removeItem("adminMyAiDraft");
  }, [input]);

  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showAttach, setShowAttach] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");
  const [feedbackState, setFeedbackState] = useState<Record<number, 'like' | 'dislike'>>({});
  const [uploading, setUploading] = useState(false);

  // Voice mode state — when true the inline dock is shown
  const [voiceModeActive, setVoiceModeActive] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch knowledge base documents for attach
  const fetchDocuments = async () => {
    if (agent.knowledge_base_id && companyId) {
      try {
        const data = await knowledgeApi.listDocuments(companyId, agent.knowledge_base_id);
        if (data.documents) {
          setDocuments(data.documents);
        }
      } catch (err) {
        console.error("Failed to fetch documents", err);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agent.knowledge_base_id || !companyId) return;
    setUploading(true);
    try {
      await knowledgeApi.uploadDocument(companyId, agent.knowledge_base_id, file);
      await fetchDocuments();
    } catch (err) {
      console.error(err);
      alert("Failed to upload document.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [agent.knowledge_base_id, companyId]);

  // Load existing chat history if convIdParam is present
  useEffect(() => {
    if (convIdParam && companyId) {
      sessionStorage.setItem(lastActiveStorageKey, convIdParam);
      conversationsApi.getMessages(companyId, convIdParam)
        .then((res) => {
          if (res.messages && res.messages.length > 0) {
            const history = res.messages.map(m => ({
              role: m.role as "user" | "assistant",
              content: m.text || m.content || "",
              sources: [] // We don't store sources in transcript currently, so they will be empty on reload
            }));
            setMessages(prev => {
              // Preserve optimistic welcome message if it was added during the fetch
              const hasWelcome = prev.length > 0 && prev[prev.length - 1].content.includes("Welcome to");
              if (hasWelcome) {
                // Remove the welcome message from history if it happens to be there to avoid duplicates, though unlikely
                return [...history, prev[prev.length - 1]];
              }
              return history;
            });
            setActiveConvId(convIdParam);
          }
        })
        .catch(() => {});
    } else if (!convIdParam && companyId) {
      // Navigation links intentionally omit the query string. Restore the
      // last selected conversation instead of silently opening a new chat.
      const lastSessionId = sessionStorage.getItem(lastActiveStorageKey);
      if (lastSessionId) {
        router.replace(`/admin/my-ai/chat?id=${lastSessionId}`);
        return;
      }

      // No prior conversation exists, so start a clean chat.
      setMessages([]);
      setActiveConvId(null);
    }
  }, [convIdParam, companyId, router]);

  async function executeSend(text: string, currentHistory: Message[]) {
    if (sending) return;
    setSending(true);
    setMessages([...currentHistory, { role: "user", content: text }]);
    setInput("");

    try {
      const payload: any = { 
        message: text, 
        history: currentHistory.map(m => ({ role: m.role, content: m.content })) 
      };
      
      const currentConvId = activeConvIdRef.current;
      if (currentConvId) {
        payload.conversation_id = currentConvId;
      }
      if (selectedDocIds.length > 0) {
        payload.document_ids = selectedDocIds;
      }
      
      // My AI is the privileged internal Platform Copilot. It uses the secure
      // admin analytics endpoint, while AI Playground continues to test the
      // customer-facing agent/knowledge-base behavior.
      const res = await fetchApi<{ answer: string; sources?: Source[]; answer_meta?: AnswerMeta; conversation_id?: string }>(
        "/admin/copilot/query",
        {
          method: "POST",
          body: JSON.stringify({
            question: payload.message,
            company_id: companyId,
            agent_id: agent.id,
            conversation_id: payload.conversation_id,
          }),
        },
      );
      
      if (res.conversation_id && !currentConvId) {
        setActiveConvId(res.conversation_id);
        activeConvIdRef.current = res.conversation_id; // Update ref immediately for subsequent fast calls
        router.replace(`/admin/my-ai/chat?id=${res.conversation_id}`);
      }
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, sources: res.sources, answerMeta: res.answer_meta },
      ]);
    } catch (e: any) {
      let errorMsg = "Sorry, I'm having trouble responding right now. Please try again in a moment.";
      
      if (e instanceof ApiError) {
        if (e.status === 504) {
          errorMsg = "The request timed out. The system might be taking too long to process. Please try again.";
        } else {
          errorMsg = e.message || errorMsg;
        }
      } else {
        // Log unexpected frontend parsing/network errors explicitly
        console.error("[CHAT_RESPONSE_PARSE] Error:", e, "status=unknown answer_present=false resolution=error");
        errorMsg = "Encountered an unexpected error parsing the response.";
      }
      
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMsg,
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || sending) return;
    executeSend(input.trim(), messages);
  }

  function handleEditSend(index: number) {
    if (!editInput.trim() || sending) return;
    const text = editInput.trim();
    setEditingIndex(null);
    executeSend(text, messages.slice(0, index));
  }

  function handleShare(text: string) {
    if (navigator.share) {
      navigator.share({ title: 'ZeniaOne Response', text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopiedIndex(-1); // Use -1 as a special index for share fallback feedback
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Voice messages update handler ────────────────────────────────────────────
  function handleVoiceMessagesUpdate(userText: string, aiText: string, sources?: any[], isInterimUser: boolean = false) {
    if (userText.trim()) {
      setMessages((prev) => {
        const normalizeVoiceText = (value: string) => value.toLowerCase().replace(/[\s\u200b]+/g, " ").replace(/[?!.,।]+$/g, "").trim();
        const incoming = normalizeVoiceText(userText);
        const last = prev[prev.length - 1];
        // Browser STT and server/native STT can report the same final phrase
        // close together. Do not append a second visible customer bubble.
        if (last?.role === "user" && normalizeVoiceText(last.content || "") === incoming) {
          if ((last as any).isLiveVoice && !isInterimUser) {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, content: userText, isLiveVoice: false };
            return updated;
          }
          return prev;
        }
        // If previous message was a live voice turn from user, update it in-place
        if (last?.role === "user" && (last as any).isLiveVoice) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: userText,
            isLiveVoice: isInterimUser
          };
          return updated;
        }
        return [...prev, { role: "user" as const, content: userText, isLiveVoice: isInterimUser } as any];
      });
    }
    if (aiText.trim()) {
      setMessages((prev) => {
        // If last message is assistant and userText is empty, update the streaming/progressive message in-place
        if (prev.length > 0 && prev[prev.length - 1].role === "assistant" && !userText.trim()) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: aiText,
            sources: sources || updated[updated.length - 1].sources || []
          };
          return updated;
        }
        return [...prev, { role: "assistant" as const, content: aiText, sources: sources || [] }];
      });
    }
  }

  function handleVoiceConvIdChange(newId: string) {
    setActiveConvId(newId);
    activeConvIdRef.current = newId;
    router.replace(`/admin/my-ai/chat?id=${newId}`);
  }

  const hasMessages = messages.length > 0;

  // Avoid repeated smooth-scroll animations while long answers reflow.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_0%,#FFFFFF_0%,#FBFCFA_38%,#F4F7F3_100%)]">

      {/* Minimal Header */}
      <div className="h-[56px] min-h-[56px] border-b border-[#DDE8E0] bg-white/95 backdrop-blur-xl flex items-center justify-between px-3 sm:px-5 shrink-0 z-10 shadow-[0_2px_12px_rgba(34,62,47,0.04)]">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="h-9 w-9 bg-gradient-to-br from-[#EAF5EE] to-[#CFE4D6] rounded-xl flex items-center justify-center text-[#356A50] shrink-0 border border-[#C6DDCE] shadow-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex min-w-0 items-center gap-2 leading-none">
              <span className="hidden sm:inline truncate text-[9px] font-bold uppercase tracking-[0.13em] text-[#789686]">Internal Admin Intelligence</span>
              {agents.length > 1 ? (
                <div ref={agentPickerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setAgentMenuOpen((open) => !open)}
                    className="group flex min-w-[145px] items-center justify-between gap-3 rounded-lg border border-[#D5E4D9] bg-white px-2.5 py-1.5 text-left shadow-[0_2px_8px_rgba(34,62,47,0.05)] transition-all hover:border-[#8FBA9F] hover:shadow-[0_4px_14px_rgba(34,92,58,0.10)] focus:outline-none focus:ring-2 focus:ring-[#9BD6AF]/50"
                    aria-haspopup="listbox"
                    aria-expanded={agentMenuOpen}
                    aria-label="Choose AI agent"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#E8F3EB] text-[10px] font-extrabold text-[#356A50]">
                        {canonicalizeCustomerFacingName(agent.name).charAt(0).toUpperCase()}
                      </span>
                      <span className="text-[13px] font-bold tracking-tight text-[#1C2421]">{canonicalizeCustomerFacingName(agent.name)}</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-[#5F786D] transition-transform ${agentMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {agentMenuOpen && (
                    <div role="listbox" aria-label="Available AI agents" className="absolute left-0 top-[calc(100%+8px)] z-50 w-[260px] overflow-hidden rounded-2xl border border-[#D5E4D9] bg-white p-1.5 shadow-[0_14px_36px_rgba(25,55,43,0.18)] animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-3 pb-1.5 pt-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#789686]">Choose assistant</div>
                      {agents.map((a) => {
                        const isSelected = a.id === agent.id;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              onSwitchAgent(a);
                              setAgentMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${isSelected ? "bg-[#EAF5EE] text-[#285A42]" : "text-[#43584F] hover:bg-[#F3F8F4]"}`}
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-extrabold text-[#356A50] shadow-sm ring-1 ring-[#D6E5DA]">
                              {canonicalizeCustomerFacingName(a.name).charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold">{canonicalizeCustomerFacingName(a.name)}</span>
                              <span className="block text-[11px] font-medium text-[#789686]">AI assistant · Online</span>
                            </span>
                            {isSelected && <Check className="h-4 w-4 text-[#24804D]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <span className="truncate text-[#1C2421] text-[14px] font-bold tracking-tight">{canonicalizeCustomerFacingName(agent.name)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] text-[#68706C] font-medium leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Online
              </span>
              {agent.knowledge_base_id && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-[#D1DFD9] mx-1"></span>
                  <span className="flex items-center text-[10px] text-[#5F786D] font-medium leading-none">
                    <Database className="h-3 w-3 mr-1" /> Knowledge Connected
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.dispatchEvent(new Event("zenia:toggle-admin-header"))}
            className="h-8 rounded-full px-2.5 text-[#60796C] hover:bg-[#F0F7F2] hover:text-[#285A42]"
            title="Click to show or hide platform header"
            aria-label="Show or hide platform header"
          >
            <PanelTop className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline text-[12px] font-semibold">Header</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/my-ai/conversations")}
            className="hidden sm:inline-flex h-9 rounded-full px-3 text-[#60796C] hover:bg-[#F0F7F2] hover:text-[#285A42]"
            title="Open chat history"
          >
            <History className="h-4 w-4 mr-1.5" />
            <span className="text-[13px] font-semibold">History</span>
          </Button>
          {/* Voice Chat AI — primary voice mode entry */}
          <Button
            size="sm"
            onClick={() => setVoiceModeActive(true)}
            className="bg-[#3E5448] hover:bg-[#2A3D34] text-white shadow-sm transition-colors h-8 px-3 rounded-full flex items-center gap-1.5"
            title="Start a live voice conversation"
            aria-label="Start voice chat with AI"
          >
            <Mic className="h-3.5 w-3.5" />
            <span className="text-[13px] font-semibold">Voice</span>
          </Button>

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([]);
                setActiveConvId(null);
                sessionStorage.removeItem(lastActiveStorageKey);
                router.replace("/admin/my-ai/chat");
              }}
              className="text-slate-400 hover:text-red-600 hover:bg-red-50/50 transition-colors h-8"
              title="Clear chat"
            >
              <Trash2 className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline text-[13px] font-medium">Clear</span>
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => {
              setMessages([]);
              setActiveConvId(null);
              sessionStorage.removeItem(lastActiveStorageKey);
              router.push("/admin/my-ai/chat");
            }}
            className="bg-sage-600 hover:bg-sage-700 text-white shadow-sm transition-colors h-8 px-3 rounded-md"
            title="Start a new chat"
          >
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline text-[13px] font-medium">New Chat</span>
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div
        className={cn(
          "relative flex-1 min-h-0 overscroll-contain px-4 py-8 sm:px-6",
          hasMessages ? "overflow-y-auto" : "overflow-hidden"
        )}
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/70 to-transparent" />
        <div className={cn(
          "relative max-w-[860px] mx-auto flex flex-col justify-end space-y-6 sm:space-y-8",
          hasMessages ? "min-h-full pb-2" : "h-full justify-center pb-2"
        )}>
          
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center px-4 animate-in fade-in duration-700 slide-in-from-bottom-4">
              <div className="h-16 w-16 bg-white border border-[#E3E3DF] shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-[20px] flex items-center justify-center mb-6">
                <Bot className="h-7 w-7 text-[#5F786D]" />
              </div>
              <h2 className="text-[22px] font-semibold text-[#1C2421] mb-2 text-center max-w-[500px] leading-tight">
                How can I help you today?
              </h2>
              <p className="text-[15px] text-[#68706C] mb-8 text-center">
                Ask about live calls, company usage, providers, costs, models, recent activity, and platform health.
              </p>

              {/* Suggested questions: internal workspace relevant */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[600px]">
                {buildSuggestions().map((q, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(q);
                      setTimeout(() => executeSend(q, []), 10);
                    }}
                    className="text-left bg-white border border-[#E3E3DF] hover:border-[#5F786D]/40 hover:bg-[#F4F7F6] p-4 rounded-2xl transition-all shadow-sm group"
                  >
                    <p className="text-[14px] text-[#1C2421] font-medium mb-1">{q}</p>
                    <p className="text-[12px] text-[#68706C] group-hover:text-[#5F786D] transition-colors">Tap to ask</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-4 sm:gap-6 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="h-9 w-9 shrink-0 rounded-[14px] bg-gradient-to-br from-[#EAF5EE] to-[#CFE4D6] border border-[#C6DDCE] flex items-center justify-center text-[#356A50] shadow-[0_3px_10px_rgba(53,106,80,0.12)] mt-0.5">
                  <Sparkles className="h-[17px] w-[17px]" />
                </div>
              )}
              
              <div className="flex flex-col max-w-[85%] sm:max-w-[75%]">
                {editingIndex === i ? (
                  <div className="flex flex-col gap-2 bg-sage-50 border border-sage-200 p-3 rounded-2xl w-full text-slate-800 shadow-sm">
                    <textarea 
                      value={editInput}
                      onChange={e => setEditInput(e.target.value)}
                      className="w-full bg-transparent resize-none border-0 outline-none focus:ring-0 text-[15px] p-1"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2 mt-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingIndex(null)} className="h-7 text-xs text-slate-500 hover:text-slate-700">Cancel</Button>
                      <Button size="sm" onClick={() => handleEditSend(i)} disabled={!editInput.trim() || sending} className="h-7 text-xs bg-sage-600 hover:bg-sage-700 text-white shadow-sm">Send</Button>
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
                    {m.role === "assistant" ? (
                      <div>
                        {/* Interactive Suggestion Pills */}
                        {(() => {
                          const lines = (m.content || "").split(/(?:\n)/);
                          const suggestions: string[] = [];
                          const cleanLines: string[] = [];
                          
                          // First pass: extract bullets that are questions (at the very end of the message)
                          // We only extract them if they are in the last block of lines
                          let extractingSuggestions = true;
                          for (let j = lines.length - 1; j >= 0; j--) {
                            const trimmed = lines[j].trim();
                            if (!trimmed) continue;
                            
                            const matchBullet = trimmed.match(/^(?:[\-\*•]|\d+\.)\s*['"‘“]?([^'"’”]+?\?)['"’”]?$/);
                            if (extractingSuggestions && matchBullet && matchBullet[1] && matchBullet[1].length > 6 && matchBullet[1].length < 120) {
                              suggestions.unshift(matchBullet[1].trim());
                            } else {
                              // Once we hit a non-suggestion line, stop extracting (so we only pull from the bottom)
                              extractingSuggestions = false;
                              cleanLines.unshift(lines[j]);
                            }
                          }
                          
                          const cleanContent = cleanLines.join('\n')
                            .replace(/\n(?:Kya aap|Would you like|Aap yeh bhi)\b[^\n]*(?:\n|$)/gi, '\n')
                            .replace(/Suggested questions(?:\s+you\s+can\s+ask)?\s*:\s*$/i, '')
                            .trim();

                          return (
                            <div>
                              <div className="prose prose-sm max-w-none text-[14px] prose-p:my-1 prose-p:leading-snug prose-headings:mb-1.5 prose-headings:mt-2 prose-headings:font-bold prose-headings:text-[#0C4A31] prose-h3:text-base prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-li:leading-snug prose-strong:font-bold prose-strong:text-[#0C4A31] prose-code:rounded-md prose-code:border prose-code:border-emerald-100 prose-code:bg-emerald-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:font-semibold prose-code:text-[#17613C] prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:text-slate-800 prose-a:text-sage-600 prose-p:last:mb-0">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    ul: ({ children }) => <ul className="list-none space-y-1 pl-0">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-none space-y-1 pl-0">{children}</ol>,
                      li: ({ children }) => <li className="relative block rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1 pl-6 leading-snug before:absolute before:left-2.5 before:top-[0.7rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-500 before:content-['']">{children}</li>,
                      hr: () => <hr className="!my-1 border-slate-200" />,
                      h3: ({ children }) => <h3 className="!mb-0 !mt-0 text-base font-bold text-[#0C4A31]">{children}</h3>,
                                  }}
                                >{cleanContent}</ReactMarkdown>
                              </div>
                              
                              {(i === messages.length - 1 && !sending && suggestions.length > 0) && (
                                <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                                  <div className="w-full text-[11px] font-semibold text-emerald-800/80 mb-0.5 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Suggested questions:</span>
                                  </div>
                                  {suggestions.slice(0, 4).map((sugg, sIdx) => (
                                    <button
                                      key={sIdx}
                                      onClick={() => executeSend(sugg, messages)}
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
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    )}
                  </div>
                )}
                
                {/* Actions & Sources */}
                {editingIndex !== i && (
                  <div className={`mt-1 flex items-center gap-1.5 sm:gap-2 ${m.role === "user" ? "justify-end mr-2" : "ml-2 flex-wrap"}`}>
                    {m.role === "user" && (
                      <button 
                        onClick={() => {
                          setEditInput(m.content);
                          setEditingIndex(i);
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 text-[11px] font-medium p-1"
                        title="Edit message"
                        aria-label="Edit message"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                    )}

                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(m.content);
                        setCopiedIndex(i);
                        setTimeout(() => setCopiedIndex(null), 2000);
                      }}
                      className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 text-[11px] font-medium p-1"
                      title="Copy message"
                      aria-label="Copy message"
                    >
                      {copiedIndex === i ? (
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
                          onClick={() => setFeedbackState(prev => ({ ...prev, [i]: 'like' }))}
                          className={`transition-colors flex items-center gap-1.5 text-[11px] font-medium p-1 ${feedbackState[i] === 'like' ? 'text-sage-600' : 'text-slate-400 hover:text-slate-600'}`}
                          title="Helpful response"
                          aria-label="Helpful response"
                        >
                          <ThumbsUp className={`h-3.5 w-3.5 ${feedbackState[i] === 'like' ? 'fill-current' : ''}`} />
                          <span className="hidden sm:inline">Like</span>
                        </button>
                        <button 
                          onClick={() => setFeedbackState(prev => ({ ...prev, [i]: 'dislike' }))}
                          className={`transition-colors flex items-center gap-1.5 text-[11px] font-medium p-1 ${feedbackState[i] === 'dislike' ? 'text-red-500' : 'text-slate-400 hover:text-slate-600'}`}
                          title="Not helpful response"
                          aria-label="Not helpful response"
                        >
                          <ThumbsDown className={`h-3.5 w-3.5 ${feedbackState[i] === 'dislike' ? 'fill-current' : ''}`} />
                          <span className="hidden sm:inline">Dislike</span>
                        </button>
                        
                        <div className="w-px h-3 bg-slate-200 mx-0.5 hidden sm:block"></div>
                        <button 
                          onClick={() => handleShare(m.content)}
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
                    {m.role === "assistant" && m.isError && i === messages.length - 1 && (
                      <button
                        onClick={() => {
                          const lastUserMsg = messages[i - 1];
                          if (lastUserMsg && lastUserMsg.role === "user") {
                            setMessages(prev => prev.slice(0, i - 1));
                            setInput(lastUserMsg.content);
                          }
                        }}
                        className="text-slate-400 hover:text-sage-600 transition-colors flex items-center gap-1.5 text-[11px] font-medium ml-1"
                        title="Retry message"
                        aria-label="Retry message"
                      >
                        <span>Retry</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Sources UI */}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-4 sm:gap-6 justify-start animate-in fade-in duration-300">
              <div className="h-9 w-9 shrink-0 rounded-[14px] bg-gradient-to-br from-[#EAF5EE] to-[#CFE4D6] border border-[#C6DDCE] flex items-center justify-center text-[#356A50] shadow-[0_3px_10px_rgba(53,106,80,0.12)] mt-0.5">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-2 text-[13px] text-[#68706C] font-medium h-8">
                  {canonicalizeCustomerFacingName(agent.name)} is typing
                  <span className="flex gap-1 ml-1">
                    <span className="w-1 h-1 bg-[#8EA89F] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1 h-1 bg-[#8EA89F] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1 h-1 bg-[#8EA89F] rounded-full animate-bounce"></span>
                  </span>
                </div>
              </div>
            </div>
          )}
          

          <div ref={endRef} className="h-2" />
        </div>
      </div>

      {/* ── Inline Voice Mode Dock ─────────────────────────────────────── */}
      {voiceModeActive && (
        <VoiceModeDock
          agent={agent}
          companyId={companyId}
          activeConvId={activeConvId}
          onConvIdChange={handleVoiceConvIdChange}
          onEnd={() => {
            // Close only the voice dock. Keep this chat screen and the
            // rendered transcript in place so the just-finished session is
            // immediately visible; the next typed question starts a fresh
            // Admin Copilot record because the active conversation ref is
            // cleared below.
            setVoiceModeActive(false);
            setActiveConvId(null);
            activeConvIdRef.current = null;
            sessionStorage.removeItem(lastActiveStorageKey);
          }}
          onMessagesUpdate={handleVoiceMessagesUpdate}
          messages={messages}
        />
      )}

      {/* ── Modern Composer (hidden while voice is active) ──────────────── */}
      {!voiceModeActive && (
        <div className="shrink-0 border-t border-[#E3EAE4]/80 bg-gradient-to-t from-[#F4F7F3] via-[#F7F9F6] to-transparent px-3 pb-3 pt-2 sm:px-5">
          <div className="max-w-[860px] mx-auto w-full relative">
            <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_28px_rgba(34,62,47,0.10)] border border-[#D9E6DD] focus-within:border-[#7DAF91] focus-within:shadow-[0_10px_34px_rgba(34,92,58,0.14)] transition-all flex flex-col mx-auto outline-none">
            {/* Attachment Preview Chips */}
            {selectedDocIds.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
                {selectedDocIds.map(id => {
                  const doc = documents.find(d => d.id === id);
                  if (!doc) return null;
                  return (
                    <div key={id} className="flex items-center gap-1.5 bg-white border border-[#E3E3DF] rounded-[12px] px-2.5 py-1.5 text-[13px] text-[#1C2421] shadow-sm max-w-[200px]">
                      <FileText className="h-3.5 w-3.5 text-[#68706C] shrink-0" />
                      <span className="truncate">{doc.filename}</span>
                      <button 
                        onClick={() => setSelectedDocIds(prev => prev.filter(i => i !== id))} 
                        className="text-[#68706C] hover:text-[#1C2421] transition-colors ml-1 p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-end p-1.5 relative">
              {/* Left controls (Attach, Mic) */}
              <div className="flex items-center gap-1 pb-1 px-1">
                <div className="relative">
                  <Button
                    onClick={() => setShowAttach(!showAttach)}
                    variant="ghost"
                    size="icon"
                    className={`h-9 w-9 rounded-full ${selectedDocIds.length > 0 ? 'text-[#5F786D] bg-[#E8F0EC]' : 'text-[#68706C] hover:text-[#43584F] hover:bg-[#F7F6F3]'}`}
                    title="Attach Documents"
                    aria-label="Attach Documents"
                  >
                    <Paperclip className="h-[20px] w-[20px]" />
                  </Button>
                  {showAttach && (
                    <div className="absolute bottom-full left-0 mb-3 w-64 bg-white border border-[#E3E3DF] shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-xl p-3 z-50">
                      <h3 className="text-xs font-semibold text-[#1C2421] mb-2">Select Documents</h3>
                      {documents.length === 0 ? (
                        <p className="text-xs text-[#68706C] mb-2">No documents available.</p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto space-y-1 mb-2">
                          {documents.map(doc => (
                            <label key={doc.id} className="flex items-center gap-2 text-sm p-1.5 hover:bg-[#F7F6F3] rounded cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedDocIds.includes(doc.id)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedDocIds(prev => [...prev, doc.id]);
                                  else setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                                }}
                                className="rounded border-[#E3E3DF] text-[#5F786D] focus:ring-[#5F786D]"
                              />
                              <span className="truncate flex-1 text-[#1C2421]" title={doc.filename}>{doc.filename}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="pt-2 border-t border-[#E3E3DF]">
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={handleFileUpload}
                          accept=".pdf,.txt,.docx,.csv,.md"
                        />
                        <Button 
                          onClick={() => fileInputRef.current?.click()} 
                          disabled={uploading}
                          variant="outline" 
                          size="sm" 
                          className="w-full text-xs h-8 text-[#5F786D] border-[#E3E3DF] hover:bg-[#F7F6F3]"
                        >
                          {uploading ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                          ) : (
                            <Plus className="h-3 w-3 mr-1.5" />
                          )}
                          Upload Document
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <Button
                  onClick={() => setVoiceModeActive(true)}
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-[#68706C] hover:text-[#43584F] hover:bg-[#F7F6F3]"
                  title="Start Voice Chat AI"
                  aria-label="Start Voice Chat AI"
                >
                  <Mic className="h-[20px] w-[20px]" />
                </Button>
              </div>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${canonicalizeCustomerFacingName(agent.name)}...`}
                rows={1}
                className="flex-1 bg-transparent resize-none border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none text-[15px] p-2 sm:px-3 sm:py-2.5 min-h-[40px] max-h-[200px] overflow-y-auto disabled:opacity-50 text-[#1C2421] placeholder-[#68706C]"
              />
              
              {/* Right controls (Send) */}
              <div className="pb-1 px-1">
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  size="icon"
                  title="Send message"
                  aria-label="Send message"
                  className="h-9 w-9 shrink-0 rounded-full bg-[#5F786D] hover:bg-[#43584F] disabled:bg-slate-200 disabled:text-slate-500 transition-colors shadow-sm flex items-center justify-center disabled:opacity-100"
                >
                  {sending ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  ) : (
                    <Send className="h-[18px] w-[18px]" />
                  )}
                </Button>
              </div>
            </div>
            </div>
            
            {/* Footer Area */}
            <div className="mt-1.5 flex justify-between items-center px-1">
              <span className="flex items-center gap-1.5 text-[11px] leading-none text-[#68706C]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Platform Workspace. Super Admin access only.
              </span>
              <span className="hidden sm:inline-block text-[11px] text-[#A0A8A4] font-medium tracking-wide">
                Enter to send · Shift+Enter for a new line
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MyChatPage() {
  const { companyId, isLoading: compLoading } = useCurrentCompany();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!companyId || compLoading) return;
    agentsApi
      .list(companyId)
      .then((res) => {
        const list = res.agents || [];
        setAgents(list);
        if (list.length > 0) setSelectedAgent(list[0]);
      })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, [companyId, compLoading]);

  // The routing page can update the active agent in another tab. Refresh the
  // selected agent after that save so the voice dock reflects the same engine
  // that the server will use for the next session.
  useEffect(() => {
    if (!companyId || !selectedAgent?.id) return;
    let disposed = false;
    const refreshSelectedAgent = async () => {
      try {
        const latest = await agentsApi.get(companyId, selectedAgent.id);
        if (disposed || !latest) return;
        setSelectedAgent((current) =>
          current && current.voice_engine !== latest.voice_engine
            ? latest
            : current,
        );
        setAgents((current) =>
          current.map((item) => (item.id === latest.id ? latest : item)),
        );
      } catch {
        // Keep the current session usable if the background refresh is delayed.
      }
    };
    const onRoutingUpdated = () => { void refreshSelectedAgent(); };
    window.addEventListener("storage", onRoutingUpdated);
    window.addEventListener("focus", onRoutingUpdated);
    const timer = window.setInterval(refreshSelectedAgent, 5000);
    return () => {
      disposed = true;
      window.removeEventListener("storage", onRoutingUpdated);
      window.removeEventListener("focus", onRoutingUpdated);
      window.clearInterval(timer);
    };
  }, [companyId, selectedAgent?.id]);

  if (compLoading || pageLoading) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-5 py-4">
        <div className="flex items-center justify-between"><div className="space-y-2"><div className="h-7 w-48 rounded bg-slate-200" /><div className="h-4 w-80 max-w-full rounded bg-slate-100" /></div><div className="h-10 w-36 rounded-xl bg-slate-100" /></div>
        <div className="min-h-[54vh] rounded-3xl border border-slate-100 bg-white p-6"><div className="h-20 w-[65%] rounded-2xl bg-slate-100" /><div className="mt-5 ml-auto h-14 w-[48%] rounded-2xl bg-slate-100" /><div className="mt-auto pt-[26vh]"><div className="h-14 rounded-2xl bg-slate-100" /></div></div>
      </div>
    );
  }

  return (
    <>
      {!selectedAgent || agents.length === 0 ? (
        <SetupScreen
          companyId={companyId!}
          onCreated={(agent) => {
            setAgents([agent]);
            setSelectedAgent(agent);
          }}
        />
      ) : (
        <Suspense fallback={
          <div className="flex items-center justify-center h-[50vh]">
            <div className="w-full max-w-5xl animate-pulse rounded-3xl border border-slate-100 bg-white p-6"><div className="h-20 w-[65%] rounded-2xl bg-slate-100" /><div className="mt-5 ml-auto h-14 w-[48%] rounded-2xl bg-slate-100" /></div>
          </div>
        }>
          <ChatScreen
            agent={selectedAgent}
            companyId={companyId!}
            agents={agents}
            onSwitchAgent={setSelectedAgent}
          />
        </Suspense>
      )}
    </>
  );
}
