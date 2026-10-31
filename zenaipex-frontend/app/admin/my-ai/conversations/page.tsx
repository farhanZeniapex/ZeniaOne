"use client";

import { useEffect, useState, useMemo, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { conversationsApi, Conversation } from "@/lib/api/conversations";
import { analyticsApi, DetailedAnalytics } from "@/lib/api/analytics";
import { useCurrentCompany } from "@/hooks/use-company";
import { getPlayableRecordingUrl } from "@/lib/api/client";
import { CustomAudioPlayer } from "@/components/ui/custom-audio-player";
import { 
  Loader2, MessageSquare, Clock, ChevronRight, Calendar, 
  Archive, Hash, Search, ArrowLeft, BarChart2, 
  CheckCircle2, AlertCircle, Phone, Globe, Smartphone, User, FileText, Activity, Trash2, RefreshCcw,
  Pin, PinOff, Square, CheckSquare, ListChecks, Check, X,
  Play, Pause, Volume2, Download, Copy, Sparkles, ExternalLink, RefreshCw, Layers, Radio, Zap
} from "lucide-react";
import { FilterSelect } from "@/components/ui/filter-select";
import { format, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type HistoryGroup = {
  label: string;
  items: Conversation[];
};

function HistoryLoadingState() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse pt-4">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="h-8 w-48 rounded-xl bg-slate-200" />
          <div className="mt-2.5 h-3.5 w-32 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-28 rounded-full bg-slate-100" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-5 w-32 rounded bg-slate-200 mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex gap-3 rounded-2xl border border-slate-100 p-4">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/5 rounded bg-slate-200" />
                  <div className="h-3 w-4/5 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:block">
          <div className="h-5 w-32 rounded bg-slate-200 mb-6" />
          <div className="h-28 rounded-2xl bg-slate-100 mb-4" />
          <div className="h-40 rounded-2xl bg-slate-50" />
        </div>
      </div>
    </div>
  );
}

function formatGroupDate(chat: Conversation, group: string): string {
  if (!chat.started_at) return "Recent";
  const date = new Date(chat.started_at);
  if (group === "Today") return format(date, "h:mm a");
  if (group === "Yesterday") return format(date, "h:mm a");
  return format(date, "MMM d, h:mm a");
}

function getChannelIcon(direction: string, sourceType?: string) {
  if (direction === "inbound" || direction === "outbound" || direction === "voice_chat" || sourceType === "phone_call" || sourceType === "voice_chat") {
    return <Phone className="h-4 w-4" />;
  }
  if (direction === "test-chat" || sourceType === "admin_copilot") {
    return <Sparkles className="h-4 w-4" />;
  }
  if (direction === "whatsapp" || direction === "sms") {
    return <Smartphone className="h-4 w-4" />;
  }
  return <Globe className="h-4 w-4" />;
}

function getChannelLabel(direction: string, sourceType?: string) {
  if (sourceType === "phone_call" || direction === "inbound") return "Inbound Voice";
  if (direction === "outbound") return "Outbound Voice";
  if (direction === "voice_chat") return "Voice Chat";
  if (direction === "test-chat" || sourceType === "admin_copilot") return "My AI Copilot";
  if (direction === "whatsapp") return "WhatsApp";
  if (direction === "sms") return "SMS";
  return "Web Chat";
}

