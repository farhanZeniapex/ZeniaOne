"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi, API_BASE_URL, getCompanyLogoUrl } from "@/lib/api/client";
import { useBranding } from "@/hooks/use-branding";
import { formatSystemDateTime } from "@/lib/utils";
import { OverviewKpiCard } from "@/components/dashboard/overview/overview-kpi-card";
import {
  Building2,
  Phone,
  MessageSquare,
  Activity,
  Bot,
  Zap,
  Coins,
  Server,
  Database,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  Info,
  AlertTriangle,
  FileWarning,
  Plus,
  Upload,
  Settings2,
  Gauge,
} from "lucide-react";
import { OverviewActivityChart } from "@/components/dashboard/overview/overview-activity-chart";
import { OverviewRecentActivity } from "@/components/dashboard/overview/overview-recent-activity";
import { type ProviderUsageItem } from "@/components/dashboard/overview/overview-ai-analytics";
import styles from "./overview.module.css";

type Metrics = {
  total_companies?: number;
  total_agents?: number;
  total_conversations?: number;
  total_llm_calls?: number;
  total_call_minutes?: number;
  total_tokens?: number;
  total_cost?: number | null;
};
type Company = {
  id: string;
  name: string;
  industry?: string;
  country?: string;
  plan?: string;
  logo_url?: string;
};
type AdminLog = {
  id: string;
  actor_name?: string;
  actor_email?: string;
  action?: string;
  target?: string;
  created_at: string;
};
type Health = { status?: string; database?: string };
type DailyUsage = { success?: number; failed?: number };
type Trend = {
  ai_requests?: { date: string; count: number }[];
  daily_llm?: DailyUsage[];
  failure_reasons?: { reason: string; count: number }[];
};
type KnowledgeInsight = {
  documents?: { total?: number; ready?: number; failed?: number; processing?: number; missing_content?: number };
  retrieval?: { success_rate?: number | null };
};

