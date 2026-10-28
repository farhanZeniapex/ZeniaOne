"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchApi, ApiError, getCompanyLogoUrl } from "@/lib/api/client";
import { agentsApi, Agent } from "@/lib/api/agents";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Send,
  Database,
  Sparkles,
  Paperclip,
  Mic,
  Copy,
  Check,
  FileText,
  X,
  ThumbsUp,
  ThumbsDown,
  Share,
  Edit2,
  Zap,
  Building2,
  Bot,
  ChevronDown,
  Trash2,
  ShieldCheck,
  Timer,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { VoiceModeDock } from "@/components/ai-bot/voice-mode-overlay";

interface Company {
  id: string;
  name: string;
  logo_url?: string;
}
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
  latencyMs?: number;
}
interface AttachedFile {
  name: string;
  content: string;
  type: string;
  size: number;
}

function CompanyAvatar({
  company,
  small = false,
}: {
  company?: Company;
  small?: boolean;
}) {
  const initials = (company?.name || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const logo = company
    ? getCompanyLogoUrl(company.id, company.logo_url)
    : undefined;
  return logo ? (
    <img
      src={logo}
      alt=""
      className={`${small ? "h-7 w-7" : "h-8 w-8"} rounded-lg object-cover ring-1 ring-emerald-100`}
    />
  ) : (
    <span
      className={`${small ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs"} inline-flex items-center justify-center rounded-lg bg-emerald-50 font-bold text-emerald-700 ring-1 ring-emerald-100`}
    >
      {initials}
    </span>
  );
}
interface TestRun {
  id: string;
  question: string;
  latencyMs: number;
  sources: number;
  createdAt: string;
  success: boolean;
}

export default function AdminAiPlaygroundPage() {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const [isAgentDropdownOpen, setIsAgentDropdownOpen] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(() =>
    typeof window !== "undefined"
      ? sessionStorage.getItem("zeniaone_playground_draft") || ""
      : "",
  );
  const [sending, setSending] = useState(false);
  const [isInit, setIsInit] = useState(true);

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const activeConvIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    try {
      if (input) sessionStorage.setItem("zeniaone_playground_draft", input);
      else sessionStorage.removeItem("zeniaone_playground_draft");
    } catch {}
  }, [input]);

  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");
  const [feedbackState, setFeedbackState] = useState<
    Record<number, "like" | "dislike">
  >({});
  const [expandedSources, setExpandedSources] = useState<Record<number, boolean>>({});
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);

  const companyDropdownRef = useRef<HTMLDivElement>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedCompany || !selectedAgent?.id) return;
    const key = `zeniaone-playground-runs-${selectedCompany}-${selectedAgent.id}`;
    try {
      setTestRuns(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      setTestRuns([]);
    }
  }, [selectedCompany, selectedAgent?.id]);

  const saveTestRun = (run: TestRun) => {
    setTestRuns((current) => {
      const next = [run, ...current].slice(0, 25);
      if (selectedCompany && selectedAgent?.id)
        localStorage.setItem(
          `zeniaone-playground-runs-${selectedCompany}-${selectedAgent.id}`,
          JSON.stringify(next),
        );
      return next;
    });
  };

  useEffect(() => {
    fetchApi<{ companies: Company[] }>("/admin/companies")
      .then((d) => {
        const comps = d.companies || [];
        setCompanies(comps);
        const savedCompany =
          typeof window !== "undefined"
            ? localStorage.getItem("zeniaone_playground_selected_company")
            : null;
        const tenant =
          (savedCompany && comps.find((c) => c.id === savedCompany)) ||
          comps.find((c) => c.id !== "6a990b403e9b17bef89acf87") ||
          comps[0];
        if (tenant) {
          setSelectedCompany(tenant.id);
        }
      })
      .finally(() => setIsInit(false));

    const handleClickOutside = (event: MouseEvent) => {
      if (
        companyDropdownRef.current &&
        !companyDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCompanyDropdownOpen(false);
      }
      if (
        agentDropdownRef.current &&
        !agentDropdownRef.current.contains(event.target as Node)
      ) {
        setIsAgentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedCompany) {
      setAgents([]);
      setSelectedAgent(null);
      setMessages([]);
      setActiveConvId(null);
      activeConvIdRef.current = null;
      setAttachedFile(null);
      return;
    }

    try {
      localStorage.setItem("zeniaone_playground_selected_company", selectedCompany);
    } catch {}

    fetchApi<{ agents: Agent[] }>(`/admin/agents`).then((d) => {
      const filtered = (d.agents || []).filter(
        (a: Agent) => a.company_id === selectedCompany,
      );
      setAgents(filtered);
      if (filtered.length > 0) {
        const savedAgentId =
          typeof window !== "undefined"
            ? localStorage.getItem("zeniaone_playground_selected_agent")
            : null;
        const target =
          (savedAgentId && filtered.find((a) => a.id === savedAgentId)) ||
          filtered[0];
        setSelectedAgent(target);
      } else {
        setSelectedAgent(null);
        setMessages([]);
        setActiveConvId(null);
        activeConvIdRef.current = null;
      }
      setAttachedFile(null);
    });
  }, [selectedCompany]);

  useEffect(() => {
    if (!selectedCompany || !selectedAgent?.id) {
      setMessages([]);
      setActiveConvId(null);
      activeConvIdRef.current = null;
      setAttachedFile(null);
      return;
    }

    try {
      localStorage.setItem("zeniaone_playground_selected_agent", selectedAgent.id);
    } catch {}

    // Restore persistent session for this specific agent & company
    const sessionKey = `zeniaone_playground_session_${selectedCompany}_${selectedAgent.id}`;
    try {
      const savedRaw = localStorage.getItem(sessionKey);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw);
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          setMessages(parsed.messages);
          setActiveConvId(parsed.activeConvId || null);
          activeConvIdRef.current = parsed.activeConvId || null;
          setAttachedFile(null);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to restore playground session", err);
    }

    // Default clean state if no prior session exists
    setMessages([]);
    setActiveConvId(null);
    activeConvIdRef.current = null;
    setAttachedFile(null);
  }, [selectedAgent?.id, selectedCompany]);

  // Persist conversation messages and active conversation id
  useEffect(() => {
    if (!selectedCompany || !selectedAgent?.id) return;
    const sessionKey = `zeniaone_playground_session_${selectedCompany}_${selectedAgent.id}`;
    try {
      if (messages.length > 0) {
        localStorage.setItem(
          sessionKey,
          JSON.stringify({
            activeConvId,
            messages,
            updatedAt: Date.now(),
          }),
        );
      }
    } catch (err) {
      console.warn("Failed to persist playground session", err);
    }
  }, [messages, activeConvId, selectedCompany, selectedAgent?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For playground, we only support text-based parsing natively in browser to avoid backend changes
    // This explicitly prevents silently uploading to a permanent KB.
    if (file.size > 500000) {
      alert("Please select a file smaller than 500KB for playground testing.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setAttachedFile({
        name: file.name,
        type: file.type || "text/plain",
        size: file.size,
        content: content,
      });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function executeSend(
    rawText: string,
    currentHistory: Message[],
    isRetry = false,
  ) {
    if (sending || !selectedCompany || !selectedAgent) return;

    let textToSend = rawText;

    // Only append attachment context if this is a new message (not a retry)
    if (attachedFile && !isRetry) {
      textToSend += `\n\n--- Attached Document Context: ${attachedFile.name} ---\n${attachedFile.content.substring(0, 10000)}`;
    }

    const displayMsg =
      attachedFile && !isRetry && !rawText.trim()
        ? `Sent attachment: ${attachedFile.name}`
        : rawText;

    const requestStartedAt = Date.now();
    setSending(true);
    setMessages([...currentHistory, { role: "user", content: displayMsg }]);
    setInput("");
    setAttachedFile(null);

    try {
      const payload: any = {
        message: textToSend,
        history: currentHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      const currentConvId = activeConvIdRef.current;
      if (currentConvId) {
        payload.conversation_id = currentConvId;
      }

      const res = await agentsApi.testChat(
        selectedCompany,
        selectedAgent.id,
        payload.message,
        payload.history,
        payload.conversation_id,
      );

      if (res.conversation_id && !currentConvId) {
        setActiveConvId(res.conversation_id);
        activeConvIdRef.current = res.conversation_id;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer,
          sources: res.sources,
          latencyMs: Date.now() - requestStartedAt,
        },
      ]);
      saveTestRun({
        id: `${Date.now()}`,
        question: rawText || "Attached document test",
        latencyMs: Date.now() - requestStartedAt,
        sources: res.sources?.length || 0,
        createdAt: new Date().toISOString(),
        success: true,
      });
    } catch (e: any) {
      let errorMsg =
        "Sorry, I'm having trouble responding right now. Please try again in a moment.";

      if (e instanceof ApiError) {
        if (e.status === 504) {
          errorMsg =
            "The request timed out. The system might be taking too long to process. Please try again.";
        } else {
          errorMsg = e.message || errorMsg;
        }
      } else {
        console.error(
          "[CHAT_RESPONSE_PARSE] Error:",
          e,
          "status=unknown answer_present=false resolution=error",
        );
        errorMsg = "Encountered an unexpected error parsing the response.";
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMsg,
          isError: true,
          latencyMs: Date.now() - requestStartedAt,
        },
      ]);
      saveTestRun({
        id: `${Date.now()}`,
        question: rawText || "Attached document test",
        latencyMs: Date.now() - requestStartedAt,
        sources: 0,
        createdAt: new Date().toISOString(),
        success: false,
      });
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if ((!input.trim() && !attachedFile) || sending) return;
    executeSend(input.trim(), messages);
  }

  function handleEditSend(index: number) {
    if (!editInput.trim() || sending) return;
    const text = editInput.trim();
    setEditingIndex(null);
    executeSend(text, messages.slice(0, index), true);
  }

  function handleShare(text: string) {
    if (navigator.share) {
      navigator.share({ title: "ZeniaOne Response", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setCopiedIndex(-1);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }

  function exportTestReport() {
    const report = {
      workspace: getActiveCompany()?.name,
      agent: selectedAgent?.name,
      generatedAt: new Date().toISOString(),
      runs: testRuns,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "zeniaone-playground-report.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleVoiceMessagesUpdate(
    userText: string,
    aiText: string,
    sources?: any[],
    isInterimUser: boolean = false,
  ) {
    const trimmedUser = userText.trim();
    const trimmedAi = aiText.trim();
    const normalize = (value: string) => value.toLowerCase().replace(/[\s\u200b]+/g, " ").replace(/[?!.,।]+$/g, "").trim();
    setMessages((prev) => {
      const updated = [...prev];
      if (trimmedUser) {
        const incoming = normalize(trimmedUser);
        const last = updated[updated.length - 1] as any;
        if (last?.role === "user" && normalize(String(last.content || "")) === incoming) {
          last.content = trimmedUser;
          last.isLiveVoice = isInterimUser;
        } else if (last?.role === "user" && last.isLiveVoice) {
          last.content = trimmedUser;
          last.isLiveVoice = isInterimUser;
        } else {
          updated.push({ role: "user", content: trimmedUser, isLiveVoice: isInterimUser } as any);
        }
      }
      if (trimmedAi) {
        const last = updated[updated.length - 1] as any;
        if (last?.role === "assistant" && last.isLiveVoice) {
          last.content = trimmedAi;
          last.sources = sources || last.sources || [];
        } else {
          updated.push({ role: "assistant", content: trimmedAi, isLiveVoice: true, sources: sources || [] } as any);
        }
      }
      return updated;
    });
  }

  function handleVoiceConvIdChange(newId: string) {
    setActiveConvId(newId);
    activeConvIdRef.current = newId;
  }

  const getActiveCompany = () =>
    companies.find((c) => c.id === selectedCompany);

  if (isInit)
    return (
      <div className="flex h-[calc(100vh-4rem)] -m-4 flex-col bg-[#FAF9F8] sm:-m-6 lg:-m-8">
        <div className="h-16 border-b border-[#E3E3DF] bg-white" />
        <div className="mx-auto flex w-full max-w-[800px] flex-1 flex-col justify-end px-4 pb-32 sm:px-6">
          <div className="mb-5 h-4 w-36 animate-pulse rounded bg-slate-200" />
          <div className="h-24 w-[72%] animate-pulse rounded-[24px] rounded-bl-sm border border-slate-200 bg-white" />
          <div className="mt-7 ml-auto h-16 w-[48%] animate-pulse rounded-[22px] rounded-br-sm bg-slate-200" />
        </div>
      </div>
    );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 sm:-m-6 lg:-m-8 bg-[#FAF9F8]">
      {/* Admin Testing Header */}
      <div className="h-16 border-b border-[#E3E3DF] bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-sage-100 rounded-lg flex items-center justify-center">
            <Zap className="h-5 w-5 text-sage-600" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">
              AI Playground
            </h1>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
              {getActiveCompany()?.name || "Select Workspace"}
            </p>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-2 hidden sm:block" />

          {/* Custom Company Dropdown */}
          <div className="relative" ref={companyDropdownRef}>
            <div
              className="flex h-10 min-w-[190px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50 cursor-pointer"
              onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <CompanyAvatar company={getActiveCompany()} small />
                <span className="truncate text-sm font-semibold text-slate-700">
                  {getActiveCompany()?.name || "Select Company"}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </div>

            {isCompanyDropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 max-h-[360px] w-full min-w-[260px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                {companies.map((c) => (
                  <div
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${selectedCompany === c.id ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-700 hover:bg-slate-50"}`}
                    onClick={() => {
                      setSelectedCompany(c.id);
                      setIsCompanyDropdownOpen(false);
                    }}
                  >
                    <CompanyAvatar company={c} small />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {selectedCompany === c.id && (
                      <Check className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Agent Dropdown */}
          <div className="relative" ref={agentDropdownRef}>
            <div
              className={`flex h-10 min-w-[190px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition ${!selectedCompany || agents.length === 0 ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/50"}`}
              onClick={() =>
                !selectedCompany || agents.length === 0
                  ? null
                  : setIsAgentDropdownOpen(!isAgentDropdownOpen)
              }
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Bot className="h-4 w-4 shrink-0 text-emerald-700" />
                <span className="truncate text-sm font-semibold text-slate-700">
                  {selectedAgent?.name || "Select Agent"}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </div>

            {isAgentDropdownOpen && agents.length > 0 && (
              <div className="absolute left-0 top-full z-50 mt-2 max-h-[360px] w-full min-w-[260px] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                {agents.map((a) => (
                  <div
                    key={a.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${selectedAgent?.id === a.id ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-700 hover:bg-slate-50"}`}
                    onClick={() => {
                      setSelectedAgent(a);
                      setIsAgentDropdownOpen(false);
                    }}
                  >
                    <Bot
                      className={`h-3.5 w-3.5 ${selectedAgent?.id === a.id ? "text-sage-500" : "text-slate-400"}`}
                    />
                    <span className="truncate">{a.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2 ml-2">
            <span className="flex items-center gap-1 text-[11px] text-[#68706C] font-medium leading-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Online
            </span>
            {selectedAgent?.knowledge_base_id ? (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-[#D1DFD9] mx-1"></span>
                <span className="flex items-center text-[11px] text-[#5F786D] font-medium leading-none">
                  <Database className="h-3 w-3 mr-1" /> Knowledge Connected
                </span>
              </>
            ) : (
              <>
                <span className="w-0.5 h-0.5 rounded-full bg-[#D1DFD9] mx-1"></span>
                <span className="flex items-center text-[11px] text-slate-400 font-medium leading-none">
                  <Database className="h-3 w-3 mr-1" /> No Knowledge Base
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedAgent && selectedCompany && (
            <Button
              size="sm"
              onClick={() => setVoiceModeActive(true)}
              className="bg-[#3E5448] hover:bg-[#2A3D34] text-white shadow-sm transition-colors h-8 px-3 rounded-full flex items-center gap-1.5"
              title="Start a live voice conversation"
              aria-label="Start voice chat with AI"
            >
              <Mic className="h-3.5 w-3.5" />
              <span className="text-[13px] font-medium">Voice Chat AI</span>
            </Button>
          )}

          {testRuns.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={exportTestReport}
              className="hidden text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 sm:inline-flex h-8 rounded-full"
            >
              <FileText className="mr-1.5 h-4 w-4" /> Report
            </Button>
          )}

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMessages([]);
                setActiveConvId(null);
                activeConvIdRef.current = null;
                if (selectedCompany && selectedAgent?.id) {
                  try {
                    localStorage.removeItem(
                      `zeniaone_playground_session_${selectedCompany}_${selectedAgent.id}`,
                    );
                  } catch {}
                }
              }}
              className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-8 rounded-full"
            >
              <Trash2 className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline text-xs font-medium">
                Clear / New Session
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* ── Chat Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="max-w-[760px] mx-auto w-full px-4 sm:px-5 pt-3 pb-2 flex flex-col min-h-full">
          {/* Top spacer: when messages are present, docks conversation right above the chat board box */}
          {messages.length > 0 && <div className="flex-1 min-h-[12px]" />}
          {messages.length === 0 && selectedAgent && !voiceModeActive && (
            <div className="flex flex-col items-center justify-center my-auto py-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="h-16 w-16 bg-[#E8F0EC] rounded-[24px] flex items-center justify-center mb-6 shadow-sm border border-[#D1DFD9]">
                <Bot className="h-8 w-8 text-[#5F786D]" />
              </div>
              <h2 className="text-2xl font-bold text-[#1C2421] mb-2 text-center tracking-tight">
                {selectedAgent.name}
              </h2>
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="h-4 w-4 text-[#68706C]" />
                <span className="text-[#68706C] font-medium">
                  {getActiveCompany()?.name}
                </span>
              </div>
              <p className="text-[#68706C] text-[15px] mb-8 text-center max-w-md">
                Test this agent against the selected company's knowledge.
              </p>
              <div className="w-full max-w-2xl rounded-2xl border border-[#D1DFD9] bg-white/80 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5F786D]">
                    Quick test suite
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {testRuns.length} saved runs
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    "What can you help me with?",
                    "What documents are available?",
                    "Summarize the main platform features.",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => executeSend(prompt, messages)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-xs font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.length === 0 && !selectedAgent && (
            <div className="flex flex-col items-center justify-center my-auto py-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="h-16 w-16 bg-slate-100 rounded-[24px] flex items-center justify-center mb-6 border border-slate-200">
                <Bot className="h-8 w-8 text-slate-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-700 mb-2 text-center">
                No Agent Selected
              </h2>
              <p className="text-slate-500 text-sm text-center max-w-md">
                Please select a Company and an Agent from the top menu to begin
                testing.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex w-full mb-2 sm:mb-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`flex flex-col max-w-[85%] sm:max-w-[78%] ${m.role === "user" ? "items-end" : "items-start"}`}
              >
                {/* User Message */}
                {m.role === "user" ? (
                  editingIndex === i ? (
                    <div className="flex w-full min-w-[280px] flex-col gap-2">
                      <textarea
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        className="w-full rounded-xl bg-white border border-[#E3E3DF] p-2.5 text-[13.5px] text-[#1C2421] focus:ring-2 focus:ring-sage-500 focus:outline-none resize-none"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingIndex(null)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleEditSend(i)}
                          className="bg-sage-600 hover:bg-sage-700 text-white h-7 text-xs"
                        >
                          Save & Send
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#5F786D] text-white px-4 py-2 rounded-[16px] rounded-br-xs shadow-xs text-[13.5px] leading-relaxed">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ node, ...props }) => (
                            <a
                              {...props}
                              className="underline underline-offset-2 hover:text-white/80 transition-colors"
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          ),
                          p: ({ node, ...props }) => (
                            <p {...props} className="mb-1.5 last:mb-0" />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul {...props} className="list-disc ml-3.5 mb-1.5 space-y-0.5" />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol {...props} className="list-decimal ml-3.5 mb-1.5 space-y-0.5" />
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )
                ) : (
                  /* Assistant Message */
                  <div
                    className={`bg-white border ${m.isError ? "border-red-200" : "border-[#E3E3DF]"} px-4 py-2.5 rounded-[16px] rounded-bl-xs shadow-xs text-[13.5px] leading-relaxed text-[#1C2421] relative`}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ node, ...props }) => (
                          <a
                            {...props}
                            className="text-[#5F786D] hover:text-[#43584F] underline underline-offset-2 transition-colors font-medium"
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p {...props} className="mb-2 last:mb-0" />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul
                            {...props}
                            className="list-disc ml-4 mb-2 space-y-0.5"
                          />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol
                            {...props}
                            className="list-decimal ml-4 mb-2 space-y-0.5"
                          />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong
                            {...props}
                            className="font-semibold text-[#1C2421]"
                          />
                        ),
                        code: ({ node, ...props }) => (
                          <code
                            {...props}
                            className="bg-[#F7F6F3] text-[#eb5757] px-1 py-0.5 rounded text-[12px] font-mono"
                          />
                        ),
                        pre: ({ node, ...props }) => (
                          <pre
                            {...props}
                            className="bg-[#1C2421] text-[#FAF9F8] p-3 rounded-lg overflow-x-auto text-[12px] font-mono mb-2 shadow-inner"
                          />
                        ),
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>

                    {/* Assistant Message Smart Footer */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                      {/* Left: Metadata Badges (Response Latency & Collapsible Knowledge Sources) */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!m.isError && m.latencyMs !== undefined && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            <Timer className="h-3 w-3 text-sage-600" />
                            {m.latencyMs < 1000
                              ? `${m.latencyMs}ms`
                              : `${(m.latencyMs / 1000).toFixed(1)}s`}{" "}
                            response
                          </span>
                        )}

                        {!!m.sources?.length && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSources((prev) => ({
                                ...prev,
                                [i]: !prev[i],
                              }))
                            }
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-all cursor-pointer ${
                              expandedSources[i]
                                ? "border-emerald-300 bg-emerald-100/90 text-emerald-900 shadow-xs"
                                : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 hover:border-emerald-300"
                            }`}
                            title={
                              expandedSources[i]
                                ? "Hide knowledge sources"
                                : "View referenced knowledge sources"
                            }
                          >
                            <Database className="h-3 w-3 text-emerald-600" />
                            <span>
                              {m.sources.length} source{m.sources.length === 1 ? "" : "s"}
                            </span>
                            <ChevronDown
                              className={`h-3 w-3 text-emerald-600 transition-transform duration-200 ${
                                expandedSources[i] ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      {/* Right: Message Actions (Copy, Like, Dislike, Share) */}
                      <div className="flex items-center gap-0.5 sm:gap-1 text-slate-400">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(m.content);
                            setCopiedIndex(i);
                            setTimeout(() => setCopiedIndex(null), 2000);
                          }}
                          className="hover:text-slate-700 transition-colors flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded hover:bg-slate-100/80"
                          title="Copy response"
                        >
                          {copiedIndex === i ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-[10px] text-emerald-600 font-semibold">
                                Copied
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline text-[10px]">Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() =>
                            setFeedbackState((prev) => ({
                              ...prev,
                              [i]: "like",
                            }))
                          }
                          className={`transition-colors flex items-center gap-1 text-[11px] font-medium p-1 rounded hover:bg-slate-100/80 ${
                            feedbackState[i] === "like"
                              ? "text-sage-600"
                              : "hover:text-slate-700"
                          }`}
                          title="Helpful response"
                        >
                          <ThumbsUp
                            className={`h-3.5 w-3.5 ${
                              feedbackState[i] === "like" ? "fill-current" : ""
                            }`}
                          />
                        </button>

                        <button
                          onClick={() =>
                            setFeedbackState((prev) => ({
                              ...prev,
                              [i]: "dislike",
                            }))
                          }
                          className={`transition-colors flex items-center gap-1 text-[11px] font-medium p-1 rounded hover:bg-slate-100/80 ${
                            feedbackState[i] === "dislike"
                              ? "text-red-500"
                              : "hover:text-slate-700"
                          }`}
                          title="Not helpful response"
                        >
                          <ThumbsDown
                            className={`h-3.5 w-3.5 ${
                              feedbackState[i] === "dislike" ? "fill-current" : ""
                            }`}
                          />
                        </button>

                        <button
                          onClick={() => handleShare(m.content)}
                          className="hover:text-slate-700 transition-colors flex items-center gap-1 text-[11px] font-medium p-1 rounded hover:bg-slate-100/80"
                          title="Share response"
                        >
                          <Share className="h-3.5 w-3.5" />
                        </button>

                        {m.isError && i === messages.length - 1 && (
                          <button
                            onClick={() => {
                              const lastUserMsg = messages[i - 1];
                              if (lastUserMsg && lastUserMsg.role === "user") {
                                setMessages((prev) => prev.slice(0, i - 1));
                                setInput(lastUserMsg.content);
                              }
                            }}
                            className="text-sage-600 hover:text-sage-700 text-[10px] font-semibold ml-1 px-1.5 py-0.5 rounded border border-sage-200 bg-sage-50"
                            title="Retry response"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Smart Knowledge Sources Drawer */}
                    {expandedSources[i] && m.sources && m.sources.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between mb-1.5 px-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Database className="h-3 w-3 text-emerald-600" />
                            Referenced Knowledge Sources ({m.sources.length})
                          </span>
                          <span className="text-[10px] text-slate-400">Match score</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {m.sources.map((src, sIdx) => (
                            <div
                              key={sIdx}
                              className="group flex items-center justify-between gap-2 bg-[#FBFBF9] hover:bg-[#F0F4F2] border border-[#E3E8E5] px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-700 transition-colors"
                              title={src.label}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <FileText className="h-3.5 w-3.5 text-sage-600 shrink-0 group-hover:text-emerald-700" />
                                <span className="truncate">{src.label}</span>
                              </div>
                              <span className="shrink-0 text-[10px] font-mono font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                                {Math.round(src.score * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* User Message Action Toolbar */}
                {m.role === "user" && editingIndex !== i && (
                  <div className="mt-1 flex items-center justify-end gap-2 mr-1">
                    <button
                      onClick={() => {
                        setEditInput(m.content);
                        setEditingIndex(i);
                      }}
                      className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 text-[10px] font-medium p-0.5"
                      title="Edit message"
                    >
                      <Edit2 className="h-3 w-3" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(m.content);
                        setCopiedIndex(i);
                        setTimeout(() => setCopiedIndex(null), 2000);
                      }}
                      className="text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 text-[10px] font-medium p-0.5"
                      title="Copy message"
                    >
                      {copiedIndex === i ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedIndex === i ? "Copied" : "Copy"}</span>
                    </button>
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
                  {selectedAgent?.name || "Agent"} is typing
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
      {voiceModeActive && selectedAgent && selectedCompany && (
        <VoiceModeDock
          agent={selectedAgent}
          companyId={selectedCompany}
          activeConvId={activeConvId}
          onConvIdChange={handleVoiceConvIdChange}
          onEnd={() => setVoiceModeActive(false)}
          onMessagesUpdate={handleVoiceMessagesUpdate}
          messages={messages}
        />
      )}

      {/* ── Modern Composer (hidden while voice is active) ──────────────── */}
      {!voiceModeActive && selectedAgent && (
        <div className="shrink-0 bg-gradient-to-t from-[#FAF9F8] via-[#FAF9F8] to-transparent pt-1 pb-2.5 px-4 sm:px-5 z-20">
          <div className="max-w-[760px] mx-auto w-full relative">
            <div className="relative bg-[#FFFFFF] rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-[#E3E3DF] focus-within:border-sage-400 focus-within:shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-all flex flex-col mx-auto outline-none">
              {attachedFile && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2 pb-0.5">
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-[#E3E3DF] rounded-[8px] px-2 py-0.5 text-[11px] text-[#1C2421] shadow-xs max-w-[200px]">
                    <FileText className="h-3 w-3 text-[#68706C] shrink-0" />
                    <span className="truncate">{attachedFile.name}</span>
                    <button
                      onClick={() => setAttachedFile(null)}
                      className="text-[#68706C] hover:text-[#1C2421] transition-colors ml-0.5 p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center p-1 sm:p-1.5 relative">
                <div className="flex items-center gap-0.5 px-0.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".txt,.md,.csv"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="ghost"
                    size="icon"
                    className={`h-[32px] w-[32px] rounded-full transition-colors ${
                      attachedFile
                        ? "text-[#5F786D] bg-[#E8F0EC]"
                        : "text-[#68706C] hover:text-[#43584F] hover:bg-[#F7F6F3]"
                    }`}
                    title="Attach Context Document (Temporary)"
                  >
                    <Paperclip className="h-[15px] w-[15px]" />
                  </Button>

                  <Button
                    onClick={() => setVoiceModeActive(true)}
                    variant="ghost"
                    size="icon"
                    className="h-[32px] w-[32px] rounded-full text-[#68706C] hover:text-[#43584F] hover:bg-[#F7F6F3]"
                    title="Start Voice Chat AI"
                  >
                    <Mic className="h-[15px] w-[15px]" />
                  </Button>
                </div>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Test ${selectedAgent.name}...`}
                  rows={1}
                  className="flex-1 bg-transparent resize-none border-0 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none text-[13.5px] py-1.5 px-2.5 min-h-[34px] max-h-[140px] disabled:opacity-50 text-[#1C2421] placeholder-[#8A9490]"
                  style={{
                    height: "auto",
                    overflowY: input.split("\n").length > 5 ? "auto" : "hidden",
                  }}
                />

                <div className="px-0.5">
                  <Button
                    onClick={handleSend}
                    disabled={(!input.trim() && !attachedFile) || sending}
                    size="icon"
                    className="h-[32px] w-[32px] shrink-0 rounded-full bg-[#5F786D] hover:bg-[#43584F] disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-xs flex items-center justify-center disabled:opacity-100"
                  >
                    {sending ? (
                      <Loader2 className="h-[15px] w-[15px] animate-spin text-white" />
                    ) : (
                      <Send className="h-[14px] w-[14px] text-white" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-1.5 flex justify-between items-center px-1 text-[11px] text-[#8A9490]">
              <span className="flex items-center gap-1 font-medium">
                <ShieldCheck className="h-3 w-3 text-sage-600" />
                Testing in {getActiveCompany()?.name}
              </span>
              <span className="hidden sm:inline-block">
                Return to send
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
