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

        // Fetch all primary dashboard metrics and panels concurrently
        const [mRes, compsRes, logsRes, hRes, tRes, bRes, kRes] = await Promise.allSettled([
          fetchApi<Metrics>(`/admin/metrics?days=${days}`),
          fetchApi<{ companies?: Company[] }>("/admin/companies?limit=5"),
          fetchApi<{ logs?: AdminLog[] }>("/admin/logs?limit=5"),
          fetchApi<Health>("/health"),
          fetchApi<Trend>(`/admin/metrics/trends?days=${days}`),
          fetchApi<{ providers?: ProviderUsageItem[] }>(`/admin/providers/unified-state?days=${days}`),
          fetchApi<KnowledgeInsight>("/admin/knowledge-insights"),
        ]);

        if (cancelled) return;

        if (mRes.status === "fulfilled" && mRes.value) {
          setMetrics(mRes.value);
        } else if (!metrics) {
          // Provide fallback so the dashboard structure renders smoothly
          setMetrics({
            total_companies: 0,
            total_agents: 0,
            total_conversations: 0,
            total_call_minutes: 0,
            total_llm_calls: 0,
            total_tokens: 0,
            total_cost: 0,
          });
        }

        if (compsRes.status === "fulfilled" && compsRes.value?.companies) {
          setRecentCompanies(compsRes.value.companies.slice(0, 5));
        }
        if (logsRes.status === "fulfilled" && logsRes.value?.logs) {
          setRecentLogs(logsRes.value.logs.slice(0, 5));
        }
        if (hRes.status === "fulfilled") {
          setHealth(hRes.value);
        }
        if (tRes.status === "fulfilled") {
          setTrends(tRes.value);
        }
        if (bRes.status === "fulfilled" && bRes.value?.providers) {
          setUnifiedProviders(bRes.value.providers);
        }
        if (kRes.status === "fulfilled") {
          setKnowledge(kRes.value);
        }
      } catch (err: any) {
        if (!cancelled && !metrics) {
          setError("Failed to load dashboard data. Please try again.");
        }
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
      {/* ── Executive Command Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-1">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Activity className="h-6 w-6 text-emerald-600" />
            Platform Command Center
            {allHealthy ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                All Systems Healthy
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {providerFailures.length + failedDocuments + (allHealthy ? 0 : 1)} Need Review
              </span>
            )}
            {isRefetching && (
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
            )}
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time multi-tenant intelligence, AI operations & telephony metrics across {platformName}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Action Shortcuts */}
          <Link
            href="/admin/companies"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors"
          >
            <Plus size={13} /> Company
          </Link>
          <Link
            href="/admin/agents"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
          >
            <Plus size={13} /> Agent
          </Link>
          <Link
            href="/admin/channels"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition-colors"
          >
            <Plus size={13} /> Channel
          </Link>

          {/* Period Selector */}
          <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                disabled={isRefetching}
                className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  days === d
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-xs"
          >
            <RefreshCw
              size={13}
              className={isRefetching ? "animate-spin text-emerald-600" : ""}
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
        {/* ── Consolidated Executive Health Ribbon ────────────────────────── */}
        <div className="mb-4 rounded-xl border border-slate-200/90 bg-gradient-to-r from-emerald-50/60 via-white to-slate-50/50 p-3 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Core Infrastructure Health */}
            <div className="flex items-center gap-2.5">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${allHealthy ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {allHealthy ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {allHealthy ? "Core Services Operational" : "Service Attention Needed"}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-semibold">
                    FastAPI · MongoDB
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {health ? "Live API and database health checks optimal" : "Connecting to platform telemetry…"}
                </p>
              </div>
            </div>

            {/* Center: AI Success Rate & Latency */}
            <div className="flex items-center gap-2.5 border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-2 sm:pt-0 sm:pl-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                <Sparkles size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {successRate === null ? "Telemetry syncing" : `${successRate.toFixed(1)}% AI Request Success`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    (Last {days}d)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  {averageLatency !== null ? `Average Latency: ${averageLatency.toFixed(0)} ms` : "Provider metrics healthy"}
                </p>
              </div>
            </div>

            {/* Right: Operational Watch & Action */}
            <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-200/80 pt-2 sm:pt-0 sm:pl-4">
              {needsAttention ? (
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-amber-800">
                    {providerFailures.length > 0
                      ? `${providerFailures[0].provider_name} failures detected`
                      : failedDocuments > 0
                        ? `${failedDocuments} failed document(s)`
                        : "Requires attention"}
                  </span>
                  <Link
                    href="/admin/usage"
                    className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-900 ml-1"
                  >
                    Review <ArrowRight size={12} />
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-600">
                    0 Incidents · Live telemetry stable
                  </span>
                  <Link
                    href="/admin/conversations"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 ml-1"
                  >
                    Live Logs <ArrowRight size={12} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Streamlined KPI Grid ────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Key Platform Metrics · Last {days} Days
          </span>
          <Link
            href="/admin/conversations"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
          >
            Trace a conversation <ArrowRight size={13} />
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
