"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchApi, getCompanyLogoUrl } from "@/lib/api/client";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Database,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime, formatBytes } from "@/lib/utils";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

type KnowledgeBase = {
  id: string;
  company_id: string;
  company_name?: string;
  logo_url?: string;
  total_documents?: number;
  total_chunks?: number;
  created_at?: string;
};
type Document = {
  id: string;
  company_id: string;
  knowledge_base_id: string;
  company_name?: string;
  filename: string;
  status: "ready" | "processing" | "pending" | "failed";
  chunk_count?: number;
  file_size_bytes?: number;
  source_url?: string;
  updated_at?: string;
  created_at?: string;
  error_message?: string;
  version?: number;
  crawl_report?: {
    pages_discovered?: number;
    pages_scraped?: number;
    pages_skipped?: number;
    characters_extracted?: number;
    failed_pages?: Array<{ url: string; error: string }>;
  };
  crawl_options?: Record<string, unknown>;
};
type KnowledgeInsights = {
  documents: {
    total: number;
    ready: number;
    failed: number;
    processing: number;
    website_sources: number;
    total_chunks: number;
    duplicate_sources: number;
    missing_content: number;
  };
  retrieval: {
    total_searches: number;
    successful_searches: number;
    no_result_searches: number;
    success_rate: number | null;
    average_results: number;
    average_score: number | null;
  };
  governance: {
    versions: number;
    audit_events: number;
    access_control: string;
    source_validation: string;
  };
  failed_documents: Array<{ id: string; filename?: string; error?: string }>;
};

