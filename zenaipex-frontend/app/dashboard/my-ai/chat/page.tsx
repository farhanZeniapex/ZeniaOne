"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { agentsApi, Agent } from "@/lib/api/agents";
import { conversationsApi } from "@/lib/api/conversations";
import { fetchApi, ApiError, getCompanyLogoUrl } from "@/lib/api/client";
import { knowledgeApi } from "@/lib/api/knowledge";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/hooks/use-company";
import {
  Bot, Loader2, Send, Trash2, Database, ShieldCheck, Sparkles, Plus, Paperclip, Mic, Copy, Check, FileText, X,
  ThumbsUp, ThumbsDown, Share, Edit2
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VoiceModeDock } from "@/components/ai-bot/voice-mode-overlay";
import { SmartSelect } from "@/components/ui/smart-select";
import { canonicalizeCustomerFacingName } from "@/lib/utils";
interface Source {
  label: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isError?: boolean;
  isLiveVoice?: boolean;
}

/** Topic-level suggested questions that feel like real customer intent.
 *  These are universal enough to be used for any company without being generic/robotic.
 *  They are chosen over filename-derived questions intentionally. */
const DEFAULT_SUGGESTIONS = [
  "What services do you offer?",
  "How can I book an appointment?",
  "What are your business hours?",
  "Where are you located?",
];

/** Build customer-intent suggestions. Avoids exposing any internal filename.
 *  Falls back to universal questions if company name is unavailable.
 *  No LLM call is made — purely deterministic. */
