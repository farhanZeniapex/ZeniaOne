"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { conversationsApi, Conversation } from "@/lib/api/conversations";
import { analyticsApi, DetailedAnalytics } from "@/lib/api/analytics";
import { useCurrentCompany } from "@/hooks/use-company";
import { 
  Loader2, MessageSquare, Clock, ChevronRight, Calendar, 
  Archive, Hash, Search, ArrowLeft, BarChart2, 
  CheckCircle2, AlertCircle, Phone, Globe, Smartphone, User, FileText, Activity, Trash2, RefreshCcw,
  Pin, PinOff, Square, CheckSquare, ListChecks, Check, X
} from "lucide-react";
import { FilterSelect } from "@/components/ui/filter-select";
import { format, isToday, isYesterday, subDays, isAfter } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type HistoryGroup = {
  label: string;
  items: Conversation[];
};

function HistoryLoadingState() {
  return <div className="mx-auto max-w-[1400px] animate-pulse pt-3"><div className="mb-8 flex items-end justify-between"><div><div className="h-8 w-40 rounded-lg bg-[#DDE9E0]"/><div className="mt-3 h-3 w-28 rounded bg-[#EAF1EC]"/></div><div className="h-9 w-24 rounded-full bg-[#EAF1EC]"/></div><div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-3xl border border-[#DDE9E0] bg-white p-6 shadow-sm"><div className="h-5 w-32 rounded bg-[#DDE9E0]"/><div className="mt-5 space-y-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="flex gap-3 rounded-2xl border border-[#EDF2EE] p-4"><div className="h-10 w-10 shrink-0 rounded-xl bg-[#E6F2E9]"/><div className="flex-1"><div className="h-4 w-2/5 rounded bg-[#E1EBE4]"/><div className="mt-2 h-3 w-4/5 rounded bg-[#EDF2EE]"/></div></div>)}</div></section><aside className="hidden rounded-3xl border border-[#DDE9E0] bg-white p-6 shadow-sm lg:block"><div className="h-5 w-28 rounded bg-[#DDE9E0]"/><div className="mt-5 h-28 rounded-2xl bg-[#F1F6F2]"/><div className="mt-4 h-3 w-full rounded bg-[#E6EEE8]"/><div className="mt-3 h-3 w-4/5 rounded bg-[#E6EEE8]"/></aside></div></div>;
}

function formatGroupDate(chat: Conversation, group: string): string {
  const date = new Date(chat.started_at);
  if (group === "Today") return format(date, "h:mm a");
  if (group === "Yesterday") return format(date, "h:mm a");
  return format(date, "MMM d, h:mm a");
}

function getChannelIcon(direction: string) {
  if (direction === "test-chat") return <MessageSquare className="h-4 w-4" />;
  if (direction === "inbound" || direction === "outbound" || direction === "voice_chat") return <Phone className="h-4 w-4" />;
  if (direction === "whatsapp" || direction === "sms") return <Smartphone className="h-4 w-4" />;
  return <Globe className="h-4 w-4" />;
}

function getChannelLabel(direction: string) {
  if (direction === "test-chat") return "My AI Chat";
  if (direction === "inbound") return "Inbound Voice";
  if (direction === "outbound") return "Outbound Voice";
  if (direction === "voice_chat") return "Voice Chat";
  if (direction === "whatsapp") return "WhatsApp";
  if (direction === "sms") return "SMS";
  return "Web Chat";
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
  
  // Data State
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  
  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("30d");
  const [viewArchived, setViewArchived] = useState(false);

  // Selection State
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedMessages, setSelectedMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Multi-Select State
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Initial Fetch
  const fetchConversations = () => {
    if (!companyId) return;
    setLoading(true);
    conversationsApi.list(companyId, { limit: 150, is_archived: viewArchived })
      .then(res => {
        setAllConversations(res.conversations || []);
        setSelectedIds(new Set());
        if (res.conversations?.length === 0) {
          setIsSelecting(false);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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

  // Single Actions
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

  // Messages Fetch
  useEffect(() => {
    if (selectedChatId && companyId) {
      setLoadingMessages(true);
      conversationsApi.getMessages(companyId, selectedChatId)
        .then(res => setSelectedMessages(res.messages || []))
        .catch(console.error)
        .finally(() => setLoadingMessages(false));
    } else {
      setSelectedMessages([]);
    }
  }, [selectedChatId, companyId]);

  // Derived Filtered Data
  const filteredChats = useMemo(() => {
    return allConversations.filter(c => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const title = (c.title || "").toLowerCase();
        const msg = (c.last_message || "").toLowerCase();
        const phone = (c.caller_phone || "").toLowerCase();
        if (!title.includes(q) && !msg.includes(q) && !phone.includes(q)) return false;
      }
      
      // Status
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      
      // Channel
      if (channelFilter !== "all") {
        if (channelFilter === "voice" && !["inbound", "outbound"].includes(c.direction)) return false;
        if (channelFilter === "web-chat" && c.direction === "test-chat") return false; 
        if (channelFilter === "test-chat" && c.direction !== "test-chat") return false;
        if (channelFilter !== "voice" && channelFilter !== "web-chat" && channelFilter !== "test-chat" && c.direction !== channelFilter) return false;
      }
      
      // Date
      const date = new Date(c.started_at);
      if (dateFilter === "today" && !isToday(date)) return false;
      if (dateFilter === "7d" && !isAfter(date, subDays(new Date(), 7))) return false;
      if (dateFilter === "30d" && !isAfter(date, subDays(new Date(), 30))) return false;

      return true;
    });
  }, [allConversations, searchQuery, statusFilter, channelFilter, dateFilter]);

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
        const date = new Date(chat.started_at);
        if (isToday(date)) today.push(chat);
        else if (isYesterday(date)) yesterday.push(chat);
        else older.push(chat);
      }
    });

    const newGroups: HistoryGroup[] = [];
    if (today.length > 0) newGroups.push({ label: "Today", items: today });
    if (yesterday.length > 0) newGroups.push({ label: "Yesterday", items: yesterday });
    if (older.length > 0) newGroups.push({ label: "Older", items: older });
    
    return { pinnedChats: pinned, recentGroups: newGroups };
  }, [filteredChats, viewArchived]);

  if (compLoading || loading) return <HistoryLoadingState />;
  if (!companyId) return <div className="mx-auto grid min-h-[50vh] max-w-lg place-items-center text-center"><div><MessageSquare className="mx-auto h-10 w-10 text-[#74A887]"/><h1 className="mt-4 text-xl font-bold text-[#1C3A2D]">Choose a workspace first</h1><p className="mt-2 text-sm text-slate-500">Chat history load karne ke liye active company select karein.</p></div></div>;

  const selectedChat = allConversations.find(c => c.id === selectedChatId);

  return (
    <div className="pt-2 max-w-[1400px] mx-auto min-h-[calc(100vh-6rem)] flex flex-col lg:flex-row items-start gap-8 pb-10">
      
      {/* ============================================================== */}
      {/* LEFT PANE: History List */}
      <div className={`w-full ${selectedChatId ? "hidden lg:flex" : "flex"} lg:w-3/5 flex-col lg:h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2 custom-scrollbar`}>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">History</h1>
            <p className="text-sm font-semibold text-sage-600 uppercase tracking-wide mt-1">
              Platform Workspace
            </p>
          </div>
          <span className="text-sm text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full">
            {analytics?.kpi?.total_conversations || filteredChats.length} conversation{((analytics?.kpi?.total_conversations || filteredChats.length) !== 1) ? "s" : ""}
          </span>
        </div>

        {/* Filters and Bulk Toolbar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-sm flex flex-col gap-4">
          {!isSelecting ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search messages or phone numbers..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full sm:max-w-md pl-9 pr-4 py-2 bg-slate-50 hover:bg-white border border-slate-200 shadow-sm rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 transition-all placeholder:text-slate-400"
                />
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <FilterSelect
                  label="Date"
                  value={dateFilter}
                  onChange={setDateFilter}
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  options={[
                    { label: "All Time", value: "all" },
                    { label: "Today", value: "today" },
                    { label: "7 Days", value: "7d" },
                    { label: "30 Days", value: "30d" },
                  ]}
                />
                <FilterSelect
                  label="Channel"
                  value={channelFilter}
                  onChange={setChannelFilter}
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  options={[
                    { label: "All", value: "all" },
                    { label: "My AI Chat", value: "test-chat" },
                    { label: "Voice", value: "voice" },
                  ]}
                />
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  icon={<Activity className="h-3.5 w-3.5" />}
                  options={[
                    { label: "All", value: "all" },
                    { label: "Completed", value: "completed" },
                    { label: "Active", value: "active" },
                    { label: "Failed", value: "failed" },
                  ]}
                />
                <button
                  onClick={() => setIsSelecting(true)}
                  className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  <ListChecks className="h-4 w-4" />
                  Select
                </button>
                <button
                  onClick={() => setViewArchived(!viewArchived)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    viewArchived 
                      ? "bg-sage-50 border-sage-200 text-sage-600" 
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Archive className="h-4 w-4" />
                  {viewArchived ? "Archived View" : "Active View"}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsSelecting(false)}
                  className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-slate-800">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={() => toggleSelectAll(filteredChats)}
                  className="text-xs font-semibold text-sage-600 hover:text-sage-700 bg-sage-50 px-3 py-1.5 rounded-md transition-colors"
                >
                  {selectedIds.size === filteredChats.length ? "Deselect All" : "Select All Visible"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                {!viewArchived && (
                  <button
                    disabled={selectedIds.size === 0}
                    onClick={handleBulkArchive}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Archive className="h-4 w-4" />
                    Archive
                  </button>
                )}
                <button
                  disabled={selectedIds.size === 0}
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-4 text-center px-4 bg-white rounded-3xl border border-slate-200 py-20 shadow-sm">
            <div className="h-16 w-16 bg-sage-50 rounded-2xl flex items-center justify-center mb-5">
              <MessageSquare className="h-8 w-8 text-sage-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">No conversations found</h2>
            <p className="text-sm text-slate-500 max-w-sm">
              Adjust your filters or start a new conversation to see history here.
            </p>
            <button
              onClick={() => router.push("/admin/my-ai/chat")}
              className="mt-6 px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              Start a Chat
            </button>
          </div>
        ) : (
          <div className="space-y-8 flex-1 pb-10">
            {/* PINNED SECTION */}
            {pinnedChats.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-2">
                  <Pin className="h-3 w-3" />
                  Pinned
                </h3>
                <div className="flex flex-col gap-2">
                  {pinnedChats.map((chat) => (
                    <ConversationCard 
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
              <div key={gIdx} className="space-y-3">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 px-2">
                  {group.label === "Today" && <Clock className="h-3 w-3" />}
                  {group.label === "Yesterday" && <Calendar className="h-3 w-3" />}
                  {group.label === "Older" && <Archive className="h-3 w-3" />}
                  {group.label}
                </h3>
                <div className="flex flex-col gap-2">
                  {group.items.map((chat) => (
                    <ConversationCard 
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
      {/* RIGHT PANE: Insights / Details */}
      {/* ============================================================== */}
      <aside className={`w-full lg:w-2/5 flex flex-col ${!selectedChatId ? "hidden lg:flex" : "flex"}`}>
        
        {selectedChatId && selectedChat ? (
          /* State 1: Conversation Details */
          <div className="conversation-insights-outer-box bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <button 
                onClick={() => setSelectedChatId(null)}
                className="flex items-center gap-1.5 text-xs font-bold text-sage-600 hover:text-sage-700 uppercase tracking-widest w-fit"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Insights
              </button>
              
              <div className="flex items-center gap-2">
                {viewArchived ? (
                  <button 
                    onClick={() => handleRestore(selectedChat.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                  >
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Restore
                  </button>
                ) : (
                  <button 
                    onClick={() => handleArchive(selectedChat.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(selectedChat.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
            
            <div className="flex items-start gap-4 mb-6">
              <div className="h-12 w-12 shrink-0 rounded-2xl bg-sage-50 border border-sage-100 flex items-center justify-center text-sage-600 relative">
                {selectedChat.is_pinned && <div className="absolute -top-1.5 -right-1.5 bg-amber-100 text-amber-600 p-0.5 rounded-full"><Pin className="h-3 w-3" /></div>}
                {getChannelIcon(selectedChat.direction)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  {selectedChat.title || selectedChat.caller_phone || "Conversation Details"}
                </h2>
                <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                  <span>{format(new Date(selectedChat.started_at), "PPp")}</span>
                  <span>•</span>
                  <span>{getChannelLabel(selectedChat.direction)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Status</p>
                <p className="text-sm font-medium text-slate-700 capitalize flex items-center gap-1.5">
                  {selectedChat.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : 
                   selectedChat.status === "failed" ? <AlertCircle className="h-4 w-4 text-red-500" /> : 
                   <Clock className="h-4 w-4 text-amber-500" />}
                  {selectedChat.status}
                </p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Messages</p>
                <p className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-slate-400" />
                  {selectedChat.turn_count || 0}
                </p>
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">Recent Messages</h3>
            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-20 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : selectedMessages.length === 0 ? (
                <p className="text-center text-sm text-slate-400 my-4">No messages available.</p>
              ) : (
                selectedMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user" 
                        ? "bg-sage-600 text-white rounded-br-none" 
                        : "bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm"
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text || msg.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Action button to open full chat if test-chat */}
            {(selectedChat.direction === "test-chat" || selectedChat.direction === "voice_chat") && (
              <button
                onClick={() => router.push(`/admin/my-ai/chat?id=${selectedChat.id}`)}
                className="mt-4 w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                Open in My AI Chat
              </button>
            )}
          </div>
        ) : (
          /* State 2: Default Insights */
          <div className="conversation-insights-outer-box bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-6 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar">
            <div>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-sage-500" />
                Conversation Insights
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Internal workspace conversational intelligence over the selected period.
              </p>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Convs</p>
                <p className="text-2xl font-bold text-slate-800">
                  {analytics?.kpi?.total_conversations?.toLocaleString() || "0"}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Success Rate</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {analytics?.kpi?.success_rate != null ? `${analytics.kpi.success_rate.toFixed(1)}%` : "N/A"}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1">API Generation</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">AI Requests</p>
                <p className="text-xl font-bold text-slate-700">
                  {analytics?.kpi?.ai_requests?.toLocaleString() || "0"}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tokens Used</p>
                <p className="text-xl font-bold text-slate-700">
                  {analytics?.kpi?.total_tokens ? (analytics.kpi.total_tokens >= 1000 ? `${(analytics.kpi.total_tokens / 1000).toFixed(1)}K` : analytics.kpi.total_tokens.toLocaleString()) : "0"}
                </p>
              </div>
            </div>

            {/* Trend Chart */}
            {analytics?.usage_trend && analytics.usage_trend.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">Activity Trend</h3>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.usage_trend.slice(-14)} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        tickFormatter={(val) => format(new Date(val), "MMM d")}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: "#94a3b8" }} 
                      />
                      <Tooltip 
                        cursor={{ fill: '#f1f5f9' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelFormatter={(l: any) => format(new Date(l), "MMM d")}
                        formatter={(value: any) => [`${value} conversations`, ""]}
                        labelStyle={{ color: '#64748b', fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}
                      />
                      <Bar dataKey="conversations" fill="#6B8074" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top Questions */}
            {analytics?.top_questions && analytics.top_questions.length > 0 && (
              <div>
                <div className="mb-3 border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-900">Top Questions</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">Most common questions from the selected period</p>
                </div>
                <div className="space-y-2.5">
                  {analytics.top_questions.slice(0, 5).map((t, i) => (
                    <div key={i} className="group relative flex flex-col gap-1 bg-sage-50/50 hover:bg-sage-50 p-3 rounded-2xl border border-sage-100/50 hover:border-sage-200 hover:shadow-sm transition-all duration-200 cursor-default">
                      <p className="text-sm font-semibold text-slate-800 leading-snug pr-4">{t.question}</p>
                      <p className="text-[11px] text-sage-600 font-bold uppercase tracking-wide">{t.count} occurrences</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Activity */}
            {analytics?.agents && analytics.agents.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2">Agent Activity</h3>
                <div className="space-y-2">
                  {analytics.agents.map((ag, i) => (
                    <div key={i} className="flex items-center justify-between bg-white hover:bg-slate-50 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all duration-200 shadow-sm cursor-default group">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-slate-100 group-hover:bg-sage-100 flex items-center justify-center text-slate-500 group-hover:text-sage-600 transition-colors">
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-[13px] font-semibold text-slate-800">{ag.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-700">{ag.conversations} <span className="text-[10px] uppercase text-slate-400 ml-0.5 font-bold tracking-wider">convs</span></p>
                      </div>
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

// Conversation Card Component
function ConversationCard({ 
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
  return (
    <div
      onClick={onClick}
      className={`group relative w-full text-left bg-white border shadow-sm transition-all duration-200 rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer ${
        isActive 
          ? "border-sage-500 ring-1 ring-sage-500/20 bg-sage-50/50" 
          : "border-slate-200 hover:border-sage-300 hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0 pr-12">
        {isSelecting && (
          <button onClick={onToggleSelect} className="mt-1.5 text-slate-400 shrink-0 hover:text-sage-600 transition-colors">
            {isSelected ? <CheckSquare className="h-5 w-5 text-sage-600" /> : <Square className="h-5 w-5" />}
          </button>
        )}
        <div className={`h-8 w-8 shrink-0 rounded-xl border flex items-center justify-center mt-0.5 transition-colors relative ${
          isActive ? "bg-sage-100 border-sage-200 text-sage-600" : "bg-slate-50 border-slate-100 text-slate-500"
        }`}>
          {chat.is_pinned && !isSelecting && <div className="absolute -top-1.5 -right-1.5 bg-amber-100 text-amber-600 p-0.5 rounded-full shadow-sm"><Pin className="h-2.5 w-2.5" /></div>}
          {getChannelIcon(chat.direction)}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[15px] font-semibold text-slate-800 truncate leading-snug">
            {chat.title || chat.caller_phone || "New Conversation"}
          </h4>
          {chat.last_message && (
            <p className="text-[13px] text-slate-500 truncate mt-0.5 leading-snug">
              {cleanMarkdown(chat.last_message)}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {getChannelLabel(chat.direction)}
            </span>
            {chat.status === "failed" && (
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                Failed
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className="text-xs font-medium text-slate-400">
          {formatGroupDate(chat, groupLabel)}
        </span>
        {chat.turn_count > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-medium bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border border-slate-100">
            <Hash className="h-3 w-3" />
            {chat.turn_count}
          </span>
        )}
      </div>

      {/* Hover Actions (hidden in selection mode) */}
      {!isSelecting && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 px-2 py-1.5 rounded-lg shadow-sm border border-slate-100 backdrop-blur-sm">
          {!viewArchived && (
            <button
              onClick={chat.is_pinned ? onUnpin : onPin}
              className={`p-1.5 rounded-md hover:bg-slate-100 transition-colors ${chat.is_pinned ? 'text-amber-500 hover:text-amber-600' : 'text-slate-400 hover:text-slate-700'}`}
              title={chat.is_pinned ? "Unpin conversation" : "Pin conversation"}
            >
              {chat.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          )}
          {!viewArchived && (
            <button
              onClick={onArchive}
              className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-slate-100 transition-colors"
              title="Archive conversation"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
            title="Delete conversation"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdvancedHistoryPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-sage-600" /></div>}>
      <AdvancedHistoryPageContent />
    </Suspense>
  );
}