function CompanyMark({
  id,
  name,
  logoUrl,
}: {
  id: string;
  name: string;
  logoUrl?: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [failed, setFailed] = useState(false);
  const src = getCompanyLogoUrl(id, logoUrl || "current");
  return src && !failed ? (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className="h-9 w-9 rounded-xl object-cover ring-1 ring-emerald-100"
    />
  ) : (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
      {initials}
    </span>
  );
}
const statusStyles: Record<Document["status"], string> = {
  ready: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  processing: "bg-blue-50 text-blue-700 ring-blue-600/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
};

export default function AdminKnowledgePage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [insights, setInsights] = useState<KnowledgeInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | Document["status"]>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "website" | "file">(
    "all",
  );
  const [sortBy, setSortBy] = useState<"newest" | "largest" | "chunks">(
    "newest",
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reportDoc, setReportDoc] = useState<Document | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setIsRefreshing(true);
      setLoadError(null);
      const [kbRes, docRes] = await Promise.all([
        fetchApi<{ knowledge_bases: KnowledgeBase[] }>(
          "/admin/knowledge-bases",
        ),
        fetchApi<{ documents: Document[] }>("/admin/documents"),
      ]);
      setKbs(kbRes.knowledge_bases || []);
      setDocs(docRes.documents || []);
      try {
        setInsights(
          await fetchApi<KnowledgeInsights>("/admin/knowledge-insights"),
        );
      } catch {
        setInsights(null);
      }
    } catch (error) {
      console.error("Failed to load admin knowledge data", error);
      setLoadError(
        "Platform knowledge data could not be loaded. Check your access and try again.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);
  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredDocs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return docs
      .filter(
        (doc) =>
          (status === "all" || doc.status === status) &&
          (sourceFilter === "all" ||
            (sourceFilter === "website"
              ? Boolean(doc.source_url)
              : !doc.source_url)) &&
          (!needle ||
            [doc.filename, doc.company_name, doc.source_url].some((value) =>
              value?.toLowerCase().includes(needle),
            )),
      )
      .sort((a, b) =>
        sortBy === "chunks"
          ? (b.chunk_count || 0) - (a.chunk_count || 0)
          : sortBy === "largest"
            ? (b.file_size_bytes || 0) - (a.file_size_bytes || 0)
            : String(b.updated_at || b.created_at || "").localeCompare(
                String(a.updated_at || a.created_at || ""),
              ),
      );
  }, [docs, query, status, sourceFilter, sortBy]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => loadData(true), 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, loadData]);

  const toggleSelected = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  const runBulk = async (path: string, success: string) => {
    if (!selectedIds.length) return;
    try {
      await fetchApi(path, {
        method: "POST",
        body: JSON.stringify({ document_ids: selectedIds }),
      });
      setActionMessage(success);
      setSelectedIds([]);
      await loadData(true);
    } catch (error: any) {
      setActionMessage(
        error?.data?.detail || "Bulk operation failed. Please retry.",
      );
    }
  };
  const stats = useMemo(
    () => ({
      documents: docs.length,
      chunks: docs.reduce((sum, doc) => sum + (doc.chunk_count || 0), 0),
      ready: docs.filter((doc) => doc.status === "ready").length,
      attention: docs.filter((doc) =>
        ["failed", "processing", "pending"].includes(doc.status),
      ).length,
      websiteSources: docs.filter((doc) => Boolean(doc.source_url)).length,
    }),
    [docs],
  );

  if (isLoading) return <PageLoadingSkeleton cards={4} showTable />;
  if (loadError)
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-3xl border border-red-100 bg-red-50/50 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <div>
          <h2 className="font-semibold text-slate-900">
            Knowledge data unavailable
          </h2>
          <p className="mt-1 text-sm text-slate-600">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => loadData(true)}
          className="rounded-xl bg-sage-700 px-4 py-2 text-sm font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );

  const metrics = [
    [
      "Knowledge bases",
      kbs.length,
      Database,
      "Across tenant workspaces",
      "text-emerald-600",
      "bg-emerald-50",
    ],
    [
      "Documents",
      stats.documents,
      FileText,
      "Uploaded and website sources",
      "text-blue-600",
      "bg-blue-50",
    ],
    [
      "Indexed chunks",
      stats.chunks,
      BookOpen,
      "Available for retrieval",
      "text-violet-600",
      "bg-violet-50",
    ],
    [
      "Ready",
      stats.ready,
      CheckCircle2,
      "Healthy searchable sources",
      "text-emerald-600",
      "bg-emerald-50",
    ],
    [
      "Needs attention",
      stats.attention,
      TriangleAlert,
      `${stats.websiteSources} website sources`,
      "text-amber-600",
      "bg-amber-50",
    ],
  ] as const;

  return (
    <div className="min-h-full space-y-7 pb-10 animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-[28px] border border-emerald-950/10 bg-[#063b2a] p-6 text-white shadow-[0_22px_70px_rgba(6,59,42,.18)] sm:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-28 w-28 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#a7e6b8]">
              <Sparkles className="h-4 w-4" /> Knowledge workspace
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Knowledge control center
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50/80">
              Monitor every tenant knowledge base, crawl source, indexing status
              and vector health from one secure workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/20 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />{" "}
            Refresh data
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value, Icon, helper, color, bg]) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-3xl font-bold text-slate-950">
                  {value}
                </p>
              </div>
              <span className={`rounded-xl p-2.5 ${bg}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{helper}</p>
          </div>
        ))}
      </section>

      {insights && (
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Retrieval analytics
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  Knowledge usage
                </h2>
              </div>
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Searches</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {insights.retrieval.total_searches}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Success rate</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {insights.retrieval.success_rate === null
                    ? "No data"
                    : `${insights.retrieval.success_rate}%`}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">No-result queries</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {insights.retrieval.no_result_searches}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Avg. score</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {insights.retrieval.average_score ?? "No data"}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
              Content quality
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Index health
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Indexed chunks</span>
                <b>{insights.documents.total_chunks}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Duplicate sources</span>
                <b
                  className={
                    insights.documents.duplicate_sources
                      ? "text-amber-600"
                      : "text-emerald-700"
                  }
                >
                  {insights.documents.duplicate_sources}
                </b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Missing content</span>
                <b
                  className={
                    insights.documents.missing_content
                      ? "text-amber-600"
                      : "text-emerald-700"
                  }
                >
                  {insights.documents.missing_content}
                </b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Processing queue</span>
                <b>{insights.documents.processing}</b>
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Quality checks use stored document metadata and live retrieval
              events.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Governance
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Security & history
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Document versions</span>
                <b>{insights.governance.versions}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Audit events</span>
                <b>{insights.governance.audit_events}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Access control</span>
                <b className="text-emerald-700">
                  {insights.governance.access_control}
                </b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">URL validation</span>
                <b className="text-emerald-700">
                  {insights.governance.source_validation}
                </b>
              </div>
            </div>
            <Link
              href="/admin/logs"
              className="mt-4 inline-flex text-xs font-semibold text-emerald-700 hover:underline"
            >
              Open audit log →
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Tenant knowledge bases
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Workspace-level document and vector inventory.
            </p>
          </div>
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company or document..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Company workspace</th>
                <th className="px-6 py-4">Documents</th>
                <th className="px-6 py-4">Vectors</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4 text-right">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kbs
                .filter(
                  (kb) =>
                    !query ||
                    kb.company_name
                      ?.toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((kb) => (
                  <tr key={kb.id} className="transition hover:bg-emerald-50/30">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/knowledge/companies/${kb.company_id}`}
                        className="flex items-center gap-3 font-semibold text-slate-900 hover:text-emerald-700"
                      >
                        <CompanyMark
                          id={kb.company_id}
                          name={kb.company_name || "Unnamed workspace"}
                          logoUrl={kb.logo_url}
                        />
                        <span>
                          {kb.company_name || "Unnamed workspace"}
                          <span className="mt-1 block font-mono text-[10px] font-normal text-slate-400">
                            {kb.company_id}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {kb.total_documents || 0}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {kb.total_chunks || 0}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {kb.created_at ? formatRelativeTime(kb.created_at) : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/knowledge/companies/${kb.company_id}`}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      >
                        View workspace →
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 p-4 md:hidden">
          {kbs.map((kb) => (
            <Link
              key={kb.id}
              href={`/admin/knowledge/companies/${kb.company_id}`}
              className="rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
                  <CompanyMark
                    id={kb.company_id}
                    name={kb.company_name || "Unnamed workspace"}
                    logoUrl={kb.logo_url}
                  />
                  {kb.company_name || "Unnamed workspace"}
                </span>
                <ExternalLink className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span>{kb.total_documents || 0} documents</span>
                <span>{kb.total_chunks || 0} vectors</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Platform documents
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Track indexing, crawl sources and documents requiring attention.
              </p>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {(["all", "ready", "processing", "failed"] as const).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStatus(item)}
                    className={`whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold capitalize shadow-sm transition ${status === item ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"}`}
                  >
                    {item === "all" ? `All ${docs.length}` : item}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setAutoRefresh((value) => !value)}
                className={`whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-sm transition ${autoRefresh ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"}`}
              >
                {autoRefresh ? "Auto-refresh on" : "Auto-refresh"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative inline-flex items-center">
              <span className="sr-only">Source filter</span>
              <select
                value={sourceFilter}
                onChange={(e) =>
                  setSourceFilter(e.target.value as typeof sourceFilter)
                }
                className="h-10 appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs font-semibold text-slate-700 shadow-sm outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
              >
                <option value="all">All sources</option>
                <option value="website">Website URLs</option>
                <option value="file">Uploaded files</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
            </label>
            <label className="relative inline-flex items-center">
              <span className="sr-only">Sort documents</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-10 appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs font-semibold text-slate-700 shadow-sm outline-none transition hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
              >
                <option value="newest">Newest first</option>
                <option value="largest">Largest files</option>
                <option value="chunks">Most chunks</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
            </label>
            <button
              type="button"
              onClick={() => setSelectedIds(filteredDocs.map((doc) => doc.id))}
              className="h-10 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              Select visible
            </button>
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    runBulk(
                      "/admin/documents/bulk-reprocess",
                      "Selected documents queued for reprocessing.",
                    )
                  }
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Reprocess {selectedIds.length}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${selectedIds.length} selected documents?`,
                      )
                    )
                      runBulk(
                        "/admin/documents/bulk-delete",
                        "Selected documents deleted.",
                      );
                  }}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Delete selected
                </button>
              </>
            )}
          </div>
          {actionMessage && (
            <p className="text-xs font-medium text-emerald-700">
              {actionMessage}
            </p>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-4 p-5 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => toggleSelected(doc.id)}
                  aria-label={`Select ${doc.filename}`}
                  className={`mt-1 h-4 w-4 rounded border ${selectedIds.includes(doc.id) ? "border-emerald-600 bg-emerald-600" : "border-slate-300 bg-white"}`}
                />
                <span className="mt-0.5 rounded-xl bg-slate-100 p-2.5 text-slate-600">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/admin/knowledge/companies/${doc.company_id}/kbs/${doc.knowledge_base_id}/documents/${doc.id}`}
                    className="block truncate font-semibold text-slate-900 hover:text-emerald-700"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{doc.company_name || "Unknown company"}</span>
                    <span>·</span>
                    <span>{doc.chunk_count || 0} chunks</span>
                    <span>·</span>
                    <span>{formatBytes(doc.file_size_bytes || 0)}</span>
                    {doc.source_url && (
                      <span className="inline-flex max-w-[260px] items-center gap-1 truncate rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                        <ExternalLink className="h-3 w-3" /> Website URL
                      </span>
                    )}
                  </div>
                  {doc.error_message && (
                    <p
                      className="mt-1 truncate text-xs text-red-600"
                      title={doc.error_message}
                    >
                      {doc.error_message}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${statusStyles[doc.status]}`}
                >
                  {doc.status}
                </span>
                <button
                  type="button"
                  onClick={() => setReportDoc(doc)}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  View health report
                </button>
                <span className="text-xs text-slate-400">
                  Updated{" "}
                  {doc.updated_at
                    ? formatRelativeTime(doc.updated_at)
                    : "recently"}
                </span>
              </div>
            </div>
          ))}
          {filteredDocs.length === 0 && (
            <div className="p-12 text-center text-sm text-slate-500">
              No documents match the current filters.
            </div>
          )}
        </div>
      </section>

      {reportDoc && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-sm"
          onClick={() => setReportDoc(null)}
        >
          <aside
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Document health
                </p>
                <h3 className="mt-1 break-all text-xl font-bold text-slate-900">
                  {reportDoc.filename}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReportDoc(null)}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                ["Status", reportDoc.status],
                ["Version", reportDoc.version || 1],
                ["Chunks", reportDoc.chunk_count || 0],
                ["Size", formatBytes(reportDoc.file_size_bytes || 0)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-[11px] font-semibold uppercase text-slate-500">
                    {label}
                  </p>
                  <p className="mt-1 font-bold text-slate-900">{value}</p>
                </div>
              ))}
            </div>
            {reportDoc.crawl_report ? (
              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <h4 className="font-semibold text-slate-900">
                  Website crawl report
                </h4>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <span>
                    Discovered{" "}
                    <b>{reportDoc.crawl_report.pages_discovered || 0}</b>
                  </span>
                  <span>
                    Scraped <b>{reportDoc.crawl_report.pages_scraped || 0}</b>
                  </span>
                  <span>
                    Skipped <b>{reportDoc.crawl_report.pages_skipped || 0}</b>
                  </span>
                  <span>
                    Characters{" "}
                    <b>{reportDoc.crawl_report.characters_extracted || 0}</b>
                  </span>
                </div>
                {(reportDoc.crawl_report.failed_pages || []).length > 0 && (
                  <div className="mt-4 border-t border-blue-100 pt-3">
                    <p className="text-xs font-semibold text-red-700">
                      Failed pages
                    </p>
                    {reportDoc.crawl_report.failed_pages?.map((page) => (
                      <p
                        key={page.url}
                        className="mt-1 truncate text-xs text-slate-600"
                        title={page.url}
                      >
                        {page.url} · {page.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Uploaded file source. No website crawl report is available.
              </div>
            )}
            <div className="mt-6 flex gap-2">
              <a
                href={`/admin/knowledge/companies/${reportDoc.company_id}/kbs/${reportDoc.knowledge_base_id}/documents/${reportDoc.id}`}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Open document
              </a>
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard)
                    navigator.clipboard.writeText(
                      JSON.stringify(reportDoc, null, 2),
                    );
                  setActionMessage("Document report copied.");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Export report
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
