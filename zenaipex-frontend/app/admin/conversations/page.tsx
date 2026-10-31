"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchApi } from "@/lib/api/client";
import { formatSystemDateTime } from "@/lib/utils";
import {
  MessageSquare,
  PhoneIncoming,
  PhoneOutgoing,
  Archive,
  Trash2,
  RefreshCcw,
  Pin,
  PinOff,
  Square,
  CheckSquare,
  ListChecks,
  X,
  Search,
  BarChart2,
  Phone,
  Clock,
  Hash,
  TrendingUp,
  Mic,
  RefreshCw,
  ChevronDown,
  Play,
  Pause,
  Download,
  ExternalLink,
  Info,
  User,
  Bot,
  Activity,
  Sparkles,
  FileText,
  Calendar,
  PhoneOff,
  CircleX,
  CheckCircle2,
  Ban,
  PhoneMissed,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import org from "../organization.module.css";
import { SmartSelect } from "@/components/ui/smart-select";

/* ─── helpers ─── */
function formatDur(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function ChannelIcon({ d }: { d: string }) {
  if (d === "inbound") return <PhoneIncoming className="h-3.5 w-3.5" />;
  if (d === "outbound") return <PhoneOutgoing className="h-3.5 w-3.5" />;
  if (d === "web_chat") return <MessageSquare className="h-3.5 w-3.5" />;
  if (d === "voice_chat") return <Mic className="h-3.5 w-3.5" />;
  return <Info className="h-3.5 w-3.5" />;
}

function ChannelBadge({ d }: { d: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    inbound: {
      label: "Inbound Call",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    outbound: {
      label: "Outbound Call",
      cls: "bg-blue-50 text-blue-800 border-blue-200",
    },
    web_chat: {
      label: "Web Chat",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    voice_chat: {
      label: "Voice Chat",
      cls: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    admin_copilot: {
      label: "Admin Copilot",
      cls: "bg-violet-50 text-violet-800 border-violet-200",
    },
    unverified: {
      label: "Source Unverified",
      cls: "bg-amber-50 text-amber-800 border-amber-200",
    },
  };
  const { label, cls } = map[d] || {
    label: d,
    cls: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}
    >
      <ChannelIcon d={d} />
      {label}
    </span>
  );
}

function StatusDot({ s }: { s: string }) {
  if (s === "source-unverified")
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Source unverified
      </span>
    );
  if (s === "completed")
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Completed
      </span>
    );
  if (s === "hung-up")
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Hung-up
      </span>
    );
  if (s === "failed")
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        Failed
      </span>
    );
  if (s === "active" || s === "calling")
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
        </span>
        Active
      </span>
    );

  // Fallback for unknown states
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {s}
    </span>
  );
}

function AudioPlayer({ url, sid }: { url: string; sid?: string }) {
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() =>
    typeof window !== "undefined" ? new Audio(url) : null,
  );

  const toggle = () => {
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
      audio.onended = () => setPlaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-slate-900 text-white rounded-xl px-3 py-2 w-full mt-2">
      <button
        onClick={toggle}
        aria-label="Play or pause recording"
        className="h-8 w-8 rounded-full bg-emerald-500 hover:bg-emerald-400 flex items-center justify-center shrink-0 transition-colors"
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5 ml-0.5" />
        )}
      </button>
      <div className="flex-1">
        <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full w-0 animate-none"
            style={{ width: playing ? "30%" : "0%" }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1">MP3 Recording</p>
      </div>
      <a
        href={url}
        download={`recording-${sid || "call"}.mp3`}
        className="text-slate-400 hover:text-white transition-colors"
        title="Download MP3"
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}

