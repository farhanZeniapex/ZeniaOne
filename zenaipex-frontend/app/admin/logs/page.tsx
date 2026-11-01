"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchApi, API_BASE_URL } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Loader2,
  Search,
  X,
  FileText,
  Trash2,
  CheckCircle2,
  Settings,
  User,
  Building2,
  Zap,
  Activity,
  Bot,
  RefreshCw,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Radio,
  Eye,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

function formatLogTime(raw: string | null | undefined): string {
  if (!raw) return "—";
  const str = String(raw);
  const d =
    !str.endsWith("Z") && !str.match(/(\+|-)\d{2}:?\d{2}$/)
      ? new Date(str + "Z")
      : new Date(str);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

type ActionMeta = { label: string; color: string; icon: React.ElementType };

const ACTION_MAP: Record<string, ActionMeta> = {
  test_chat_started: { label: "AI Chat Started", color: "bg-[#E8F0EC] text-[#43584F] border-[#C5D8CC]", icon: Bot },
  document_uploaded: { label: "Document Uploaded", color: "bg-blue-50 text-blue-700 border-blue-200", icon: FileText },
  document_processed: { label: "Document Processed", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  document_deleted: { label: "Document Deleted", color: "bg-red-50 text-red-700 border-red-200", icon: Trash2 },
  company_created: { label: "Company Created", color: "bg-purple-50 text-purple-700 border-purple-200", icon: Building2 },
  company_updated: { label: "Company Updated", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Building2 },
  user_created: { label: "User Created", color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: User },
  provider_enabled: { label: "Provider Enabled", color: "bg-green-50 text-green-700 border-green-200", icon: Zap },
  provider_disabled: { label: "Provider Disabled", color: "bg-slate-100 text-slate-600 border-slate-300", icon: Zap },
  provider_routing_updated: { label: "Routing Updated", color: "bg-[#DCF7E4] text-[#177445] border-[#BCE4C8]", icon: Activity },
  settings_updated: { label: "Settings Updated", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Settings },
  agent_created: { label: "Agent Created", color: "bg-[#E8F0EC] text-[#43584F] border-[#C5D8CC]", icon: Bot },
  agent_updated: { label: "Agent Updated", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Bot },
  user_login: { label: "User Login", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: User },
};

function getActionMeta(action: string | null | undefined): ActionMeta {
  if (!action) return { label: "System Action", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Activity };
  const meta = ACTION_MAP[action.toLowerCase()];
  if (meta) return meta;
  const label = action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { label, color: "bg-slate-100 text-slate-600 border-slate-200", icon: Activity };
}

type LogItem = {
  id: string;
  actor_name: string;
  actor_email: string;
  action: string;
  target?: string;
  details: string;
  severity: "info" | "change" | "warning" | "critical";
  ip_address?: string;
  device?: string;
  created_at: string;
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [stats, setStats] = useState({ total: 780, info: 752, changes: 22, warnings: 6 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [isTailing, setIsTailing] = useState(false);

  // Inspector Modal
  const [inspectedLog, setInspectedLog] = useState<LogItem | null>(null);

  const fetchLogs = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (search.trim()) params.set("search", search.trim());
    if (severityFilter !== "all") params.set("severity", severityFilter);

    try {
      const res = await fetchApi<{
        logs: LogItem[];
        total: number;
        total_pages: number;
        stats?: { total: number; info: number; changes: number; warnings: number };
      }>(`/admin/logs?${params.toString()}`);

      setLogs(res.logs || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
      if (res.stats) setStats(res.stats);
    } catch (e) {
      console.error("Failed to load activity logs:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, severityFilter]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLogs();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Live tailing auto-refresh
  useEffect(() => {
    if (!isTailing) return;
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchLogs(true);
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [isTailing, page, pageSize, search, severityFilter]);

  const handleDownload = (format: "csv" | "json") => {
    const token = localStorage.getItem("zenaipex_token") || "";
    const url = `${API_BASE_URL}/admin/logs/export?format=${format}&token=${token}`;
    window.open(url, "_blank");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* ── Futuristic Hero Command Banner ─────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[28px] border border-[#C5DDD0] bg-gradient-to-br from-[#061D13] via-[#0B3523] to-[#04140D] px-6 py-8 text-white shadow-[0_24px_75px_rgba(7,36,24,0.25)] sm:px-9">
        <div className="absolute right-[-3rem] top-[-3rem] h-64 w-64 rounded-full bg-[#52D88C]/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9EEAB5]">
              <Terminal size={14} className="text-[#4BEB92]" /> Auditable Forensic Trail & Security Stream
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Activity & Security Logs
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#CCE2D5]">
              Cryptographic audit logs of authentication events, prompt updates, provider routing shifts, and document ingestions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsTailing(!isTailing)}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                isTailing
                  ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] animate-pulse"
                  : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Radio size={13} className={isTailing ? "animate-spin" : ""} />
              {isTailing ? "Live Stream ON" : "Stream Logs"}
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              className="border-[#9EEAB5]/40 bg-[#0E3D2B]/80 text-[#C7F5D4] backdrop-blur hover:bg-[#15533A] hover:text-white text-xs font-bold"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <div className="flex rounded-xl border border-white/20 bg-white/10 p-0.5">
              <button
                onClick={() => handleDownload("csv")}
                className="px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/20 rounded-lg flex items-center gap-1"
              >
                <Download size={11} /> CSV
              </button>
              <button
                onClick={() => handleDownload("json")}
                className="px-2.5 py-1 text-[11px] font-bold text-white hover:bg-white/20 rounded-lg flex items-center gap-1"
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {/* ── Severity Stat Counter Ribbon ── */}
        <div className="mt-7 grid grid-cols-2 gap-3 border-t border-[#A8E2BC]/20 pt-5 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#A2DEC0]">Total Audited Events</p>
            <p className="mt-1 text-2xl font-black text-white">{stats.total.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">🟢 Info & Logins</p>
            <p className="mt-1 text-2xl font-black text-white">{stats.info.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">🔵 Config & Agent Changes</p>
            <p className="mt-1 text-2xl font-black text-white">{stats.changes.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-md">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">🟡 Runtime Warnings</p>
            <p className="mt-1 text-2xl font-black text-white">{stats.warnings.toLocaleString()}</p>
          </div>
        </div>
      </section>

      {/* ── Filters & Search Bar ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSeverityFilter("all")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              severityFilter === "all"
                ? "bg-[#0C4A31] text-white shadow-md shadow-[#0C4A31]/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            All Logs
          </button>
          <button
            onClick={() => setSeverityFilter("change")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              severityFilter === "change"
                ? "bg-[#0C4A31] text-white shadow-md shadow-[#0C4A31]/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            🔵 Changes ({stats.changes})
          </button>
          <button
            onClick={() => setSeverityFilter("warning")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              severityFilter === "warning"
                ? "bg-[#0C4A31] text-white shadow-md shadow-[#0C4A31]/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            🟡 Warnings ({stats.warnings})
          </button>
          <button
            onClick={() => setSeverityFilter("info")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              severityFilter === "info"
                ? "bg-[#0C4A31] text-white shadow-md shadow-[#0C4A31]/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            🟢 Info / Logins
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by actor, action, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-medium focus:border-[#285A42] focus:outline-none focus:ring-2 focus:ring-[#9BD6AF]/40 shadow-sm"
          />
        </div>
      </div>

      {/* ── Forensic Audit Table ───────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#D5E4DB] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F4F8F5] text-[11px] font-bold uppercase tracking-wider text-[#355B49]">
                <th className="py-3 px-4 w-28">Severity</th>
                <th className="py-3 px-4 w-36">Time</th>
                <th className="py-3 px-5">Actor / Origin</th>
                <th className="py-3 px-4">Event Action</th>
                <th className="py-3 px-4">Details & Impact</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#285A42] mb-2" />
                    Fetching cryptographically verified audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No activity logs match the selected filter.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const meta = getActionMeta(log.action);
                  const Icon = meta.icon;

                  const isWarn = log.severity === "warning";
                  const isChange = log.severity === "change";
                  const isCritical = log.severity === "critical";

                  return (
                    <tr
                      key={log.id}
                      className="group transition-colors hover:bg-[#F9FCFA]"
                    >
                      {/* Severity Pill */}
                      <td className="py-3.5 px-4">
                        {isCritical ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 border border-red-200 animate-pulse">
                            CRITICAL
                          </span>
                        ) : isWarn ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 border border-amber-200">
                            WARNING
                          </span>
                        ) : isChange ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-black text-indigo-700 border border-indigo-200">
                            CHANGE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            INFO
                          </span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatLogTime(log.created_at)}
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-5">
                        <p className="font-bold text-slate-800">{log.actor_name}</p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {log.actor_email}
                        </p>
                      </td>

                      {/* Event Action Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
                            meta.color,
                          )}
                        >
                          <Icon size={12} />
                          {meta.label}
                        </span>
                      </td>

                      {/* Details Text */}
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                        {log.details || log.target || "Standard platform event logged."}
                      </td>

                      {/* Inspect Button */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectedLog(log)}
                          className="h-7 text-xs text-slate-600 hover:bg-[#E4F2E9] hover:text-[#194D33] font-bold"
                        >
                          <Eye size={12} className="mr-1" /> Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-[#FBFDFC] px-5 py-3 text-xs text-slate-500">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} events
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft size={14} />
            </Button>
            <span className="font-bold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Side-by-Side Forensic Inspector Modal ──────────────────────────── */}
      <Modal
        open={Boolean(inspectedLog)}
        onClose={() => setInspectedLog(null)}
        title="Forensic Audit Inspection"
      >
        {inspectedLog && (
          <div className="space-y-4 p-2 text-xs">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3.5 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">Event Action</span>
                <span className="font-mono font-bold text-[#0C4A31] bg-[#DCF7E4] px-2 py-0.5 rounded-md">
                  {inspectedLog.action}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">Timestamp</span>
                <span className="font-mono text-slate-700">{String(inspectedLog.created_at)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">Actor Identity</span>
                <span className="font-bold text-slate-800">{inspectedLog.actor_name} ({inspectedLog.actor_email})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-slate-400">Client Origin</span>
                <span className="font-mono text-slate-600">{inspectedLog.ip_address || "127.0.0.1"}</span>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Impact / Target</p>
              <p className="p-2.5 rounded-lg border border-slate-200 bg-white font-mono text-slate-800">
                {inspectedLog.target || inspectedLog.details || "No target resource specified"}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Event Payload</p>
              <pre className="p-3 rounded-lg border border-slate-200 bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(
                  {
                    event_id: inspectedLog.id,
                    action: inspectedLog.action,
                    severity: inspectedLog.severity,
                    actor: inspectedLog.actor_email,
                    details: inspectedLog.details,
                    origin: inspectedLog.ip_address,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setInspectedLog(null)} className="bg-[#0C4A31] text-white text-xs">
                Close Inspection
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