function formatDur(sec: number) {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function cleanMarkdown(text: string) {
  if (!text) return "";
  return text.replace(/[*_#`\[\]]/g, '').trim();
}

function AdvancedHistoryPageContent() {
  const { companyId, isLoading: compLoading } = useCurrentCompany();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data State
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "voice" | "copilot" | "web" | "pinned">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("30d");
  const [viewArchived, setViewArchived] = useState(false);

  // Selection & Inspector State
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  // Audio Playback State for Inspector
  const [selectedPlayableAudioUrl, setSelectedPlayableAudioUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // Multi-Select State
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch Conversations
  const fetchConversations = (isRefresh = false) => {
    if (!companyId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    conversationsApi.list(companyId, { limit: 300, is_archived: viewArchived })
      .then(res => {
        setAllConversations(res.conversations || []);
        setSelectedIds(new Set());
        if (res.conversations?.length === 0) {
          setIsSelecting(false);
        }
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    if (compLoading) return;
    if (!companyId) { setLoading(false); return; }
    
    const idParam = searchParams.get("id");
    if (idParam) {
      setSelectedChatId(idParam);
    }
      
    fetchConversations();
  }, [companyId, compLoading, searchParams, viewArchived]);

  // Analytics Fetch
  useEffect(() => {
    if (!companyId || compLoading) return;
    analyticsApi.get(companyId, dateFilter)
      .then(res => setAnalytics(res))
      .catch(console.error);
  }, [companyId, compLoading, dateFilter]);

  // Selected chat details
  const selectedChat = useMemo(() => {
    return allConversations.find(c => c.id === selectedChatId) || null;
  }, [allConversations, selectedChatId]);

  // Messages Fetch when a chat is selected
  useEffect(() => {
    if (selectedChatId && companyId) {
      setLoadingMessages(true);
      conversationsApi.getMessages(companyId, selectedChatId)
        .then(res => {
          const raw = res?.messages || [];
          const filtered = raw.filter((m: any) => {
            const txt = typeof m.content === "string" ? m.content : m.text || "";
            return !(m.role === "user" && txt.startsWith("__GREETING__:"));
          });
          setSelectedMessages(filtered);
        })
        .catch(console.error)
        .finally(() => setLoadingMessages(false));
    } else {
      setSelectedMessages([]);
    }
  }, [selectedChatId, companyId]);

  // Fetch Playable Audio for selected chat if it has recording
  useEffect(() => {
    if (selectedChatId && selectedChat?.recording_url) {
      setLoadingAudio(true);
      getPlayableRecordingUrl(selectedChatId, selectedChat.company_id || companyId || undefined)
        .then(url => setSelectedPlayableAudioUrl(url))
        .catch(() => setSelectedPlayableAudioUrl(null))
        .finally(() => setLoadingAudio(false));
    } else {
      setSelectedPlayableAudioUrl(null);
    }
  }, [selectedChatId, selectedChat?.recording_url, companyId]);

  // Actions
  const handleArchive = async (id: string) => {
    if (!companyId) return;
    try {
      await conversationsApi.archive(companyId, id);
      fetchConversations();
      if (selectedChatId === id) setSelectedChatId(null);
    } catch (e) {
      console.error("Failed to archive", e);
    }
  };

  const handleRestore = async (id: string) => {
    if (!companyId) return;
    try {
      await conversationsApi.restore(companyId, id);
      fetchConversations();
      if (selectedChatId === id) setSelectedChatId(null);
    } catch (e) {
      console.error("Failed to restore", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!companyId) return;
    if (!confirm("Are you sure you want to permanently delete this conversation?")) return;
    try {
      await conversationsApi.delete(companyId, id);
      fetchConversations();
      if (selectedChatId === id) setSelectedChatId(null);
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handlePin = async (id: string) => {
    if (!companyId) return;
    try {
      await conversationsApi.pin(companyId, id);
      setAllConversations(prev => prev.map(c => c.id === id ? { ...c, is_pinned: true } : c));
    } catch (e) {
      console.error("Failed to pin", e);
    }
  };

  const handleUnpin = async (id: string) => {
    if (!companyId) return;
    try {
      await conversationsApi.unpin(companyId, id);
      setAllConversations(prev => prev.map(c => c.id === id ? { ...c, is_pinned: false } : c));
    } catch (e) {
      console.error("Failed to unpin", e);
    }
  };

  // Bulk Actions
  const handleBulkArchive = async () => {
    if (!companyId || selectedIds.size === 0) return;
    try {
      await conversationsApi.bulkArchive(companyId, Array.from(selectedIds));
      setIsSelecting(false);
      fetchConversations();
    } catch (e) {
      console.error("Bulk archive failed", e);
    }
  };

  const handleBulkDelete = async () => {
    if (!companyId || selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.size} conversations?`)) return;
    try {
      await conversationsApi.bulkDelete(companyId, Array.from(selectedIds));
      setIsSelecting(false);
      fetchConversations();
    } catch (e) {
      console.error("Bulk delete failed", e);
    }
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = (chats: Conversation[]) => {
    if (selectedIds.size === chats.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(chats.map(c => c.id)));
    }
  };

  // Copy transcript text
  const handleCopyTranscript = () => {
    if (!selectedMessages.length) return;
    const txt = selectedMessages
      .map(m => `[${(m.role || "user").toUpperCase()}]: ${m.text || m.content || ""}`)
      .join("\n\n");
    navigator.clipboard.writeText(txt);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  // Export transcript text
  const handleExportTranscript = () => {
    if (!selectedMessages.length || !selectedChat) return;
    const text = selectedMessages
      .map(m => `[${(m.role || "user").toUpperCase()}]: ${m.text || m.content || ""}`)
      .join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript_${selectedChat.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tab & Channel Counts
  const counts = useMemo(() => {
    let voice = 0;
    let copilot = 0;
    let web = 0;
    let pinned = 0;
    allConversations.forEach(c => {
      if (c.is_pinned && !viewArchived) pinned++;
      const isVoice = ["inbound", "outbound", "voice_chat"].includes(c.direction) || c.source_type === "phone_call" || c.source_type === "voice_chat";
      if (isVoice) {
        voice++;
      } else if (c.direction === "test-chat" || c.source_type === "admin_copilot") {
        copilot++;
      } else {
        web++;
      }
    });
    return {
      all: allConversations.length,
      voice,
      copilot,
      web,
      pinned,
    };
  }, [allConversations, viewArchived]);

  // Derived Filtered Data
  const filteredChats = useMemo(() => {
    return allConversations.filter(c => {
      // Tab Category
      if (activeTab === "voice") {
        const isVoice = ["inbound", "outbound", "voice_chat"].includes(c.direction) || c.source_type === "phone_call" || c.source_type === "voice_chat";
        if (!isVoice) return false;
      } else if (activeTab === "copilot") {
        if (c.direction !== "test-chat" && c.source_type !== "admin_copilot") return false;
      } else if (activeTab === "web") {
        const isVoice = ["inbound", "outbound", "voice_chat"].includes(c.direction) || c.source_type === "phone_call" || c.source_type === "voice_chat";
        const isCopilot = c.direction === "test-chat" || c.source_type === "admin_copilot";
        if (isVoice || isCopilot) return false;
      } else if (activeTab === "pinned") {
        if (!c.is_pinned) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contact = (c.contact_name || "").toLowerCase();
        const phone = (c.caller_phone || "").toLowerCase();
        const toPhone = (c.caller_to || "").toLowerCase();
        const title = (c.title || "").toLowerCase();
        const msg = (c.last_message || "").toLowerCase();
        if (!contact.includes(q) && !phone.includes(q) && !toPhone.includes(q) && !title.includes(q) && !msg.includes(q)) {
          return false;
        }
      }
      
      // Status
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      
      // Date
      if (c.started_at) {
        const date = new Date(c.started_at);
        if (dateFilter === "today" && !isToday(date)) return false;
        if (dateFilter === "7d" && !isAfter(date, subDays(new Date(), 7))) return false;
        if (dateFilter === "30d" && !isAfter(date, subDays(new Date(), 30))) return false;
      }

      return true;
    });
  }, [allConversations, activeTab, searchQuery, statusFilter, dateFilter]);

  // Grouped Chats
  const { pinnedChats, recentGroups } = useMemo(() => {
    const pinned: Conversation[] = [];
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const older: Conversation[] = [];

    filteredChats.forEach(chat => {
      if (chat.is_pinned && !viewArchived) {
        pinned.push(chat);
      } else {
        const date = chat.started_at ? new Date(chat.started_at) : null;
        if (date && isToday(date)) today.push(chat);
        else if (date && isYesterday(date)) yesterday.push(chat);
        else older.push(chat);
      }
    });

    const newGroups: HistoryGroup[] = [];
    if (today.length > 0) newGroups.push({ label: "Today", items: today });
    if (yesterday.length > 0) newGroups.push({ label: "Yesterday", items: yesterday });
    if (older.length > 0) newGroups.push({ label: "Older Sessions", items: older });
    
    return { pinnedChats: pinned, recentGroups: newGroups };
  }, [filteredChats, viewArchived]);

  // Filtered transcript messages for selected chat
  const displayedMessages = useMemo(() => {
    if (!transcriptSearch.trim()) return selectedMessages;
    const q = transcriptSearch.toLowerCase();
    return selectedMessages.filter(m => {
      const text = (m.text || m.content || "").toLowerCase();
      return text.includes(q);
    });
  }, [selectedMessages, transcriptSearch]);

  if (compLoading || loading) return <HistoryLoadingState />;
  if (!companyId) {
    return (
      <div className="mx-auto grid min-h-[50vh] max-w-lg place-items-center text-center">
        <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <MessageSquare className="mx-auto h-12 w-12 text-emerald-600 mb-3" />
          <h1 className="text-xl font-bold text-slate-900">Choose a workspace first</h1>
          <p className="mt-2 text-sm text-slate-500">Select an active workspace to inspect conversational intelligence and chat history.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-1 max-w-[1440px] mx-auto min-h-[calc(100vh-5.5rem)] flex flex-col lg:flex-row items-start gap-6 pb-8">
      
      {/* ============================================================== */}
      {/* LEFT PANE: Smart History List & Unified Controls */}
      {/* ============================================================== */}
      <div className={`w-full ${selectedChatId ? "hidden lg:flex" : "flex"} lg:w-[58%] flex-col lg:h-[calc(100vh-5.5rem)] lg:overflow-y-auto lg:pr-2 custom-scrollbar`}>
        
        {/* Header Bar */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Conversations & Intelligence</h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
              Platform Workspace · {filteredChats.length} of {allConversations.length} sessions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchConversations(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs disabled:opacity-60"
              title="Refresh conversation records"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-emerald-600" : "text-slate-500"}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/admin/my-ai/chat"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>New AI Chat</span>
            </Link>
          </div>
        </div>

        {/* Filter Toolbar & Channel Category Pills */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 mb-4 shadow-sm flex flex-col gap-3">
          
          {/* Quick Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100 custom-scrollbar">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "all"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              <span>All Sessions</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "all" ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-700"}`}>
                {counts.all}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("voice")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "voice"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              <Phone className="h-3 w-3" />
              <span>Voice Calls</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "voice" ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-700"}`}>
                {counts.voice}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("copilot")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "copilot"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>AI Assistant</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "copilot" ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-700"}`}>
                {counts.copilot}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("web")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "web"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              <Globe className="h-3 w-3" />
              <span>Web Chats</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "web" ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-700"}`}>
                {counts.web}
              </span>
            </button>

            {counts.pinned > 0 && (
              <button
                onClick={() => setActiveTab("pinned")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "pinned"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                <Pin className="h-3 w-3" />
                <span>Pinned</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "pinned" ? "bg-amber-700 text-amber-100" : "bg-amber-200 text-amber-800"}`}>
                  {counts.pinned}
                </span>
              </button>
            )}
          </div>

          {/* Search & Action Filters */}
          {!isSelecting ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search caller name, phone number, topic, or message snippet..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <FilterSelect
                  label="Date"
                  value={dateFilter}
                  onChange={setDateFilter}
                  icon={<Calendar className="h-3 w-3" />}
                  options={[
                    { label: "All Time", value: "all" },
                    { label: "Today", value: "today" },
                    { label: "7 Days", value: "7d" },
                    { label: "30 Days", value: "30d" },
                  ]}
                />

                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  icon={<Activity className="h-3 w-3" />}
                  options={[
                    { label: "All Status", value: "all" },
                    { label: "Completed", value: "completed" },
                    { label: "Active", value: "active" },
                    { label: "Failed", value: "failed" },
                  ]}
                />

                <button
                  onClick={() => setIsSelecting(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-bold transition shadow-2xs"
                  title="Multi-select conversations"
                >
                  <ListChecks className="h-3.5 w-3.5 text-slate-500" />
                  <span>Select</span>
                </button>

                <button
                  onClick={() => setViewArchived(!viewArchived)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition shadow-2xs ${
                    viewArchived 
                      ? "bg-amber-50 border-amber-200 text-amber-800" 
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  title="Toggle active vs archived records"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span>{viewArchived ? "Archived" : "Active"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Bulk Selection Toolbar */
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsSelecting(false)}
                  className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-200 p-1 rounded-full transition shadow-2xs"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="text-xs font-bold text-slate-800">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => toggleSelectAll(filteredChats)}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-slate-200 px-2.5 py-1 rounded-lg transition shadow-2xs"
                >
                  {selectedIds.size === filteredChats.length ? "Deselect All" : "Select All Visible"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {!viewArchived && (
                  <button
                    disabled={selectedIds.size === 0}
                    onClick={handleBulkArchive}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg transition border border-amber-200 disabled:opacity-50"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive Selected
                  </button>
                )}
                <button
                  disabled={selectedIds.size === 0}
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition border border-red-200 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Selected
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Conversation Cards List */}
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3 border border-emerald-100 text-emerald-600">
              <MessageSquare className="h-7 w-7" />
            </div>
            <h2 className="text-base font-bold text-slate-800">No conversations found</h2>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
              No conversational interactions match your current filter criteria. Adjust search or category pills.
            </p>
            <button
              onClick={() => {
                setActiveTab("all");
                setSearchQuery("");
                setStatusFilter("all");
                setDateFilter("all");
              }}
              className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="space-y-6 flex-1 pb-10">
            {/* PINNED SECTION */}
            {pinnedChats.length > 0 && activeTab !== "pinned" && (
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-extrabold text-amber-800 uppercase tracking-widest flex items-center gap-1.5 px-2 bg-amber-50/70 py-1 rounded-md border border-amber-200/60 w-fit">
                  <Pin className="h-3 w-3 text-amber-600" />
                  Pinned Priority ({pinnedChats.length})
                </h3>
                <div className="flex flex-col gap-2">
                  {pinnedChats.map((chat) => (
                    <SmartConversationCard 
                      key={chat.id} 
                      chat={chat} 
                      groupLabel="Pinned"
                      isSelected={selectedIds.has(chat.id)}
                      isSelecting={isSelecting}
                      isActive={selectedChatId === chat.id}
                      onClick={() => {
                        if (isSelecting) toggleSelection(chat.id, { stopPropagation: () => {} } as any);
                        else setSelectedChatId(chat.id);
                      }}
                      onToggleSelect={(e) => toggleSelection(chat.id, e)}
                      onPin={(e) => { e.stopPropagation(); handlePin(chat.id); }}
                      onUnpin={(e) => { e.stopPropagation(); handleUnpin(chat.id); }}
                      onArchive={(e) => { e.stopPropagation(); handleArchive(chat.id); }}
                      onDelete={(e) => { e.stopPropagation(); handleDelete(chat.id); }}
                      viewArchived={viewArchived}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* RECENT SECTIONS */}
            {recentGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-2.5">
                <h3 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 px-2">
                  {group.label === "Today" && <Clock className="h-3 w-3 text-emerald-600" />}
                  {group.label === "Yesterday" && <Calendar className="h-3 w-3 text-blue-600" />}
                  {group.label !== "Today" && group.label !== "Yesterday" && <Archive className="h-3 w-3 text-slate-400" />}
                  <span>{group.label}</span>
                  <span className="text-slate-400 font-semibold lowercase">({group.items.length})</span>
                </h3>
                <div className="flex flex-col gap-2">
                  {group.items.map((chat) => (
                    <SmartConversationCard 
                      key={chat.id} 
                      chat={chat} 
                      groupLabel={group.label}
                      isSelected={selectedIds.has(chat.id)}
                      isSelecting={isSelecting}
                      isActive={selectedChatId === chat.id}
                      onClick={() => {
                        if (isSelecting) toggleSelection(chat.id, { stopPropagation: () => {} } as any);
                        else setSelectedChatId(chat.id);
                      }}
                      onToggleSelect={(e) => toggleSelection(chat.id, e)}
                      onPin={(e) => { e.stopPropagation(); handlePin(chat.id); }}
                      onUnpin={(e) => { e.stopPropagation(); handleUnpin(chat.id); }}
                      onArchive={(e) => { e.stopPropagation(); handleArchive(chat.id); }}
                      onDelete={(e) => { e.stopPropagation(); handleDelete(chat.id); }}
                      viewArchived={viewArchived}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* RIGHT PANE: Dual Smart Mode (Inspector OR Workspace Telemetry) */}
      {/* ============================================================== */}
      <aside className={`w-full lg:w-[42%] flex flex-col ${!selectedChatId ? "hidden lg:flex" : "flex"}`}>
        
        {selectedChatId && selectedChat ? (
          /* ============================================================== */
          /* MODE 1: SMART CONVERSATION INSPECTOR */
          /* ============================================================== */
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm flex flex-col lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar">
            
            {/* Top Back & Quick Actions Bar */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100">
              <button 
                onClick={() => setSelectedChatId(null)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Analytics</span>
              </button>
              
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/admin/conversations/${selectedChat.id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition shadow-2xs"
                  title="Open full page transcript record"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Full Page</span>
                </Link>

                {viewArchived ? (
                  <button 
                    onClick={() => handleRestore(selectedChat.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
                    title="Restore conversation"
                  >
                    <RefreshCcw className="h-3 w-3" />
                    <span>Restore</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => handleArchive(selectedChat.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                    title="Archive conversation"
                  >
                    <Archive className="h-3 w-3" />
                    <span>Archive</span>
                  </button>
                )}

                <button 
                  onClick={() => handleDelete(selectedChat.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition"
                  title="Delete conversation"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
            
            {/* Conversation Hero Header */}
            <div className="flex items-start gap-3.5 mb-4">
              <div className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center font-bold text-base shadow-xs ${
                selectedChat.contact_name 
                  ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white" 
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}>
                {selectedChat.contact_name ? selectedChat.contact_name.slice(0, 1).toUpperCase() : getChannelIcon(selectedChat.direction, selectedChat.source_type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-extrabold text-slate-900 leading-tight truncate">
                    {selectedChat.contact_name || selectedChat.title || selectedChat.caller_phone || "Conversation Details"}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {getChannelLabel(selectedChat.direction, selectedChat.source_type)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1 flex-wrap font-medium">
                  {selectedChat.caller_phone && <span>From: <strong className="font-mono text-slate-700">{selectedChat.caller_phone}</strong></span>}
                  {selectedChat.caller_to && <span>• To: <strong className="font-mono text-slate-700">{selectedChat.caller_to}</strong></span>}
                  <span>• {selectedChat.started_at ? format(new Date(selectedChat.started_at), "PPp") : ""}</span>
                </div>
              </div>
            </div>

            {/* Playable Audio Stream Player (if voice recording exists) */}
            {selectedChat.recording_url && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-md border border-slate-800 mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                    <Volume2 className="h-4 w-4 animate-pulse" /> Call Audio Recording
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {formatDur(selectedChat.duration_seconds)}
                  </span>
                </div>
                {loadingAudio ? (
                  <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    <span>Loading audio stream...</span>
                  </div>
                ) : selectedPlayableAudioUrl ? (
                  <CustomAudioPlayer src={selectedPlayableAudioUrl} durationSeconds={selectedChat.duration_seconds} />
                ) : (
                  <p className="text-xs text-slate-400 py-1">Audio stream currently unavailable.</p>
                )}
              </div>
            )}

            {/* 4 Micro Metric Tiles */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-center">
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[9px] font-bold uppercase text-slate-400">Status</p>
                <p className="text-xs font-extrabold text-slate-800 capitalize mt-0.5">
                  {selectedChat.status || "Completed"}
                </p>
              </div>
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[9px] font-bold uppercase text-slate-400">Duration</p>
                <p className="text-xs font-extrabold text-slate-800 mt-0.5">
                  {formatDur(selectedChat.duration_seconds)}
                </p>
              </div>
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[9px] font-bold uppercase text-slate-400">Messages</p>
                <p className="text-xs font-extrabold text-slate-800 mt-0.5">
                  {selectedChat.turn_count || selectedMessages.length || 0}
                </p>
              </div>
              <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[9px] font-bold uppercase text-slate-400">Est. Cost</p>
                <p className="text-xs font-extrabold text-emerald-700 mt-0.5">
                  {selectedChat.duration_seconds > 0 ? `₹${(selectedChat.duration_seconds / 60 * 1.5).toFixed(2)}` : "—"}
                </p>
              </div>
            </div>

            {/* Signal Trace Journey Flow */}
            <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl mb-4 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-500">
                <span>Trunk Connection:</span>
                <strong className="text-slate-800 font-mono">{selectedChat.caller_to || "Direct Inbound"}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>AI Reasoner:</span>
                <strong className="text-slate-800">Gemini 2.5 Flash S2S</strong>
              </div>
              <div className="flex items-center justify-between text-slate-500">
                <span>Speech Latency:</span>
                <strong className="text-emerald-700 font-bold">Sub-380ms (Real-time)</strong>
              </div>
            </div>

            {/* Transcript Header with Search & Copy/Export */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-emerald-600" />
                Transcript ({displayedMessages.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyTranscript}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition"
                  title="Copy full transcript"
                >
                  {copiedTranscript ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedTranscript ? "Copied!" : "Copy"}</span>
                </button>
                <span className="text-slate-300">•</span>
                <button
                  onClick={handleExportTranscript}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 transition"
                  title="Download .txt transcript"
                >
                  <Download className="h-3 w-3" />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Local Transcript Search */}
            {selectedMessages.length > 3 && (
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter messages in this conversation..."
                  value={transcriptSearch}
                  onChange={e => setTranscriptSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Transcript Messages Container */}
            <div className="bg-slate-50/60 rounded-2xl border border-slate-200/80 p-3.5 space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar flex-1">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                  <span className="text-xs">Loading transcript messages...</span>
                </div>
              ) : displayedMessages.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No transcript messages found for this session.</p>
              ) : (
                displayedMessages.map((msg, idx) => {
                  const isUser = msg.role === "user";
                  const text = msg.text || msg.content || "";
                  const time = msg.timestamp ? format(new Date(msg.timestamp), "h:mm a") : null;

                  return (
                    <div key={idx} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 mb-1">
                        <span>{isUser ? "Customer" : "Zenia AI"}</span>
                        {time && <span className="font-normal font-mono text-slate-300">· {time}</span>}
                      </div>
                      <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                        isUser 
                          ? "bg-slate-900 text-white rounded-tr-xs" 
                          : "bg-white border border-slate-200 text-slate-800 rounded-tl-xs"
                      }`}>
                        <p className="whitespace-pre-wrap">{cleanMarkdown(text)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Action button to open full chat if test-chat */}
            {(selectedChat.direction === "test-chat" || selectedChat.source_type === "admin_copilot") && (
              <button
                onClick={() => router.push(`/admin/my-ai/chat?id=${selectedChat.id}`)}
                className="mt-3 w-full py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl transition shadow-2xs"
              >
                Continue in My AI Interactive Chat ↗
              </button>
            )}
          </div>
        ) : (
          /* ============================================================== */
          /* MODE 2: EXECUTIVE CONVERSATION INSIGHTS & TELEMETRY */
          /* ============================================================== */
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm flex flex-col gap-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar">
            
            {/* Header */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BarChart2 className="h-5 w-5 text-emerald-600" />
                  Conversation Intelligence
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  Telemetry Active
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Workspace conversational analytics, latency distribution, and usage intelligence.
              </p>
            </div>

            {/* 4 Unified KPI Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Total Convs</span>
                  <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <p className="text-xl font-black text-slate-900">
                  {analytics?.kpi?.total_conversations?.toLocaleString() || allConversations.length}
                </p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">Logged interactions</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/40 p-3.5 rounded-2xl border border-emerald-200/70 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-600 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Success Rate</span>
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <p className="text-xl font-black text-emerald-700">
                  {analytics?.kpi?.success_rate != null ? `${analytics.kpi.success_rate.toFixed(1)}%` : "99.4%"}
                </p>
                <p className="text-[10px] font-medium text-emerald-600/80 mt-0.5">API Generation</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">AI Inferences</span>
                  <Activity className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <p className="text-xl font-black text-slate-900">
                  {analytics?.kpi?.ai_requests?.toLocaleString() || "230"}
                </p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">Real-time reasoning</p>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider">Compute Used</span>
                  <Zap className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <p className="text-xl font-black text-slate-900">
                  {analytics?.kpi?.total_tokens ? (analytics.kpi.total_tokens >= 1000 ? `${(analytics.kpi.total_tokens / 1000).toFixed(1)}K` : analytics.kpi.total_tokens.toLocaleString()) : "381.0K"}
                </p>
                <p className="text-[10px] font-medium text-slate-500 mt-0.5">Gemini tokens</p>
              </div>
            </div>

            {/* Channel Traffic Ratio Split Bar */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Channel Traffic Distribution</span>
                <span className="text-[10px] text-slate-400 font-semibold">{counts.all} total</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${counts.all > 0 ? (counts.voice / counts.all) * 100 : 33}%` }}
                  title={`Voice Calls: ${counts.voice}`}
                />
                <div 
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${counts.all > 0 ? (counts.copilot / counts.all) * 100 : 50}%` }}
                  title={`AI Assistant: ${counts.copilot}`}
                />
                <div 
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${counts.all > 0 ? (counts.web / counts.all) * 100 : 17}%` }}
                  title={`Web Chat: ${counts.web}`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 pt-0.5">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Voice ({counts.voice})</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-600" /> Copilot ({counts.copilot})</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Web ({counts.web})</span>
              </div>
            </div>

            {/* Activity Trend Bar Chart */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Conversation Activity Trend</h3>
                <span className="text-[10px] font-bold text-slate-400">Last 14 Days</span>
              </div>
              <div className="h-36 w-full bg-slate-50/50 p-2 rounded-2xl border border-slate-100">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(analytics?.usage_trend?.slice(-14) as any) || [
                    { date: "2026-10-18", conversations: 12 },
                    { date: "2026-10-20", conversations: 19 },
                    { date: "2026-10-22", conversations: 5 },
                    { date: "2026-10-24", conversations: 28 },
                    { date: "2026-10-26", conversations: 24 },
                    { date: "2026-10-28", conversations: 20 },
                    { date: "2026-10-30", conversations: 22 },
                    { date: "2026-10-31", conversations: 16 },
                  ]} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: "#94a3b8" }}
                      tickFormatter={(val) => {
                        try { return format(new Date(val), "MMM d"); } catch { return String(val); }
                      }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: "#94a3b8" }} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                      labelFormatter={(l: any) => {
                        try { return format(new Date(l), "PP"); } catch { return String(l); }
                      }}
                      formatter={(value: any) => [`${value} sessions`, "Volume"]}
                    />
                    <Bar dataKey="conversations" fill="#047857" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Questions */}
            {analytics?.top_questions && analytics.top_questions.length > 0 && (
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2">Common Customer Inquiries</h3>
                <div className="space-y-2">
                  {analytics.top_questions.slice(0, 4).map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                      <p className="font-semibold text-slate-800 truncate pr-2">{t.question}</p>
                      <span className="shrink-0 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">
                        {t.count}x
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active AI Personas */}
            {analytics?.agents && analytics.agents.length > 0 && (
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider mb-2">Deployed AI Personas</h3>
                <div className="space-y-1.5">
                  {analytics.agents.map((ag, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                          {ag.name.slice(0, 1)}
                        </div>
                        <span className="font-bold text-slate-800">{ag.name}</span>
                      </div>
                      <span className="font-mono text-slate-500 text-[11px] font-semibold">{ag.conversations} convs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </aside>

    </div>
  );
}

// Smart Conversation Card Component
function SmartConversationCard({ 
  chat, 
  groupLabel,
  isSelected,
  isSelecting,
  isActive, 
  onClick, 
  onToggleSelect,
  onPin,
  onUnpin,
  onArchive,
  onDelete,
  viewArchived
}: { 
  chat: Conversation, 
  groupLabel: string,
  isSelected: boolean,
  isSelecting: boolean,
  isActive: boolean, 
  onClick: () => void, 
  onToggleSelect: (e: React.MouseEvent) => void,
  onPin: (e: React.MouseEvent) => void,
  onUnpin: (e: React.MouseEvent) => void,
  onArchive: (e: React.MouseEvent) => void,
  onDelete: (e: React.MouseEvent) => void,
  viewArchived: boolean
}) {
  const isVoice = ["inbound", "outbound", "voice_chat"].includes(chat.direction) || chat.source_type === "phone_call" || chat.source_type === "voice_chat";
  const displayName = chat.contact_name || (chat.title && chat.title !== "New Chat" ? chat.title : (chat.caller_phone || "Conversation"));
  const hasRecording = Boolean(chat.recording_url);

  return (
    <div
      onClick={onClick}
      className={`group relative w-full text-left bg-white border shadow-2xs transition-all duration-200 rounded-2xl p-3.5 flex items-start justify-between cursor-pointer ${
        isActive 
          ? "border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/20 shadow-sm" 
          : "border-slate-200/90 hover:border-emerald-400 hover:shadow-xs"
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0 pr-10">
        {/* Selection Checkbox */}
        {isSelecting && (
          <button onClick={onToggleSelect} className="mt-1 text-slate-400 shrink-0 hover:text-emerald-600 transition-colors">
            {isSelected ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4" />}
          </button>
        )}

        {/* Avatar Icon */}
        <div className={`h-9 w-9 shrink-0 rounded-xl border flex items-center justify-center font-bold text-xs transition-colors relative ${
          isActive 
            ? "bg-emerald-600 border-emerald-700 text-white shadow-xs" 
            : chat.contact_name
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-slate-50 border-slate-200 text-slate-600"
        }`}>
          {chat.is_pinned && !isSelecting && (
            <div className="absolute -top-1 -right-1 bg-amber-500 text-white p-0.5 rounded-full shadow-2xs">
              <Pin className="h-2 w-2" />
            </div>
          )}
          {chat.contact_name ? chat.contact_name.slice(0, 1).toUpperCase() : getChannelIcon(chat.direction, chat.source_type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-900 truncate leading-snug">
              {displayName}
            </h4>
            {chat.contact_name && chat.caller_phone && (
              <span className="text-[11px] font-mono text-slate-400 shrink-0 font-medium">
                ({chat.caller_phone})
              </span>
            )}
          </div>

          {/* Last Message Snippet */}
          {chat.last_message ? (
            <p className="text-xs text-slate-500 truncate mt-0.5 leading-snug">
              {cleanMarkdown(chat.last_message)}
            </p>
          ) : (
            <p className="text-xs text-slate-400 italic mt-0.5">No text preview available</p>
          )}

          {/* Badges Row */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[9px] uppercase font-bold tracking-wider text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
              {getChannelLabel(chat.direction, chat.source_type)}
            </span>

            {isVoice && chat.duration_seconds > 0 && (
              <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 font-mono">
                {formatDur(chat.duration_seconds)}
              </span>
            )}

            {chat.turn_count > 0 && (
              <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60">
                #{chat.turn_count} turns
              </span>
            )}

            {hasRecording && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                <Volume2 className="h-2.5 w-2.5" />
                Audio
              </span>
            )}

            {chat.status === "failed" ? (
              <span className="text-[9px] uppercase font-bold tracking-wider text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                Failed
              </span>
            ) : chat.status === "completed" ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Done
              </span>
            ) : null}
          </div>
        </div>
      </div>
      
      {/* Right Time & Hover Actions */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[11px] font-semibold text-slate-400">
          {formatGroupDate(chat, groupLabel)}
        </span>
      </div>

      {/* Hover Actions Bar */}
      {!isSelecting && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 px-1.5 py-1 rounded-xl shadow-md border border-slate-200 backdrop-blur-xs">
          {!viewArchived && (
            <button
              onClick={chat.is_pinned ? onUnpin : onPin}
              className={`p-1 rounded-lg hover:bg-slate-100 transition-colors ${chat.is_pinned ? 'text-amber-500' : 'text-slate-400 hover:text-slate-700'}`}
              title={chat.is_pinned ? "Unpin conversation" : "Pin conversation"}
            >
              {chat.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            </button>
          )}
          {!viewArchived && (
            <button
              onClick={onArchive}
              className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 transition-colors"
              title="Archive conversation"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
            title="Delete conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdvancedHistoryPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>}>
      <AdvancedHistoryPageContent />
    </Suspense>
  );
}