/* ─── Detail Drawer ─── */
function ConvDetail({ conv, onClose }: { conv: any; onClose: () => void }) {
  const [transcript, setTranscript] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isPhone = conv.source_type === "phone_call";
  const isChat = conv.source_type === "web_chat";
  const dur = conv.duration_seconds || 0;
  const costRs = isPhone && dur > 0 ? `₹${((dur / 60) * 1.5).toFixed(2)}` : "—";

  useEffect(() => {
    fetchApi<any>(`/admin/conversations/${conv.company_id}/${conv.id}/messages`)
      .then((r) => setTranscript(r.messages || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [conv.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className={`px-5 py-4 border-b border-slate-100 flex items-start justify-between ${
            isPhone
              ? "bg-gradient-to-r from-emerald-50 to-white"
              : isChat
                ? "bg-gradient-to-r from-indigo-50 to-white"
                : "bg-slate-50"
          }`}
        >
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <ChannelBadge d={isPhone ? conv.direction : conv.source_type} />
              <StatusDot
                s={
                  conv.source_type === "unverified"
                    ? "source-unverified"
                    : conv.status
                }
              />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {isPhone
                ? conv.contact_name
                  ? `${conv.contact_name} (${conv.caller_phone || "Unknown Number"})`
                  : conv.caller_phone || "Unknown Number"
                : conv.title || "Conversation"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatSystemDateTime(conv.started_at || conv.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close recording player"
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/50">
          {[
            {
              label: "Messages",
              val: conv.actual_message_count || 0,
              icon: <Hash className="h-3.5 w-3.5 text-slate-400" />,
            },
            {
              label: "Duration",
              val: conv.source_type === "unverified" ? "—" : formatDur(dur),
              icon: <Clock className="h-3.5 w-3.5 text-amber-400" />,
            },
            {
              label: "Est. Call Cost",
              val: costRs,
              icon: <BarChart2 className="h-3.5 w-3.5 text-purple-400" />,
            },
            {
              label: "Language",
              val: (conv.language || "en").toUpperCase(),
              icon: <Mic className="h-3.5 w-3.5 text-indigo-400" />,
            },
          ].map((s) => (
            <div key={s.label} className="px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                {s.icon}
              </div>
              <p className="text-sm font-bold text-slate-900">{s.val}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Details + Transcript */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Call Details (phone only) */}
          {isPhone && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  📞 Call Details
                </p>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    From (Customer)
                  </p>
                  <p className="font-mono text-sm font-bold text-slate-900">
                    {conv.contact_name ? `${conv.contact_name} (${conv.caller_phone || "Unknown"})` : (conv.caller_phone || "Unknown")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    To (Your Number)
                  </p>
                  <p className="font-mono text-sm font-bold text-slate-900">
                    {conv.caller_to || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Call SID
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 break-all">
                    {conv.call_sid || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Company
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {conv.company_id}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recording player for ANY conversation that has a recording */}
          {conv.recording_url && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  🎙️ Audio Recording
                </p>
              </div>
              <div className="p-4">
                <AudioPlayer
                  url={conv.recording_url}
                  sid={conv.recording_sid}
                />
              </div>
            </div>
          )}

          {/* Transcript */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                💬 Conversation Transcript
              </p>
              <span className="text-xs text-slate-400">
                {transcript.length} messages
              </span>
            </div>
            <div className="p-4 max-h-80 overflow-y-auto space-y-4 bg-slate-50/30">
              {loading ? (
                <div className="text-center py-8 text-sm text-slate-400">
                  Loading transcript…
                </div>
              ) : transcript.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No messages found</p>
                </div>
              ) : (
                transcript.map((msg: any, i: number) => {
                  const isUser = msg.role === "user";
                  const text =
                    typeof msg.content === "string"
                      ? msg.content
                      : msg.text || "";
                  return (
                    <div
                      key={i}
                      className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                          isUser
                            ? "bg-sage-600 text-white rounded-tr-sm"
                            : "bg-white text-slate-700 rounded-tl-sm border border-slate-100 shadow-sm"
                        }`}
                      >
                        {text}
                      </div>
                      {isUser && (
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                          <User className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── main page ─── */
export default function AdminConversationsPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"all" | "active" | "archived">("all");
  const viewArchived = viewMode === "archived";
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<
    "all" | "calls" | "chat" | "voice" | "unverified" | "pending"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [companiesMap, setCompaniesMap] = useState<Record<string, string>>({});
  const router = useRouter();

  const handleForceFail = async (companyId: string, convId: string) => {
    try {
      await fetchApi(`/admin/conversations/${companyId}/${convId}/force-fail`, {
        method: "POST",
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, status: "failed" } : c)),
      );
    } catch (e) {
      alert("Failed to force end call");
    }
  };

  const handleStatusUpdate = async (
    companyId: string,
    convId: string,
    status: string,
  ) => {
    try {
      await fetchApi(`/admin/conversations/${companyId}/${convId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, status } : c)),
      );
    } catch (e) {
      alert("Failed to update conversation status");
    }
  };

  const loadConvs = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const qs = viewMode === "all"
        ? ""
        : viewMode === "archived"
          ? "?is_archived=true"
          : "?is_archived=false";
      const [dataRes, compsRes] = await Promise.allSettled([
        fetchApi<any>(`/admin/conversations${qs}`),
        fetchApi<any>(`/admin/companies`),
      ]);

      if (dataRes.status === "fulfilled" && dataRes.value?.conversations) {
        setConversations(dataRes.value.conversations);
        if (dataRes.value.conversations.length === 0) setIsSelecting(false);
      } else {
        const errorMsg = dataRes.status === "rejected" ? (dataRes.reason?.message || "Failed to load conversations") : "Could not retrieve conversations";
        console.warn("Conversations fetch status:", errorMsg);
        setLoadError(errorMsg);
      }

      if (compsRes.status === "fulfilled" && compsRes.value?.companies) {
        const compMap: Record<string, string> = {};
        compsRes.value.companies.forEach((c: any) => {
          compMap[c.id] = c.name;
        });
        setCompaniesMap(compMap);
      }

      setSelectedIds(new Set());
    } catch (err: any) {
      console.error("Failed to load conversations", err);
      setLoadError(err?.message || "Connection timeout or server restarting");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConvs();
  }, [viewMode]);

  const handleArchive = async (cid: string, id: string) => {
    await fetchApi(`/admin/conversations/${cid}/${id}/archive`, {
      method: "POST",
    });
    loadConvs();
  };
  const handleRestore = async (cid: string, id: string) => {
    await fetchApi(`/admin/conversations/${cid}/${id}/restore`, {
      method: "POST",
    });
    loadConvs();
  };
  const handleDelete = async (cid: string, id: string) => {
    if (!confirm("Permanently delete?")) return;
    await fetchApi(`/admin/conversations/${cid}/${id}`, { method: "DELETE" });
    loadConvs();
  };
  const handlePin = async (cid: string, id: string) => {
    await fetchApi(`/admin/conversations/${cid}/${id}/pin`, { method: "POST" });
    setConversations((p) =>
      p.map((c) => (c.id === id ? { ...c, is_pinned: true } : c)),
    );
  };
  const handleUnpin = async (cid: string, id: string) => {
    await fetchApi(`/admin/conversations/${cid}/${id}/unpin`, {
      method: "POST",
    });
    setConversations((p) =>
      p.map((c) => (c.id === id ? { ...c, is_pinned: false } : c)),
    );
  };

  const handleBulkArchive = async () => {
    const list = Array.from(selectedIds).map((id) => {
      const c = conversations.find((x) => x.id === id);
      return { company_id: c.company_id, id: c.id };
    });
    await fetchApi("/admin/conversations/bulk-archive", {
      method: "POST",
      body: JSON.stringify({ conversations: list }),
    });
    setIsSelecting(false);
    loadConvs();
  };
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} conversations permanently?`))
      return;
    const list = Array.from(selectedIds).map((id) => {
      const c = conversations.find((x) => x.id === id);
      return { company_id: c.company_id, id: c.id };
    });
    await fetchApi("/admin/conversations/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ conversations: list }),
    });
    setIsSelecting(false);
    loadConvs();
  };

  const toggleSelection = (id: string) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };
  const toggleSelectAll = () =>
    setSelectedIds(
      selectedIds.size === conversations.length
        ? new Set()
        : new Set(conversations.map((c) => c.id)),
    );

  const { pinned, unpinned } = useMemo(() => {
    const p: any[] = [],
      u: any[] = [];
    conversations.forEach((c) => {
      if (c.is_pinned && !viewArchived) p.push(c);
      else u.push(c);
    });
    return { pinned: p, unpinned: u };
  }, [conversations, viewArchived]);

  const totalCalls = conversations.filter(
    (c) => c.source_type === "phone_call",
  ).length;
  const totalChats = conversations.filter(
    (c) => c.source_type === "web_chat",
  ).length;
  const totalVoice = conversations.filter(
    (c) => c.source_type === "voice_chat",
  ).length;
  const totalUnverified = conversations.filter(
    (c) => c.source_type === "unverified",
  ).length;
  const timedCalls = conversations.filter(
    (c) => c.source_type === "phone_call" && Number(c.duration_seconds) > 0,
  ).length;
  const untimedCalls = totalCalls - timedCalls;
  const totalDurSec = conversations
    .filter((c) => c.source_type === "phone_call")
    .reduce((a, b) => a + (Number(b.duration_seconds) || 0), 0);
  const totalTurns = conversations.reduce(
    (a, b) => a + (Number(b.actual_message_count) || 0),
    0,
  );
  const unverifiedMessages = conversations
    .filter((c) => c.source_type === "unverified")
    .reduce((a, b) => a + (Number(b.actual_message_count) || 0), 0);
  const estCost = ((totalDurSec / 60) * 1.5).toFixed(2);

  const allRows = [...pinned, ...unpinned];
  const filtered = allRows.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (c.company_id || "").includes(q) ||
      (c.direction || "").includes(q) ||
      (c.title || "").toLowerCase().includes(q) ||
      (c.caller_phone || "").includes(q) ||
      (c.last_message || "").toLowerCase().includes(q);
    const matchTab =
      activeTab === "all" ||
      (activeTab === "calls" && c.source_type === "phone_call") ||
      (activeTab === "chat" && c.source_type === "web_chat") ||
      (activeTab === "voice" && c.source_type === "voice_chat") ||
      (activeTab === "unverified" && c.source_type === "unverified") ||
      (activeTab === "pending" &&
        (c.status === "active" || c.status === "calling"));
    return matchSearch && matchTab;
  });

  // Reset page when tab or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedRows = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const statCards = [
    {
      label: "Total conversations",
      val: conversations.length,
      sub: "All interactions",
      icon: <MessageSquare size={17} />,
      tab: "all" as const,
    },
    {
      label: "Phone calls",
      val: totalCalls,
      sub: "Inbound + outbound",
      icon: <Phone size={17} />,
      tab: "calls" as const,
    },
    {
      label: "Web chats",
      val: totalChats,
      sub: "Text based sessions",
      icon: <MessageSquare size={17} />,
      tab: "chat" as const,
    },
    {
      label: "Voice chats",
      val: totalVoice,
      sub: "Browser mic sessions",
      icon: <Mic size={17} />,
      tab: "voice" as const,
    },
    {
      label: "Needs Review",
      val: totalUnverified,
      sub: totalUnverified > 0 ? "Pending source check" : "100% verified",
      icon: <AlertTriangle size={17} />,
      tab: "unverified" as const,
    },
  ];

  return (
    <>
      <div className={org.page}>
        {/* ── Executive Header ───────────────────────────────────────────── */}
        <div className={org.pageHeader}>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <MessageSquare className="h-6 w-6 text-emerald-600" />
              Customer Conversations
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {conversations.length} total
              </span>
              {isLoading && (
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
              )}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Cross-tenant communication logs: telephony voicebots, webchats & audio sessions
            </p>
          </div>
          <div className={org.toolbar}>
            <button
              onClick={() => {
                setIsSelecting(false);
                loadConvs();
              }}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(["all", "active", "archived"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${viewMode === mode ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {mode === "archived" && <Archive className="h-3.5 w-3.5" />}
                  {mode === "all" ? "All Records" : mode === "active" ? "Active" : "Archived"}
                </button>
              ))}
            </div>
            {!isSelecting && (
              <button
                onClick={() => setIsSelecting(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
              >
                <ListChecks className="h-3.5 w-3.5" /> Select
              </button>
            )}
          </div>
        </div>

        {/* Bulk bar */}
        {isSelecting && (
          <div className="flex items-center gap-4 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-lg">
            <button
              onClick={() => setIsSelecting(false)}
              aria-label="Cancel selection"
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold">
              {selectedIds.size} selected
            </span>
            <div className="w-px h-4 bg-slate-600" />
            <button
              onClick={toggleSelectAll}
              className="text-xs font-semibold text-slate-300 hover:text-white"
            >
              {selectedIds.size === conversations.length
                ? "Deselect All"
                : "Select All"}
            </button>
            <div className="ml-auto flex items-center gap-2">
              {!viewArchived && (
                <button
                  disabled={selectedIds.size === 0}
                  onClick={handleBulkArchive}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-40"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive (
                  {selectedIds.size})
                </button>
              )}
              <button
                disabled={selectedIds.size === 0}
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete ({selectedIds.size})
              </button>
            </div>
          </div>
        )}

        {/* ── Standard Clickable 5-Card KPI Grid ────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {statCards.map((s) => (
            <button
              key={s.label}
              onClick={() => {
                setActiveTab(s.tab);
                document
                  .getElementById("conv-table")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              aria-pressed={activeTab === s.tab}
              className={`${org.metricButton} ${s.tab === "unverified" && totalUnverified > 0 ? "!border-amber-300 !bg-amber-50/20" : ""}`}
            >
              <span className={`${org.metricIcon} ${s.tab === "unverified" && totalUnverified > 0 ? "!bg-amber-100 !text-amber-700" : ""}`}>
                {s.icon}
              </span>
              <span className={org.metricLabel}>{s.label}</span>
              <strong className={org.metricValue}>{s.val}</strong>
              <span className={org.metricSub}>{s.sub}</span>
            </button>
          ))}
        </div>

        {/* ── Table ── */}
        <div id="conv-table" className={org.tableSurface}>
          {/* Tabs + Search */}
          <div className={org.directoryToolbar}>
            <div
              className={org.sectionTabs}
              role="group"
              aria-label="Conversation type"
            >
              {(
                [
                  "all",
                  "calls",
                  "chat",
                  "voice",
                  "unverified",
                  "pending",
                ] as const
              ).map((tab) => {
                const counts = {
                  all: allRows.length,
                  calls: totalCalls,
                  chat: totalChats,
                  voice: totalVoice,
                  unverified: totalUnverified,
                  pending: allRows.filter(
                    (c) => c.status === "active" || c.status === "calling",
                  ).length,
                };
                const labels: Record<string, string> = {
                  all: "All",
                  calls: "Phone calls",
                  chat: "Web chats",
                  voice: "Voice chats",
                  unverified: "Review source",
                  pending: "Active sessions",
                };
                const icons = {
                  all: null,
                  calls: <Phone size={14} />,
                  chat: <MessageSquare size={14} />,
                  voice: <Mic size={14} />,
                  unverified: <Info size={14} />,
                  pending: <Activity size={14} />,
                };
                const tips: Record<string, string> = {
                  all: "All stored conversations",
                  calls: "Phone Calls",
                  chat: "Web Chat sessions",
                  voice: "Mic / voice sessions",
                  unverified: "Source has not been confirmed",
                  pending: "Still active sessions",
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    title={tips[tab]}
                    aria-pressed={activeTab === tab}
                    className={org.sectionTab}
                  >
                    {icons[tab]}
                    {labels[tab]}{" "}
                    <span className={org.tabCount}>{counts[tab]}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company, number, topic…"
                className="h-8 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-slate-400 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Table */}
          <div className={`${org.tableScroll} ${org.conversationTable}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {isSelecting && (
                    <th className="px-4 py-3 text-center w-10">
                      <button onClick={toggleSelectAll}>
                        {selectedIds.size === conversations.length ? (
                          <CheckSquare className="h-4 w-4 text-slate-700 mx-auto" />
                        ) : (
                          <Square className="h-4 w-4 mx-auto" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-5 py-3 text-left">Channel / Contact</th>
                  <th className="px-5 py-3 text-left">Company</th>
                  <th className="px-5 py-3 text-left">Title / Topic</th>
                  <th className="px-5 py-3 text-left">Messages</th>
                  <th className="px-5 py-3 text-left">Duration</th>
                  <th className="px-5 py-3 text-left">Cost</th>
                  <th className="px-5 py-3 text-left">Time</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right sticky right-0 bg-slate-50/80 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-6 py-12 text-center text-sm text-slate-400"
                    >
                      Loading conversations…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-16 text-center">
                      <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-600">
                        {loadError ? "Conversations temporarily unavailable" : "No conversations found"}
                      </p>
                      {loadError ? (
                        <div className="mt-3 flex flex-col items-center gap-2">
                          <p className="text-xs text-amber-700 max-w-sm">{loadError}</p>
                          <button
                            onClick={loadConvs}
                            className="mt-1 px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                          >
                            Retry Loading
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">
                          Inbound and outbound calls will appear here automatically.
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((conv) => {
                    const dur = conv.duration_seconds || 0;

                    const cost =
                      conv.source_type === "phone_call" && dur > 0
                        ? `₹${((dur / 60) * 1.5).toFixed(2)}`
                        : "—";
                    const isPinned = conv.is_pinned && !viewArchived;
                    const isPhone = conv.source_type === "phone_call";

                    return (
                      <tr
                        key={conv.id}
                        className={`transition-colors cursor-pointer ${isPinned ? "bg-amber-50/20" : "hover:bg-slate-50/70"} ${selectedIds.has(conv.id) ? "bg-blue-50/30" : ""}`}
                        onClick={() =>
                          !isSelecting &&
                          router.push(
                            `/admin/conversations/${conv.id}?companyId=${conv.company_id}`,
                          )
                        }
                      >
                        {isSelecting && (
                          <td
                            className="px-4 py-3.5 text-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(conv.id);
                            }}
                          >
                            {selectedIds.has(conv.id) ? (
                              <CheckSquare className="h-4 w-4 text-slate-800 mx-auto" />
                            ) : (
                              <Square className="h-4 w-4 text-slate-300 mx-auto" />
                            )}
                          </td>
                        )}
                        <td>
                          <div className={org.conversationContact}>
                            {isPinned && (
                              <Pin className="h-3 w-3 text-amber-500 shrink-0" />
                            )}
                            <ChannelBadge
                              d={isPhone ? conv.direction : conv.source_type}
                            />
                            {isPhone && (
                              <span className="text-xs text-slate-700">
                                {conv.contact_name ? (
                                  <>
                                    <span className="font-bold text-slate-900">{conv.contact_name}</span>{" "}
                                    <span className="font-mono text-[11px] text-slate-500">({conv.caller_phone})</span>
                                  </>
                                ) : (
                                  <span className="font-mono text-slate-600">{conv.caller_phone || "Unknown"}</span>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {companiesMap[conv.company_id] ? (
                            <span className="text-[12px] font-semibold text-slate-700">
                              {companiesMap[conv.company_id]}
                            </span>
                          ) : (
                            <span className="font-mono text-[11px] text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                              {conv.company_id?.slice(-8) || "—"}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 max-w-[160px]">
                          <p className="text-xs text-slate-600 truncate">
                            {conv.title ||
                              conv.last_message?.slice(0, 40) ||
                              "—"}
                          </p>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-bold text-slate-700">
                            {conv.actual_message_count || 0}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {conv.source_type === "unverified"
                                ? "—"
                                : formatDur(dur)}
                            </span>
                            {conv.recording_url && (
                              <span title="Audio recording available" className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                🎙️
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[11px] font-mono font-semibold text-slate-600">
                            {cost}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap">
                          {formatSystemDateTime(
                            conv.started_at || conv.created_at,
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col items-start gap-1.5">
                            <StatusDot
                              s={
                                conv.source_type === "unverified"
                                  ? "source-unverified"
                                  : conv.status
                              }
                            />
                            {[
                              "calling",
                              "ringing",
                              "active",
                              "in-progress",
                            ].includes(conv.status) && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="w-28 [&>div>button]:h-7 [&>div>button]:rounded [&>div>button]:px-1.5 [&>div>button]:text-[10px]"
                              >
                                <SmartSelect
                                  value=""
                                  onChange={(value) => {
                                    handleStatusUpdate(conv.company_id, conv.id, value);
                                  }}
                                  searchable={false}
                                  placeholder="Update Status"
                                  options={[
                                    {
                                      value: "completed",
                                      label: "Mark as Completed",
                                      badge: "Status",
                                      icon: <CheckCircle2 className="h-4 w-4" />,
                                    },
                                    {
                                      value: "failed",
                                      label: "Mark as Failed",
                                      badge: "Status",
                                      icon: <CircleX className="h-4 w-4" />,
                                    },
                                    {
                                      value: "cancelled",
                                      label: "Mark as Cancelled",
                                      badge: "Status",
                                      icon: <Ban className="h-4 w-4" />,
                                    },
                                    {
                                      value: "busy",
                                      label: "Mark as Busy",
                                      badge: "Status",
                                      icon: <PhoneMissed className="h-4 w-4" />,
                                    },
                                    {
                                      value: "no-answer",
                                      label: "Mark as No Answer",
                                      badge: "Status",
                                      icon: <PhoneMissed className="h-4 w-4" />,
                                    },
                                    {
                                      value: "hung-up",
                                      label: "Mark as Hung Up",
                                      badge: "Status",
                                      icon: <PhoneOff className="h-4 w-4" />,
                                    },
                                  ]}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td
                          className="text-right sticky right-0 bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.03)]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className={org.conversationActions}>
                            {!viewArchived &&
                              (isPinned ? (
                                <button
                                  onClick={() =>
                                    handleUnpin(conv.company_id, conv.id)
                                  }
                                  aria-label="Unpin conversation"
                                  className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Unpin"
                                >
                                  <PinOff className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    handlePin(conv.company_id, conv.id)
                                  }
                                  aria-label="Pin conversation"
                                  className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Pin"
                                >
                                  <Pin className="h-4 w-4" />
                                </button>
                              ))}
                            {!viewArchived && (
                              <button
                                onClick={() =>
                                  handleArchive(conv.company_id, conv.id)
                                }
                                aria-label="Archive conversation"
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Archive"
                              >
                                <Archive className="h-4 w-4" />
                              </button>
                            )}
                            {viewArchived && (
                              <button
                                onClick={() =>
                                  handleRestore(conv.company_id, conv.id)
                                }
                                aria-label="Restore conversation"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                title="Restore"
                              >
                                <RefreshCcw className="h-4 w-4" />
                              </button>
                            )}
                            {!viewArchived &&
                              (conv.status === "active" ||
                                conv.status === "calling") && (
                                <button
                                  onClick={() =>
                                    handleForceFail(conv.company_id, conv.id)
                                  }
                                  aria-label="Force end call"
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Force End Call"
                                >
                                  <PhoneOff className="h-4 w-4" />
                                </button>
                              )}
                            <button
                              onClick={() =>
                                handleDelete(conv.company_id, conv.id)
                              }
                              aria-label="Delete conversation"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer & Pagination */}
          <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filtered.length)} of{" "}
              {filtered.length} conversations
            </p>

            {/* Pagination Controls */}
            {totalPages > 0 && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Rows per page:</span>
                  <SmartSelect
                    value={String(itemsPerPage)}
                    onChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                    searchable={false}
                    className="w-20 [&>div>button]:h-7 [&>div>button]:rounded-md [&>div>button]:px-2 [&>div>button]:text-xs"
                    options={[10, 25, 50, 100].map((n) => ({
                      value: String(n),
                      label: String(n),
                    }))}
                  />
                </div>
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-sm">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    Prev
                  </button>
                  <div className="flex items-center border-x border-slate-100 px-1">
                    <input
                      type="number"
                      min={1}
                      max={totalPages}
                      value={currentPage}
                      onChange={(e) => {
                        let val = parseInt(e.target.value);
                        if (isNaN(val)) return;
                        if (val < 1) val = 1;
                        if (val > totalPages) val = totalPages;
                        setCurrentPage(val);
                      }}
                      className="w-10 h-6 text-center text-xs font-semibold text-slate-600 outline-none bg-transparent"
                    />
                    <span className="text-xs font-semibold text-slate-400 mr-2">
                      / {totalPages}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                {totalTurns.toLocaleString("en-IN")} stored messages · ₹
                {estCost} estimated call spend
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