export default function AdminDashboardPage() {
  const { platformName } = useBranding();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentCompanies, setRecentCompanies] = useState<Company[]>([]);
  const [recentLogs, setRecentLogs] = useState<AdminLog[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeInsight | null>(null);

  // Analytics state
  const [trends, setTrends] = useState<Trend | null>(null);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [unifiedProviders, setUnifiedProviders] = useState<ProviderUsageItem[]>(
    [],
  );
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError("");
        setIsRefetching(true);

        const m = await fetchApi<Metrics>(`/admin/metrics?days=${days}`);
        if (!cancelled) {
          setMetrics(m);
          // Render the KPI cards as soon as the primary request finishes.
          // The remaining dashboard panels hydrate in the background.
          setIsLoading(false);
        }

        const [comps, logs, h, t, b, k] = await Promise.all([
          fetchApi<{ companies?: Company[] }>("/admin/companies?limit=5"),
          fetchApi<{ logs?: AdminLog[] }>("/admin/logs?limit=5"),
          fetch(`${API_BASE_URL.replace("/api/v1", "")}/health`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          fetchApi<Trend>(`/admin/metrics/trends?days=${days}`).catch(
            () => null,
          ),
          fetchApi<{ providers?: ProviderUsageItem[] }>(
            `/admin/providers/unified-state?days=${days}`,
          ).catch(() => ({ providers: [] })),
          fetchApi<KnowledgeInsight>("/admin/knowledge-insights").catch(() => null),
        ]);
        if (!cancelled) {
          setRecentCompanies(comps.companies?.slice(0, 5) || []);
          setRecentLogs(logs.logs?.slice(0, 5) || []);
          setHealth(h);
          setTrends(t);
          setUnifiedProviders(b.providers || []);
          setKnowledge(k);
        }
      } catch {
        if (!cancelled)
          setError("Failed to load dashboard data. Please try again.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefetching(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [days, refreshKey]);

  if (isLoading)
    return (
      <div
        className={styles.loading}
        role="status"
        aria-label="Loading overview"
      >
        <div className={styles.loadingHero} />
        <div className={styles.loadingCards}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} />
          ))}
        </div>
        <div className={styles.loadingChart} />
      </div>
    );
  if (error && !metrics)
    return (
      <div className={styles.errorState} role="alert">
        <ShieldAlert size={28} />
        <h1>Overview unavailable</h1>
        <p>{error}</p>
        <button onClick={() => setRefreshKey((key) => key + 1)}>
          Try again <ArrowRight size={16} />
        </button>
      </div>
    );

  // Use the canonical analytics response for all Overview financial and
  // token totals.  Provider unified-state is intentionally a provider detail
  // view and can omit legacy/imported usage rows, which previously caused the
  // Overview totals to differ from Usage analytics.
  const platformCost = Number(metrics?.total_cost || 0);

  const apiHealthy = health?.status === "healthy";
  const dbHealthy = health?.database === "connected";
  const allHealthy = Boolean(health && apiHealthy && dbHealthy);
  const dailyLlm = trends?.daily_llm || [];
  const successful = dailyLlm.reduce(
    (sum: number, day: DailyUsage) => sum + (Number(day.success) || 0),
    0,
  );
  const failed = dailyLlm.reduce(
    (sum: number, day: DailyUsage) => sum + (Number(day.failed) || 0),
    0,
  );
  const successRate =
    successful + failed ? (successful / (successful + failed)) * 100 : null;
  const totalTokens = Number(metrics?.total_tokens || 0);
  const topProvider = [...unifiedProviders].sort(
    (a, b) => (b.usage?.api_calls || 0) - (a.usage?.api_calls || 0),
  )[0];
  const activityData =
    trends?.ai_requests?.map((item) => ({
      date: item.date,
      count: item.count,
    })) || [];
  const providerFailures = unifiedProviders.filter(
    (provider) => (provider.usage?.failure_count || 0) > 0,
  );
  const latencyValues = unifiedProviders
    .map((provider) => Number(provider.usage?.avg_latency_ms))
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageLatency = latencyValues.length
    ? latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length
    : null;
  const activityValues = activityData.map((item) => item.count).filter((value) => value > 0);
  const activityAverage = activityValues.length
    ? activityValues.reduce((sum, value) => sum + value, 0) / activityValues.length
    : 0;
  const latestActivity = activityData.at(-1)?.count || 0;
  const usageSpike = activityAverage > 0 && latestActivity >= activityAverage * 1.8;
  const failedDocuments = knowledge?.documents?.failed || 0;
  const processingDocuments = knowledge?.documents?.processing || 0;
  const needsAttention = !allHealthy || failed > 0 || providerFailures.length > 0 || failedDocuments > 0;

  // Format Logs
  const recentLogItems = recentLogs.map((log) => ({
    id: log.id,
    title: log.actor_name || log.actor_email || "System",
    subtitle: `${log.action || "Activity"} ${log.target || ""}`.trim(),
    timestamp: formatSystemDateTime(log.created_at),
    icon: Activity,
  }));

  // Format Companies as Recent Activity
  const recentCompanyItems = recentCompanies.map((comp) => ({
    id: comp.id,
    title: comp.name,
    subtitle: [comp.industry, comp.country].filter(Boolean).join(" · "),
    timestamp: "",
    status: (comp.plan || "").replace("_", " "),
    statusColor: "bg-slate-100 text-slate-700",
    icon: Building2,
    avatarUrl: getCompanyLogoUrl(comp.id, comp.logo_url),
    avatarLabel: comp.name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  }));

  return (
    <div className={styles.overview}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>
            <Sparkles size={14} /> ORGANIZATION COMMAND CENTER
          </span>
          <h1>Platform overview</h1>
          <p>
            Performance and operations across your {platformName} environment.
          </p>
        </div>
        <div className={styles.headerActions}>
          <div
            className={styles.periodPicker}
            role="group"
            aria-label="Reporting period"
          >
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                disabled={isRefetching}
                aria-pressed={days === d}
                className={days === d ? styles.selectedPeriod : ""}
              >
                {d} days
              </button>
            ))}
          </div>
          <button
            className={styles.refreshButton}
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={isRefetching}
            aria-label="Refresh overview"
          >
            <RefreshCw
              size={17}
              className={isRefetching ? styles.spinning : ""}
            />{" "}
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.inlineError} role="alert">
          {error} Showing previously loaded data.{" "}
          <button onClick={() => setRefreshKey((key) => key + 1)}>Retry</button>
        </div>
      )}
      <div
        className={isRefetching ? styles.refetching : styles.content}
        aria-busy={isRefetching}
      >
        <section className="mb-[18px] grid gap-3 lg:grid-cols-[1.5fr_1fr]" aria-label="Platform attention and actions">
          <div className={`rounded-2xl border px-5 py-4 shadow-sm ${needsAttention ? "border-amber-200 bg-amber-50/70" : "border-emerald-100 bg-emerald-50/60"}`}>
            <div className="flex items-start gap-3">
              <span className={`rounded-xl p-2 ${needsAttention ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{needsAttention ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}</span>
              <div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{needsAttention ? "Needs attention" : "Platform watch"}</p><p className="mt-1 text-sm font-semibold text-slate-800">{needsAttention ? `${providerFailures.length + failedDocuments + (allHealthy ? 0 : 1)} item(s) need review` : "No active incidents"}</p><p className="mt-1 truncate text-[11px] text-slate-500">{providerFailures.length > 0 ? `${providerFailures[0].provider_name} failures` : "Live health stable"}{failedDocuments > 0 ? ` · ${failedDocuments} failed document(s)` : ""}{usageSpike ? " · Usage spike detected" : ""}</p></div>
              {providerFailures.length > 0 && <Link href="/admin/usage" className="shrink-0 text-xs font-bold text-emerald-700">Review <ArrowRight size={13} className="inline" /></Link>}
            </div>
          </div>
          <div className="rounded-2xl border border-[#D9E7DD] bg-white px-4 py-3 shadow-sm"><div className="flex items-center justify-between"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Quick actions</p><span className="text-[10px] text-slate-400">Shortcuts</span></div><div className="mt-2 flex flex-wrap gap-1.5"><Link href="/admin/companies" className="inline-flex items-center gap-1 rounded-lg bg-[#0C4A31] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#083A26]"><Plus size={13} /> Company</Link><Link href="/admin/agents" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-emerald-300"><Plus size={13} /> Agent</Link><Link href="/admin/my-ai/documents" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-emerald-300"><Upload size={13} /> Document</Link><Link href="/admin/system/ai-providers" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:border-emerald-300"><Settings2 size={13} /> Provider</Link></div></div>
        </section>
        <section className={styles.hero} aria-label="Platform summary">
          <div className={styles.heroStatus}>
            <span className={allHealthy ? styles.heroGood : styles.heroWarn}>
              {allHealthy ? (
                <CheckCircle2 size={25} />
              ) : (
                <ShieldAlert size={25} />
              )}
            </span>
            <div>
              <span className={styles.heroKicker}>PLATFORM STATUS</span>
              <h2>
                {!health
                  ? "Health check unavailable"
                  : allHealthy
                    ? "Core services operational"
                    : "Core service needs attention"}
              </h2>
              <p>
                {health
                  ? "Based on live API and database health checks."
                  : "Live health could not be verified."}
              </p>
            </div>
          </div>
          <div className={styles.heroInsight}>
            <span className={styles.insightIcon}>
              <Sparkles size={19} />
            </span>
            <div>
              <span className={styles.heroKicker}>
                AI QUALITY · LAST {days} DAYS
              </span>
              <strong>
                {successRate === null
                  ? "No request outcomes yet"
                  : `${successRate.toFixed(1)}% request success`}
              </strong>
              <p>
                {successRate === null
                  ? "Insights appear when requests are recorded."
                  : successRate < 95
                    ? "Review request outcomes and provider performance."
                    : "Request outcomes are performing well."}
              </p>
            </div>
            <a
              href="#ai-analytics"
              className={styles.heroLink}
              aria-label="Jump to AI analytics"
            >
              <ArrowRight size={18} />
            </a>
          </div>
        </section>
        {/* ── 1. Primary KPI Row ─────────────────────────────────────────── */}
        <div className={styles.kpiHeading}>
          <div>
            <span className={styles.panelEyebrow}>PLATFORM AT A GLANCE</span>
            <h2>Key metrics</h2>
            <p>Current scale and usage for the selected period.</p>
          </div>
          <Link href="/admin/conversations">
            Trace a conversation <ArrowRight size={15} />
          </Link>
        </div>
        <div className={styles.kpiGrid}>
          <OverviewKpiCard
            title="TOTAL COMPANIES"
            value={metrics?.total_companies ?? 0}
            icon={Building2}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-700"
            subtext="Onboarded tenants"
            delayMs={0}
            href="/admin/companies"
          />
          <OverviewKpiCard
            title="ACTIVE AGENTS"
            value={metrics?.total_agents ?? 0}
            icon={Bot}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-700"
            subtext="Platform-wide"
            delayMs={50}
            href="/admin/agents"
          />
          <OverviewKpiCard
            title="CONVERSATIONS"
            value={metrics?.total_conversations ?? 0}
            icon={MessageSquare}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-700"
            subtext={`Last ${days} days`}
            delayMs={100}
            href="/admin/conversations"
          />
          <OverviewKpiCard
            title="AI REQUESTS"
            value={metrics?.total_llm_calls?.toLocaleString() ?? 0}
            icon={Zap}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-700"
            subtext={`Last ${days} days`}
            delayMs={150}
            href="/admin/usage"
          />
          <OverviewKpiCard
            title="VOICE MINUTES"
            value={metrics?.total_call_minutes ?? 0}
            icon={Phone}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-700"
            subtext={`Last ${days} days`}
            delayMs={200}
            href="/admin/usage"
          />
          <OverviewKpiCard
            title="PLATFORM COST"
            value={`₹${platformCost.toFixed(2)}`}
            icon={Coins}
            iconBgColor="bg-emerald-50"
            iconTextColor="text-emerald-700"
            subtext={`Last ${days} days`}
            delayMs={250}
            href="/admin/system/ai-providers"
          />
        </div>
        <details className={styles.metricGuide}>
          <summary>
            <Info size={14} /> Explain these numbers <ChevronDown size={14} />
          </summary>
          <div>
            <p>
              <strong>Companies and agents</strong> are current platform totals.
            </p>
            <p>
              <strong>Conversations, AI requests and voice minutes</strong> use
              the selected {days}-day period.
            </p>
            <p>
              <strong>Provider cost</strong> sums reported INR costs from
              connected providers for the same period.
            </p>
          </div>
        </details>

        {/* ── 2. Activity ─────────────────────────────────────── */}
        <div className={styles.mainGrid}>
          <div className={styles.chartPanel}>
            <OverviewActivityChart
              title="Platform Activity"
              description={`AI Request volume across all companies over the last ${days} days`}
              data={activityData}
              delayMs={300}
            />
          </div>
          <div className={styles.healthPanel}>
            <div className={styles.panelHeading}>
              <div>
                <span className={styles.panelEyebrow}>LIVE MONITORING</span>
                <h2>System health</h2>
                <p>Verified platform services</p>
              </div>
              <span
                className={
                  allHealthy ? styles.healthBadgeGood : styles.healthBadgeWarn
                }
              >
                {!health ? "Unknown" : allHealthy ? "Operational" : "Attention"}
              </span>
            </div>
            <div className={styles.services}>
              {[
                {
                  name: "Backend API",
                  detail: "FastAPI",
                  icon: Server,
                  healthy: apiHealthy,
                },
                {
                  name: "Database",
                  detail: "MongoDB",
                  icon: Database,
                  healthy: dbHealthy,
                },
              ].map((service) => {
                const Icon = service.icon;
                return (
                  <div className={styles.service} key={service.name}>
                    <span className={styles.serviceIcon}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <strong>{service.name}</strong>
                      <small>{service.detail}</small>
                    </div>
                    <span
                      className={
                        service.healthy
                          ? styles.serviceGood
                          : styles.serviceWarn
                      }
                    >
                      {!health
                        ? "Unknown"
                        : service.healthy
                          ? "Healthy"
                          : "Degraded"}
                    </span>
                  </div>
                );
              })}
            </div>
            <Link href="/admin/system" className={styles.panelFooter}>
              Open system health <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* ── 3. Recent ────────────────────────────────── */}
        <div className={styles.recentGrid}>
          <OverviewRecentActivity
            title="Company Overview"
            description="Recently active or onboarded companies"
            items={recentCompanyItems}
            viewAllLink="/admin/companies"
            delayMs={400}
            emptyMessage="No companies found."
          />
          <OverviewRecentActivity
            title="Recent Platform Activity"
            description="Admin logs and system events"
            items={recentLogItems}
            viewAllLink="/admin/logs"
            delayMs={450}
            emptyMessage="No activity logs found."
          />
        </div>

        <section className="mt-[18px] grid gap-3 sm:grid-cols-3" aria-label="Platform intelligence">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"><Gauge size={13} /> API latency</p><p className="mt-1 text-lg font-bold text-slate-900">{averageLatency === null ? "Not available" : `${averageLatency.toFixed(0)} ms`}</p><p className="text-[11px] text-slate-500">From recorded provider requests</p></div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"><FileWarning size={13} /> Knowledge indexing</p><p className="mt-1 text-lg font-bold text-slate-900">{knowledge ? `${knowledge.documents?.ready || 0} ready` : "Not available"}</p><p className="text-[11px] text-slate-500">{processingDocuments > 0 ? `${processingDocuments} processing` : `${failedDocuments} failed documents`}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400"><Activity size={13} /> Usage signal</p><p className="mt-1 text-lg font-bold text-slate-900">{usageSpike ? "Spike detected" : "Within normal range"}</p><p className="text-[11px] text-slate-500">Compared with selected-period average</p></div>
        </section>

        {/* ── 4. Compact analytics snapshot ─────────────────── */}
        <div id="ai-analytics" className={styles.analyticsSection}>
          <section className="overflow-hidden rounded-2xl border border-[#D9E7DD] bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Zap size={18} /></span>
                <div><h2 className="text-base font-bold text-slate-900">AI usage snapshot</h2><p className="text-xs text-slate-500">A quick read of the selected {days}-day period.</p></div>
              </div>
              <Link href="/admin/usage" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900">Open full analytics <ArrowRight size={14} /></Link>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
              <div className="px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">AI requests</p><p className="mt-1 text-xl font-bold text-slate-900">{(metrics?.total_llm_calls || 0).toLocaleString()}</p></div>
              <div className="px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total tokens</p><p className="mt-1 text-xl font-bold text-slate-900">{totalTokens.toLocaleString()}</p></div>
              <div className="px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Platform cost</p><p className="mt-1 text-xl font-bold text-slate-900">₹{platformCost.toFixed(2)}</p></div>
              <div className="px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top provider</p><p className="mt-1 truncate text-xl font-bold capitalize text-slate-900">{topProvider?.provider_name || "—"}</p><p className="text-[11px] text-slate-500">{successRate === null ? "No outcomes yet" : `${successRate.toFixed(1)}% success rate`}</p></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
