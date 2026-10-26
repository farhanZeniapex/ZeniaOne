"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchApi } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  ClipboardList, Loader2, Search, X, ChevronDown, ChevronUp,
  FileText, Trash2, CheckCircle2, Settings, User,
  Building2, Zap, Activity, Bot, RefreshCw, ShieldCheck, SlidersHorizontal, ChevronLeft, ChevronRight
} from "lucide-react";

// ── 12-hour timestamp (uses browser local timezone, handles legacy naive UTC) ─
function formatLogTime(raw: string | null | undefined): string {
  if (!raw) return "—";
  const str = String(raw);
  const d = !str.endsWith("Z") && !str.match(/(\+|-)\d{2}:?\d{2}$/)
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

// ── Action → human label + badge colour ──────────────────────────────────────
type ActionMeta = { label: string; color: string; icon: React.ElementType };

const ACTION_MAP: Record<string, ActionMeta> = {
  test_chat_started:  { label: "AI Chat Started",    color: "bg-[#E8F0EC] text-[#43584F] border-[#C5D8CC]",  icon: Bot },
  document_uploaded:  { label: "Document Uploaded",  color: "bg-blue-50 text-blue-700 border-blue-200",       icon: FileText },
  document_processed: { label: "Document Processed", color: "bg-green-50 text-green-700 border-green-200",    icon: CheckCircle2 },
  document_deleted:   { label: "Document Deleted",   color: "bg-red-50 text-red-700 border-red-200",          icon: Trash2 },
  company_created:    { label: "Company Created",    color: "bg-purple-50 text-purple-700 border-purple-200", icon: Building2 },
  company_updated:    { label: "Company Updated",    color: "bg-amber-50 text-amber-700 border-amber-200",    icon: Building2 },
  user_created:       { label: "User Created",       color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: User },
  provider_enabled:   { label: "Provider Enabled",   color: "bg-green-50 text-green-700 border-green-200",    icon: Zap },
  provider_disabled:  { label: "Provider Disabled",  color: "bg-slate-100 text-slate-600 border-slate-300",   icon: Zap },
  provider_routing_updated: { label: "Runtime Routing Updated", color: "bg-[#DCF7E4] text-[#177445] border-[#BCE4C8]", icon: Activity },
  settings_updated:   { label: "Settings Updated",   color: "bg-amber-50 text-amber-700 border-amber-200",    icon: Settings },
  agent_created:      { label: "Agent Created",      color: "bg-[#E8F0EC] text-[#43584F] border-[#C5D8CC]",  icon: Bot },
  agent_updated:      { label: "Agent Updated",      color: "bg-amber-50 text-amber-700 border-amber-200",    icon: Bot },
};

function getActionMeta(action: string | null | undefined): ActionMeta {
  if (!action) return { label: "Unknown", color: "bg-slate-100 text-slate-500 border-slate-200", icon: Activity };
  const meta = ACTION_MAP[action.toLowerCase()];
  if (meta) return meta;
  const label = action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return { label, color: "bg-slate-100 text-slate-600 border-slate-200", icon: Activity };
}

// ── Short human-readable event summary ───────────────────────────────────────
function humanSummary(action: string | null | undefined, target: string | null | undefined, details: string | null | undefined): string {
  const a = (action ?? "").toLowerCase();
  if (a === "test_chat_started")  return target ? `Started an AI chat session with "${target}"` : "Started a new AI chat session";
  if (a === "document_uploaded")  return target ? `Uploaded "${target}"` : "Uploaded a document";
  if (a === "document_processed") return target ? `Finished processing "${target}"` : "Document processing completed";
  if (a === "document_deleted")   return target ? `Deleted "${target}"` : "Deleted a document";
  if (a === "company_created")    return target ? `Created company "${target}"` : "Created a new company";
  if (a === "company_updated")    return target ? `Updated company "${target}"` : "Updated company settings";
  if (a === "user_created")       return target ? `Created user "${target}"` : "Created a new user";
  if (a === "provider_enabled")   return target ? `Enabled AI provider "${target}"` : "Enabled an AI provider";
  if (a === "provider_disabled")  return target ? `Disabled AI provider "${target}"` : "Disabled an AI provider";
  if (a === "provider_routing_updated") return "Updated the primary provider and fallback routing plan";
  if (a === "settings_updated")   return "Platform settings were updated";
  if (a === "agent_created")      return target ? `Created AI agent "${target}"` : "Created a new AI agent";
  if (a === "agent_updated")      return target ? `Updated AI agent "${target}"` : "Updated an AI agent";
  if (details && details.length < 120) return details;
  return target ? `${(action ?? "").replace(/_/g, " ")} — ${target}` : (action ?? "").replace(/_/g, " ");
}

// ── Single log row with collapsible technical details ────────────────────────
function LogRow({ log }: { log: Record<string, string | null | undefined> }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getActionMeta(log.action);
  const Icon = meta.icon;
  const summary = humanSummary(log.action, log.target, log.details);
  const hasDetails = !!(log.details || log.target);

  return (
    <>
      <tr className="hover:bg-slate-50/60 transition-colors">
        {/* Time */}
        <td className="px-5 py-3.5 text-xs text-slate-400 whitespace-nowrap align-top pt-4 tabular-nums">
          {formatLogTime(log.created_at)}
        </td>

        {/* Who */}
        <td className="px-5 py-3.5 align-top pt-4 max-w-[160px]">
          <div className="text-sm font-semibold text-slate-800 truncate">{log.actor_name || "System"}</div>
          {log.actor_email && <div className="text-xs text-slate-400 truncate">{log.actor_email}</div>}
        </td>

        {/* What happened */}
        <td className="px-5 py-3.5 align-top pt-4 max-w-sm">
          <span className={cn(
            "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap",
            meta.color
          )}>
            <Icon className="h-3 w-3 shrink-0" />
            {meta.label}
          </span>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{summary}</p>
        </td>

        {/* Details toggle */}
        <td className="px-5 py-3.5 align-top pt-4 w-24">
          {hasDetails ? (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs font-medium text-[#5F786D] hover:text-[#43584F] transition-colors focus:outline-none"
              aria-expanded={expanded}
            >
              {expanded
                ? <><ChevronUp className="h-3.5 w-3.5" />Hide</>
                : <><ChevronDown className="h-3.5 w-3.5" />View</>}
            </button>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-slate-50/80">
          <td colSpan={4} className="px-5 py-3 border-t border-slate-100">
            <div className="space-y-1.5 text-xs font-mono">
              {log.target && (
                <div className="flex gap-3">
                  <span className="text-slate-400 w-14 shrink-0">Target</span>
                  <span className="text-slate-600 break-all">{log.target}</span>
                </div>
              )}
              {log.details && (
                <div className="flex gap-3">
                  <span className="text-slate-400 w-14 shrink-0">Notes</span>
                  <span className="text-slate-600 break-all">{log.details}</span>
                </div>
              )}
              {log.action && (
                <div className="flex gap-3">
                  <span className="text-slate-400 w-14 shrink-0">Event</span>
                  <span className="text-slate-500">{log.action}</span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminLogsPage() {
  const [logs, setLogs] = useState<Record<string, string | null | undefined>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const loadLogs = async (targetPage = page) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ page: String(targetPage), page_size: String(pageSize) });
        if (actionFilter !== "all") params.set("action", actionFilter);
        if (search.trim()) params.set("search", search.trim());
        const data = await fetchApi<{ logs: Record<string, string | null | undefined>[]; total?: number; total_pages?: number; page?: number }>(`/admin/logs?${params}`);
        setLogs(data.logs || []);
        setTotal(data.total ?? data.logs?.length ?? 0);
        setTotalPages(data.total_pages ?? 1);
        setPage(data.page ?? targetPage);
      } catch (err) {
        console.error("Failed to load logs", err);
      } finally {
        setIsLoading(false);
      }
  };
  useEffect(() => { loadLogs(1); }, [actionFilter, pageSize]);

  const filtered = useMemo(() => {
    return logs;
  }, [logs, search]);

  const goToPage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === page) return;
    loadLogs(targetPage);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <section className="relative overflow-hidden rounded-[28px] border border-[#CBE0D1] bg-[#0A2D20] px-6 py-7 text-white shadow-[0_22px_70px_rgba(11,46,33,.16)] sm:px-8"><div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-[#8BE2AD]/25 blur-3xl"/><div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#A7E6B8]"><ShieldCheck size={14}/> Auditable platform history</div><h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1><p className="mt-2 text-sm text-[#C7DBCF]">A searchable audit trail of provider routing, security, document, agent, and system changes.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#B8DCC1]">Total events</p><p className="mt-1 text-2xl font-bold">{total.toLocaleString()}</p></div></div></section>
      {/* Header + search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Filter events</h2>
          <p className="text-slate-500 mt-0.5 text-sm">Search details or focus on one high-impact event type.</p>
        </div>
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by who, what, or where…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") loadLogs(1); }}
            className="pl-9 pr-9 py-2 border border-slate-200 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5F786D]/30 focus:border-[#5F786D] w-full sm:w-72 shadow-sm transition"
          />
          {search && (
            <button
              onClick={() => { setSearch(""); loadLogs(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#D9E7DD] bg-white p-3 shadow-sm"><span className="mr-1 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wider text-[#5C786A]"><SlidersHorizontal size={14}/> Event type</span>{[["all", "All events"], ["provider_routing_updated", "Routing"], ["settings_updated", "Settings"], ["provider_enabled", "Provider enabled"], ["provider_disabled", "Provider disabled"], ["agent_updated", "Agents"], ["document_processed", "Documents"]].map(([id, label]) => <button key={id} onClick={() => setActionFilter(id)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${actionFilter === id ? "bg-[#0C4A31] text-white" : "bg-[#F2F7F3] text-[#527764] hover:bg-[#E1F0E5]"}`}>{label}</button>)}<label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-500">Per page<select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="rounded-lg border border-[#CFE1D4] bg-white px-2 py-1.5 text-xs font-bold text-[#286044]"><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select></label><button onClick={() => loadLogs(page)} className="flex items-center gap-1.5 rounded-lg border border-[#CFE1D4] px-3 py-1.5 text-xs font-bold text-[#286044] hover:bg-[#F4FAF5]"><RefreshCw size={14}/>Refresh</button></div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-3.5 whitespace-nowrap">Time</th>
              <th className="px-5 py-3.5">Who</th>
              <th className="px-5 py-3.5">What happened</th>
              <th className="px-5 py-3.5">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  <span className="text-sm">Loading activity logs…</span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center">
                  <ClipboardList className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">
                    {search ? `No activity found for "${search}"` : "No activity logs found."}
                  </p>
                  {search && (
                    <button onClick={() => setSearch("")} className="mt-2 text-xs text-[#5F786D] hover:underline">
                      Clear search
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map(log => <LogRow key={String(log.id)} log={log} />)
            )}
          </tbody>
        </table>

        {!isLoading && total > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-400">
              Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total.toLocaleString()} events
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#9CC7A8]"><ChevronLeft className="h-3.5 w-3.5" /> Previous</button>
              <span className="min-w-20 text-center text-xs font-bold text-slate-600">Page {page} / {totalPages}</span>
              <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#9CC7A8]">Next <ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