function buildSuggestions(companyName: string): string[] {
  // If we know the company name, make the first question specific to them.
  if (companyName) {
    return [
      `What services does ${companyName} offer?`,
      "How can I book an appointment?",
      "What are the business hours?",
      "How do I get in touch?",
    ];
  }
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
  const [name, setName] = useState("Customer Support Assistant");
  const [prompt, setPrompt] = useState(
    "You are a helpful customer support assistant. " +
      "You answer customer queries professionally based on the company's knowledge base. " +
      "Be concise, polite, and helpful."
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
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("myAiDraft") || "";
    return "";
  });
  const [sending, setSending] = useState(false);
  const [activeConvId, setActiveConvIdInner] = useState<string | null>(convIdParam);
  const activeConvIdRef = useRef<string | null>(convIdParam);
  
  // Custom setter to trace state changes
  const setActiveConvId = (newId: string | null, source: string = "unknown") => {
    const isTmp = newId === "tmp" || newId === "temp";
    console.log(`[CONVERSATION_ID_TRACE] event=state_change value=${newId} source=${source} placeholder=${isTmp}`);
    setActiveConvIdInner(newId);
  };

  // Log initial state
  useEffect(() => {
    const isTmp = convIdParam === "tmp" || convIdParam === "temp";
    console.log(`[CONVERSATION_ID_TRACE] event=initial_render value=${convIdParam} source=url_param placeholder=${isTmp}`);
  }, [convIdParam]);
  
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
    if (activeConvId && activeConvId !== "tmp" && activeConvId !== "temp") {
      sessionStorage.setItem("lastActiveConvId", activeConvId);
    }
  }, [activeConvId]);

  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showAttach, setShowAttach] = useState(false);
  const [expandedSources, setExpandedSources] = useState<number[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");
  const [feedbackState, setFeedbackState] = useState<Record<number, 'like' | 'dislike'>>({});
  const [uploading, setUploading] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");
  const [companyData, setCompanyData] = useState<any>(null);

  // Voice mode is intentionally route-scoped. The text conversation survives
  // navigation, but an open microphone session must not be resurrected after
  // the page unmounts with a stale WebSocket/audio stream.
  const [voiceModeActive, setVoiceModeActive] = useState(false);

  // Preserve an unfinished text draft when the user opens History or another
  // dashboard screen. The persisted conversation ID/history is restored below.
  useEffect(() => {
    if (input) sessionStorage.setItem("myAiDraft", input);
    else sessionStorage.removeItem("myAiDraft");
  }, [input]);

  useEffect(() => {
    if (companyId) {
      fetchApi(`/companies/${companyId}`).then((res: any) => {
        if (res && res.name) setCompanyName(res.name);
        setCompanyData(res);
      }).catch(() => {});
    }
  }, [companyId]);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSources = (index: number) => {
    setExpandedSources(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

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
    console.log(`[CONVERSATION_ID_TRACE] event=page_init conversation_id=${convIdParam || 'none'}`);
    
    if (convIdParam === "tmp" || convIdParam === "temp") {
      console.log(`[CONVERSATION_ID_TRACE] placeholder_blocked=true value=${convIdParam}`);
      setMessages([]);
      setActiveConvId(null);
      // Optional: clean up URL
      router.replace("/dashboard/my-ai/chat");
      return;
    }

    if (convIdParam) {
      if (!companyId) return; // Wait for companyId to load before fetching
      
      console.log(`[CONVERSATION_ID_TRACE] event=history_load conversation_id=${convIdParam}`);
      // Save to sessionStorage so it persists if they navigate away and come back
      sessionStorage.setItem("lastActiveConvId", convIdParam);
      
      conversationsApi.getMessages(companyId, convIdParam)
        .then((res) => {
          if (res.messages && res.messages.length > 0) {
            const history = res.messages.map(m => ({
              role: m.role as "user" | "assistant",
              content: m.text,
              sources: [] // We don't store sources in transcript currently, so they will be empty on reload
            }));
            setMessages(prev => {
              const hasWelcome = prev.length > 0 && prev[prev.length - 1].content.includes("Welcome to");
              if (hasWelcome) {
                return [...history, prev[prev.length - 1]];
              }
              return history;
            });
            setActiveConvId(convIdParam, "history_load_success");
          }
        })
        .catch(() => {});
    } else {
      // If no convIdParam, check if we have a persisted session
      const lastSessionId = sessionStorage.getItem("lastActiveConvId");
      if (lastSessionId) {
         router.replace(`/dashboard/my-ai/chat?id=${lastSessionId}`);
         return;
      }
      
      // If no param and no session, reset to a clean new chat
      setMessages([]);
      setActiveConvId(null, "reset_no_param");
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
      
      let actualConvId = currentConvId;
      if (!actualConvId || actualConvId === "tmp") {
        try {
          const convRes = await agentsApi.createConversation(companyId, agent.id);
          actualConvId = convRes.conversation_id;
          console.log(`[CONVERSATION_ID_TRACE] event=create source=text_send conversation_id=${actualConvId} is_placeholder=false`);
          setActiveConvId(actualConvId, "create_before_send");
          activeConvIdRef.current = actualConvId;
          router.replace(`/dashboard/my-ai/chat?id=${actualConvId}`);
        } catch (e) {
          console.error("Failed to pre-create conversation", e);
        }
      }

      if (actualConvId && actualConvId !== "tmp") {
        payload.conversation_id = actualConvId;
      }

      console.log(`[CONVERSATION_ID_TRACE] event=text_send conversation_id=${actualConvId}`);

      if (selectedDocIds.length > 0) {
        payload.document_ids = selectedDocIds;
      }
      
      const res = await agentsApi.testChat(companyId, agent.id, payload.message, payload.history, payload.conversation_id);
      
      if (res.conversation_id && res.conversation_id !== "tmp" && !activeConvIdRef.current) {
        setActiveConvId(res.conversation_id, "testChat_response");
        activeConvIdRef.current = res.conversation_id; // Update ref immediately for subsequent fast calls
        router.replace(`/dashboard/my-ai/chat?id=${res.conversation_id}`);
      }
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.answer, sources: res.sources },
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
    const trimmedUser = userText.trim();
    const trimmedAi = aiText.trim();

    setMessages((prev) => {
      const updated = [...prev];

      if (trimmedUser) {
        const lastMsg = updated[updated.length - 1];
        const secondLastMsg = updated.length >= 2 ? updated[updated.length - 2] : null;

        if (lastMsg && lastMsg.role === "user") {
          updated[updated.length - 1] = {
            ...lastMsg,
            content: trimmedUser,
            isLiveVoice: isInterimUser
          };
        } else if (secondLastMsg && secondLastMsg.role === "user" && lastMsg && lastMsg.role === "assistant" && lastMsg.content === "...") {
          updated[updated.length - 2] = {
            ...secondLastMsg,
            content: trimmedUser,
            isLiveVoice: isInterimUser
          };
        } else {
          updated.push({
            role: "user",
            content: trimmedUser,
            isLiveVoice: isInterimUser
          });
        }
      }

      if (trimmedAi) {
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          updated[updated.length - 1] = {
            ...lastMsg,
            content: trimmedAi,
            sources: sources || lastMsg.sources || []
          };
        } else {
          updated.push({
            role: "assistant",
            content: trimmedAi,
            sources: sources || []
          });
        }
      }

      return updated;
    });
  }

  function handleVoiceConvIdChange(newId: string) {
    setActiveConvId(newId, "voice_overlay_callback");
    activeConvIdRef.current = newId;
    router.replace(`/dashboard/my-ai/chat?id=${newId}`);
  }



  // Derive company logo URL from company data
  const companyLogoUrl = companyData?.settings?.logo_url
    ? getCompanyLogoUrl(companyId, companyData.settings.logo_url)
    : undefined;

  // Keep the viewport stable while a long answer/typing indicator is rendered.
  // A smooth scroll on every render causes visible height oscillation/flicker
  // when Markdown reflows or the typing indicator mounts/unmounts.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 sm:-m-6 lg:-m-8 bg-[#FAF9F8]">

      {/* Minimal Header */}
      <div className="h-14 border-b border-[#E3E3DF] bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-[#E8F0EC] rounded-full flex items-center justify-center text-[#5F786D] shrink-0 border border-[#D1DFD9]">
            <Bot className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none mb-1">
              {agents.length > 1 ? (
                <SmartSelect
                  value={agent.id}
                  onChange={(value) => { const a = agents.find((ag) => ag.id === value); if (a) onSwitchAgent(a); }}
                  searchable={agents.length > 5}
                  options={agents.map((a) => ({ value: a.id, label: canonicalizeCustomerFacingName(a.name), badge: "Online" }))}
                  className="w-52 [&>button]:h-9 [&>button]:border-transparent [&>button]:bg-transparent [&>button]:px-1 [&>button]:shadow-none [&>button]:text-[15px] [&>button]:hover:border-transparent [&>button]:hover:shadow-none"
                />
              ) : (
                  <span className="text-[#1C2421] text-[15px] font-semibold">{canonicalizeCustomerFacingName(agent.name)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[11px] text-[#68706C] font-medium leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Online
              </span>
              {agent.knowledge_base_id && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-[#D1DFD9] mx-1"></span>
                  <span className="flex items-center text-[11px] text-[#5F786D] font-medium leading-none">
                    <Database className="h-3 w-3 mr-1" /> Knowledge Connected
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Voice Chat AI — primary voice mode entry */}
          <Button
            size="sm"
            onClick={() => {
              console.log(`[VOICE] Button clicked`);
              setVoiceModeActive(true);
            }}
            className="bg-[#3E5448] hover:bg-[#2A3D34] text-white shadow-sm transition-colors h-8 px-3 rounded-full flex items-center gap-1.5"
            title="Start a live voice conversation"
            aria-label="Start voice chat with AI"
          >
            <Mic className="h-3.5 w-3.5" />
            <span className="text-[13px] font-medium">Voice Chat AI</span>
          </Button>

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                sessionStorage.removeItem("lastActiveConvId");
                setMessages([]);
                setActiveConvId(null, "clear_chat");
                router.replace("/dashboard/my-ai/chat");
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
              sessionStorage.removeItem("lastActiveConvId");
              setMessages([]);
              setActiveConvId(null, "new_chat_button");
              router.push("/dashboard/my-ai/chat");
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
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-8"
        style={{ scrollbarGutter: "stable" }}
      >
        <div className="min-h-full max-w-[800px] mx-auto space-y-6 sm:space-y-8 pb-4">
          
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-[10vh] sm:mt-[15vh] px-4 animate-in fade-in duration-700 slide-in-from-bottom-4">
              <div className="h-16 w-16 bg-white border border-[#E3E3DF] shadow-[0_4px_20px_rgb(0,0,0,0.03)] rounded-[20px] flex items-center justify-center mb-6">
                <Bot className="h-7 w-7 text-[#5F786D]" />
              </div>
              <h2 className="text-[22px] font-semibold text-[#1C2421] mb-2 text-center max-w-[500px] leading-tight">
                Hi! What would you like to know about {companyName || 'us'}?
              </h2>
              <p className="text-[15px] text-[#68706C] mb-8 text-center">
                Ask about services, appointments, hours, or anything else you&apos;d like to know.
              </p>

              {/* Suggested questions: derived from company name, never from document filenames */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-[600px]">
                {buildSuggestions(companyName).map((q, i) => (
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
                <div className="h-8 w-8 shrink-0 rounded-full bg-white border border-[#E3E3DF] flex items-center justify-center text-[#5F786D] shadow-sm mt-0.5">
                  <Sparkles className="h-4 w-4" />
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
                    className={`px-4 sm:px-5 py-3 sm:py-3.5 text-sm sm:text-[15px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#5F786D] text-white rounded-[20px] rounded-tr-[4px] shadow-sm"
                        : "bg-white text-[#1C2421] rounded-[20px] rounded-tl-[4px] border border-[#E3E3DF] shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      m.content.trim() === "..." ? (
                        <div className="flex items-center gap-2.5 min-w-[112px] py-0.5 text-[#68706C]" role="status" aria-label="Assistant is thinking">
                          <Sparkles className="h-3.5 w-3.5 text-sage-600 animate-pulse" />
                          <span className="text-[13px] font-medium">Thinking</span>
                          <span className="flex items-center gap-1 ml-0.5" aria-hidden="true">
                            <span className="h-1.5 w-1.5 rounded-full bg-sage-600 animate-bounce [animation-delay:-0.3s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-sage-500 animate-bounce [animation-delay:-0.15s]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-sage-400 animate-bounce" />
                          </span>
                        </div>
                      ) : <div>
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
                          
                          const cleanContent = cleanLines.join('\n').replace(/Suggested questions(?:\s+you\s+can\s+ask)?\s*:\s*$/i, '').trim();

                          return (
                            <div>
                              <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 prose-pre:text-slate-800 prose-a:text-sage-600 prose-p:last:mb-0">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleanContent}</ReactMarkdown>
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
                {editingIndex !== i && m.content.trim() !== "..." && (
                  <div className={`mt-2 flex items-center gap-2 sm:gap-3 ${m.role === "user" ? "justify-end mr-2" : "ml-2 flex-wrap"}`}>
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
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-4 sm:gap-6 justify-start animate-in fade-in duration-300">
              <div className="h-8 w-8 shrink-0 rounded-full bg-white border border-[#E3E3DF] flex items-center justify-center text-[#5F786D] shadow-sm mt-0.5">
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
          onEnd={() => setVoiceModeActive(false)}
          onMessagesUpdate={handleVoiceMessagesUpdate}
          messages={messages}
        />
      )}

      {/* ── Modern Composer (hidden while voice is active) ──────────────── */}
      {!voiceModeActive && (
        <div className="shrink-0 bg-gradient-to-t from-[#FAF9F8] via-[#FAF9F8] to-transparent pt-4 pb-8 px-4 sm:px-6">
          <div className="max-w-[800px] mx-auto w-full relative">
            <div className="relative bg-[#FFFFFF] rounded-[22px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-[#E3E3DF] focus-within:border-sage-400 focus-within:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-all flex flex-col mx-auto outline-none">
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

            <div className="flex items-end p-2 relative">
              {/* Left controls (Attach, Mic) */}
              <div className="flex items-center gap-1 pb-1 px-1">
                <div className="relative">
                  <Button
                    onClick={() => setShowAttach(!showAttach)}
                    variant="ghost"
                    size="icon"
                    className={`h-[42px] w-[42px] rounded-full ${selectedDocIds.length > 0 ? 'text-[#5F786D] bg-[#E8F0EC]' : 'text-[#68706C] hover:text-[#43584F] hover:bg-[#F7F6F3]'}`}
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
                  onClick={() => {
                    console.log(`[VOICE] Button clicked`);
                    setVoiceModeActive(true);
                  }}
                  variant="ghost"
                  size="icon"
                  className="h-[42px] w-[42px] rounded-full text-[#68706C] hover:text-[#43584F] hover:bg-[#F7F6F3]"
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
                className="flex-1 bg-transparent resize-none border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none text-[15px] p-2 sm:px-3 sm:py-3 min-h-[44px] max-h-[200px] overflow-y-auto disabled:opacity-50 text-[#1C2421] placeholder-[#68706C]"
              />
              
              {/* Right controls (Send) */}
              <div className="pb-1 px-1">
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  size="icon"
                  title="Send message"
                  aria-label="Send message"
                  className="h-[42px] w-[42px] shrink-0 rounded-full bg-[#5F786D] hover:bg-[#43584F] disabled:bg-slate-200 disabled:text-slate-500 transition-colors shadow-sm flex items-center justify-center disabled:opacity-100"
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
            <div className="mt-3 flex justify-between items-center px-1">
              <span className="flex items-center gap-1.5 text-[12px] text-[#68706C]">
                <ShieldCheck className="h-[14px] w-[14px]" />
                  {companyName || canonicalizeCustomerFacingName(agent.name)}
              </span>
              <span className="hidden sm:inline-block text-[11px] text-[#A0A8A4] font-medium tracking-wide">
                Return to send
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

  if (compLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
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
        <ChatScreen
          agent={selectedAgent}
          companyId={companyId!}
          agents={agents}
          onSwitchAgent={setSelectedAgent}
        />
      )}
    </>
  );
}
