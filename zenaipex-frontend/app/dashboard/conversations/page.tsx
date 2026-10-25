"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { conversationsApi, Conversation } from "@/lib/api/conversations";
import { useCurrentCompany } from "@/hooks/use-company";
import {
  Loader2, Phone, Search, PhoneIncoming, PhoneOutgoing, Activity,
  ArrowRight, MessageSquare, Mic, Clock, Hash,
  BarChart2, Download, RefreshCw,
  MessageCircle, TrendingUp, Pin, PinOff, Trash2
} from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VoiceWaveDecoration } from "@/components/ui/decorative-backgrounds";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

function ChannelIcon({ direction, size = 4 }: { direction: string; size?: number }) {
  const cls = `h-${size} w-${size}`;
  if (direction === "inbound") return <PhoneIncoming className={`${cls} text-emerald-500`} />;
  if (direction === "outbound") return <PhoneOutgoing className={`${cls} text-amber-500`} />;
  if (direction === "test-chat") return <MessageSquare className={`${cls} text-indigo-500`} />;
  if (direction === "voice") return <Mic className={`${cls} text-purple-500`} />;
  return <Activity className={`${cls} text-slate-400`} />;
}

function ChannelBadge({ direction }: { direction: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    inbound:      { label: "Phone Inbound",  bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
    outbound:     { label: "Phone Outbound", bg: "bg-amber-50 border-amber-200",     text: "text-amber-700"  },
    "test-chat":  { label: "Web Chat",       bg: "bg-indigo-50 border-indigo-200",   text: "text-indigo-700" },
    voice:        { label: "Voice Agent",    bg: "bg-purple-50 border-purple-200",   text: "text-purple-700" },
  };
  const cfg = map[direction] || { label: direction, bg: "bg-slate-50 border-slate-200", text: "text-slate-600" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "completed") return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>Completed
    </span>
  );
  if (status === "active") return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
      </span>Active
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <span className="h-2 w-2 rounded-full bg-slate-300"></span>{status}
    </span>
  );
}

function formatDuration(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ConversationsPage() {
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "calls" | "chat" | "missed">("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (!companyId) {
      if (!isCompanyLoading) setIsLoading(false);
      return;
    }
    setIsLoading(true);
    conversationsApi.list(companyId)
      .then(res => setConversations(res.conversations || []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [companyId, isCompanyLoading, refreshKey]);

  const handlePin = async (id: string) => {
    if (!companyId) return;
    try {
      await conversationsApi.pin(companyId, id);
      setRefreshKey(k => k + 1);
    } catch (e) { console.error("Failed to pin", e); }
  };
  const handleUnpin = async (id: string) => {
    if (!companyId) return;
    try {
      await conversationsApi.unpin(companyId, id);
      setRefreshKey(k => k + 1);
    } catch (e) { console.error("Failed to unpin", e); }
  };
  const handleDelete = async (id: string) => {
    if (!companyId || !confirm("Delete this conversation permanently?")) return;
    try {
      await conversationsApi.delete(companyId, id);
      setRefreshKey(k => k + 1);
    } catch (e) { console.error("Failed to delete", e); }
  };

  const filtered = conversations.filter(c => {
    const matchSearch = !search ||
      (c.caller_phone || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.last_message || "").toLowerCase().includes(search.toLowerCase());
    const matchTab =
      activeTab === "all" ||
      (activeTab === "calls" && (c.direction === "inbound" || c.direction === "outbound")) ||
      (activeTab === "chat" && c.direction === "test-chat") ||
      (activeTab === "missed" && c.status !== "completed");
    return matchSearch && matchTab;
  });

  const totalCalls = conversations.filter(c => c.direction === "inbound" || c.direction === "outbound").length;
  const totalChats = conversations.filter(c => c.direction === "test-chat").length;
  const totalDurSec = conversations.reduce((a, b) => a + (b.duration_seconds || 0), 0);
  const avgDurSec = conversations.length ? Math.round(totalDurSec / conversations.length) : 0;
  const totalTurns = conversations.reduce((a, b) => a + (b.turn_count || 0), 0);

  if (isLoading || isCompanyLoading) {
    return <PageLoadingSkeleton cards={4} showTable />;
  }

  if (!companyId) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Conversations</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sage-50 text-sage-700 border border-sage-200">
              {conversations.length} total
            </span>
          </div>
          <p className="text-sm text-slate-500">Complete AI interaction history — calls, chats, and voice sessions.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" className="h-9 gap-2 bg-white" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 bg-white">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Phone Calls</p>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Phone className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalCalls}</p>
          <p className="text-xs text-slate-500 mt-1">Inbound & outbound</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Web Chats</p>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalChats}</p>
          <p className="text-xs text-slate-500 mt-1">Test & live sessions</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avg Duration</p>
            <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatDuration(avgDurSec)}</p>
          <p className="text-xs text-slate-500 mt-1">Per conversation</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Est. Cost</p>
            <div className="h-8 w-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <BarChart2 className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
          <p className="text-xs text-slate-500 mt-1">View actual spend in Usage &amp; Costs</p>
        </div>
      </div>

      {/* Table Card */}
      {conversations.length === 0 ? (
        <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-sage-200 bg-gradient-to-br from-[#E8F0EC] to-[#F4F7F6] py-24 shadow-sm">
          <VoiceWaveDecoration className="text-sage-700 opacity-[0.06]" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-sage-600 shadow-sm border border-sage-100">
              <MessageCircle className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">No conversations yet</h3>
            <p className="mt-2 max-w-sm text-center text-sm text-slate-500">
              Incoming calls and web chats will appear here automatically.
            </p>
            <div className="mt-8">
              <Link href="/dashboard/channels">
                <Button className="bg-sage-600 shadow-sm hover:bg-sage-700">
                  <Phone className="mr-2 h-4 w-4" /> Configure Channels
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <Card className="shadow-sm border-slate-200 overflow-hidden">
          {/* Tabs + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-white px-4 pt-3 pb-3 gap-3">
            <div className="flex gap-1">
              {(["all", "calls", "chat", "missed"] as const).map(tab => {
                const counts: Record<string, number> = {
                  all: conversations.length,
                  calls: conversations.filter(c => c.direction === "inbound" || c.direction === "outbound").length,
                  chat: conversations.filter(c => c.direction === "test-chat").length,
                  missed: conversations.filter(c => c.status !== "completed").length,
                };
                const labels: Record<string, string> = {
                  all: "All", calls: "📞 Calls", chat: "💬 Web Chats", missed: "⚠️ Pending"
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === tab
                        ? "bg-sage-50 text-sage-700 border border-sage-200"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {labels[tab]} ({counts[tab]})
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search number, topic…"
                className="h-8 w-56 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-sage-500 focus:ring-2 focus:ring-sage-100 transition"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 text-left">Channel / Contact</th>
                  <th className="px-5 py-3 text-left">Last Message / Topic</th>
                  <th className="px-5 py-3 text-left">Turns</th>
                  <th className="px-5 py-3 text-left">Duration</th>
                  <th className="px-5 py-3 text-left">Cost (₹)</th>
                  <th className="px-5 py-3 text-left">Time</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400 text-sm">
                      No conversations match your filter.
                    </td>
                  </tr>
                ) : filtered.map((conv) => {
                  const costRs = ((conv.duration_seconds || 0) / 60 * 1.5).toFixed(2);
                  const isPhone = conv.direction === "inbound" || conv.direction === "outbound";
                  const isChat = conv.direction === "test-chat";

                  return (
                    <tr 
                      key={conv.id} 
                      className="group hover:bg-sage-50/30 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/conversations/${conv.id}`)}
                    >
                      {/* Channel + Contact */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {conv.is_pinned && <Pin className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          <div className={`h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center ${
                            isPhone ? "bg-emerald-50 ring-1 ring-emerald-100" :
                            isChat  ? "bg-indigo-50 ring-1 ring-indigo-100" :
                                      "bg-slate-100 ring-1 ring-slate-200"
                          }`}>
                            <ChannelIcon direction={conv.direction} size={4} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-slate-900 font-mono text-[13px] leading-tight">
                              {isPhone
                                ? (conv.caller_phone || "Unknown Number")
                                : (conv.title ? conv.title.slice(0, 28) : "Web Chat Session")}
                            </span>
                            <div className="mt-0.5">
                              <ChannelBadge direction={conv.direction} />
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Last Message / Topic */}
                      <td className="px-5 py-4 max-w-[240px]">
                        <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">
                          {conv.last_message
                            ? conv.last_message.slice(0, 70) + (conv.last_message.length > 70 ? "…" : "")
                            : isPhone
                              ? "Voice call transcript available"
                              : "—"}
                        </p>
                      </td>

                      {/* Turns */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <Hash className="h-3 w-3 text-slate-300" />
                          <span className="font-bold text-slate-700">{conv.turn_count || 0}</span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-5 py-4">
                        <span className="font-mono text-slate-700 text-xs font-semibold">
                          {formatDuration(conv.duration_seconds)}
                        </span>
                      </td>

                      {/* Cost */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md">
                          ₹{costRs}
                        </span>
                      </td>

                      {/* Time */}
                      <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                        {formatRelativeTime(conv.started_at)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusDot status={conv.status} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {conv.is_pinned ? (
                            <button onClick={() => handleUnpin(conv.id)} className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Unpin"><PinOff className="h-4 w-4" /></button>
                          ) : (
                            <button onClick={() => handlePin(conv.id)} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Pin"><Pin className="h-4 w-4" /></button>
                          )}
                          <button onClick={() => handleDelete(conv.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Showing {filtered.length} of {conversations.length} conversations</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span>Total {totalTurns} turns · actual spend is in Usage &amp; Costs</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
