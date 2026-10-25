"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart3, MessageSquare, Bot, Coins, Zap, Activity,
  ShieldCheck, Clock, Users, TrendingUp, Hash, HelpCircle
} from "lucide-react";
import { useCurrentCompany } from "@/hooks/use-company";
import { FilterSelect } from "@/components/ui/filter-select";
import { analyticsApi, DetailedAnalytics } from "@/lib/api/analytics";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Safely format a UTC date string to a short "10 Sep" label without
 *  timezone-shifting artifacts. The backend returns YYYY-MM-DD strings. */
function fmtAxisDate(val: string): string {
  // Parse as local midnight to avoid UTC-offset shifting the day back
  const parts = val.split("-");
  if (parts.length !== 3) return val;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
}

function fmtTooltipDate(val: string): string {
  const parts = val.split("-");
  if (parts.length !== 3) return val;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

const RANGE_LABELS: Record<string, string> = { "7d": "7 Days", "30d": "30 Days", "90d": "90 Days" };

// ------------------------------------------------------------------
// Main Page
// ------------------------------------------------------------------

export default function AnalyticsPage() {
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();

  const [data, setData] = useState<DetailedAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [range, setRange] = useState("30d");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    let isMounted = true;
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await analyticsApi.get(companyId, range);
        if (isMounted) setData(result);
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load analytics");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAnalytics();
    return () => { isMounted = false; };
  }, [companyId, range]);

  if (isCompanyLoading || (isLoading && !data)) {
    return <PageLoadingSkeleton cards={4} />;
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <div className="rounded-full bg-red-50 p-4 text-red-500"><Activity className="h-8 w-8" /></div>
        <h3 className="text-xl font-semibold text-slate-900">Unable to load analytics</h3>
        <p className="text-sm text-slate-500 text-center max-w-sm">{error}</p>
        <button
          onClick={() => { setError(null); setIsLoading(true); }}
          className="mt-2 px-4 py-2 bg-sage-600 text-white text-sm rounded-lg hover:bg-sage-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const hasData = data.kpi.total_conversations > 0 || data.kpi.ai_requests > 0;
  const rangeLabel = RANGE_LABELS[range] ?? range;

  // Only show trend points that have any activity (to avoid giant blank charts for sparse data)
  const activeTrendPoints = data.usage_trend.filter(
    (d) => d.conversations > 0 || d.ai_requests > 0 || d.cost > 0
  );
  const trendData = activeTrendPoints.length > 0 ? data.usage_trend : [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Analytics</h2>
          <p className="mt-1 text-slate-500">Understand how customers use your AI agents.</p>
        </div>

        <div className="self-start sm:self-auto">
          <FilterSelect
            label="Date Range"
            value={range}
            onChange={setRange}
            options={[
              { label: "Last 7 Days", value: "7d" },
              { label: "Last 30 Days", value: "30d" },
              { label: "Last 90 Days", value: "90d" },
            ]}
          />
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Conversations"
          value={data.kpi.total_conversations.toLocaleString()}
          sub={`Last ${rangeLabel}`}
          icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
          color="blue"
        />
        <KpiCard
          title="AI Requests"
          value={data.kpi.ai_requests.toLocaleString()}
          sub="LLM calls made"
          icon={<Bot className="h-4 w-4 text-purple-500" />}
          color="purple"
        />
        <KpiCard
          title="Tokens"
          value={data.kpi.total_tokens.toLocaleString()}
          sub="Input + Output"
          icon={<Zap className="h-4 w-4 text-amber-500" />}
          color="amber"
        />
        <KpiCard
          title="AI Cost"
          value={`₹${data.kpi.total_cost.toFixed(2)}`}
          sub="Estimated usage"
          icon={<Coins className="h-4 w-4 text-emerald-500" />}
          color="emerald"
        />
        <KpiCard
          title="Success Rate"
          value={`${data.kpi.success_rate}%`}
          sub="AI request success"
          icon={<ShieldCheck className="h-4 w-4 text-green-600" />}
          color="green"
        />
        <KpiCard
          title="Agents"
          value={data.kpi.active_agents.toLocaleString()}
          sub="Configured agents"
          icon={<Users className="h-4 w-4 text-indigo-500" />}
          color="indigo"
        />
      </div>

      {/* ── No Data State ─────────────────────────────────────── */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-24 shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400">
            <BarChart3 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No data yet for this period</h3>
          <p className="mt-2 max-w-xs text-center text-sm text-slate-500">
            Interact with your AI agents to see analytics populate here.
          </p>
        </div>
      ) : (
        <>
          {/* ── Usage Overview ─────────────────────────────── */}
          <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Usage Overview" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Usage Trend */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Usage Trend</CardTitle>
                <CardDescription>Conversations and AI requests per day</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] pt-0">
                {trendData.length === 0 ? (
                  <EmptyChart message="No usage data in this period." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={fmtAxisDate}
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                        labelFormatter={(val: any) => fmtTooltipDate(String(val))}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                      <Line type="monotone" name="Conversations" dataKey="conversations" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                      <Line type="monotone" name="AI Requests" dataKey="ai_requests" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Cost Trend */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Daily AI Cost (₹)</CardTitle>
                <CardDescription>Estimated INR cost per day</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] pt-0">
                {trendData.length === 0 ? (
                  <EmptyChart message="No cost data in this period." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={fmtAxisDate}
                        stroke="#94a3b8"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                        labelFormatter={(val: any) => fmtTooltipDate(String(val))}
                        formatter={(val: any) => [`₹${Number(val).toFixed(4)}`, "Cost"]}
                      />
                      <Bar dataKey="cost" name="Cost (₹)" fill="#10b981" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── AI Performance ─────────────────────────────── */}
          <SectionHeader icon={<Bot className="h-4 w-4" />} title="AI Performance" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Provider Performance */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Provider Performance</CardTitle>
                <CardDescription>Usage and reliability by AI provider</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto p-0">
                {data.providers.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">No provider usage recorded yet.</div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-y border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-medium">Provider</th>
                        <th className="px-4 py-3 font-medium text-right">Requests</th>
                        <th className="px-4 py-3 font-medium text-right">Tokens</th>
                        <th className="px-4 py-3 font-medium text-right">Success</th>
                        <th className="px-4 py-3 font-medium text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.providers.map((p, i) => {
                        const total = p.success + p.failed;
                        const sr = total > 0 ? ((p.success / total) * 100).toFixed(1) : null;
                        return (
                          <tr key={`prov-${i}`} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3 font-medium text-slate-900 capitalize">{p.provider}</td>
                            <td className="px-4 py-3 text-slate-600 text-right tabular-nums">{p.api_calls.toLocaleString()}</td>
                            <td className="px-4 py-3 text-slate-600 text-right tabular-nums">{p.total_tokens.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">
                              {sr ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${Number(sr) > 90 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                                  {sr}%
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-right tabular-nums">
                              {p.cost !== null ? `₹${Number(p.cost).toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Agent Performance */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Agent Performance</CardTitle>
                <CardDescription>Conversations and AI usage per agent</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto p-0">
                {data.agents.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500">No agent usage recorded yet.</div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-y border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-medium">Agent</th>
                        <th className="px-4 py-3 font-medium text-right">Convs</th>
                        <th className="px-4 py-3 font-medium text-right">AI Req.</th>
                        <th className="px-4 py-3 font-medium text-right">Success</th>
                        <th className="px-4 py-3 font-medium text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.agents.map((a, i) => (
                        <tr key={`agent-${i}`} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-medium text-slate-900 max-w-[140px] truncate">{a.name}</td>
                          <td className="px-4 py-3 text-slate-600 text-right tabular-nums">{a.conversations}</td>
                          <td className="px-4 py-3 text-slate-600 text-right tabular-nums">{a.ai_requests}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              a.success_rate > 90 ? "bg-green-100 text-green-800" :
                              a.success_rate > 70 ? "bg-yellow-100 text-yellow-800" :
                              "bg-red-100 text-red-800"
                            }`}>
                              {a.success_rate}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-right tabular-nums">₹{a.cost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Customer Insights ──────────────────────────── */}
          <SectionHeader icon={<HelpCircle className="h-4 w-4" />} title="Customer Insights" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Topics */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Top Topics</CardTitle>
                <CardDescription>
                  {data.total_user_messages_analyzed > 0
                    ? `Keyword analysis of ${data.total_user_messages_analyzed} customer message${data.total_user_messages_analyzed !== 1 ? "s" : ""}`
                    : "Customer question categories"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.topics.length === 0 ? (
                  <div className="py-8 text-center">
                    <Hash className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-500">
                      {data.total_user_messages_analyzed === 0
                        ? "Not enough conversation data yet."
                        : "No categorizable topics found in this period."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.topics.map((t, i) => {
                      const maxCount = data.topics[0].count;
                      const pct = Math.round((t.count / maxCount) * 100);
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{t.topic}</span>
                            <span className="text-slate-500 tabular-nums text-xs">{t.count} msg{t.count !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-sage-400 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Questions */}
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Top Customer Questions</CardTitle>
                <CardDescription>Most frequent verbatim questions from customers</CardDescription>
              </CardHeader>
              <CardContent>
                {data.top_questions.length === 0 ? (
                  <div className="py-8 text-center">
                    <HelpCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm text-slate-500">No recurring questions detected yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.top_questions.map((q, i) => (
                      <div key={i} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <p className="text-sm text-slate-700 line-clamp-2 leading-relaxed">&ldquo;{q.question}&rdquo;</p>
                        <span className="shrink-0 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 tabular-nums">
                          ×{q.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Recent Activity ────────────────────────────── */}
          <SectionHeader icon={<Clock className="h-4 w-4" />} title="Recent Activity" />
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Recent Conversations</CardTitle>
              <CardDescription>Latest conversations across your channels</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recent_activity.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">No conversations in this period.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recent_activity.map((act) => {
                    const mins = act.duration_seconds > 0 ? Math.floor(act.duration_seconds / 60) : null;
                    return (
                      <div key={act._id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="shrink-0 bg-sage-50 p-2 rounded-full text-sage-600">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {act.agent_name}
                          </p>
                          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                            <span>{new Date(act.started_at).toLocaleString()}</span>
                            <span className="text-slate-300">·</span>
                            <span>{act.turn_count} turn{act.turn_count !== 1 ? "s" : ""}</span>
                            {mins !== null && <><span className="text-slate-300">·</span><span>{mins}m</span></>}
                            {act.direction && <><span className="text-slate-300">·</span><span className="capitalize">{act.direction}</span></>}
                          </div>
                        </div>
                        <StatusBadge status={act.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Sub-components
// ------------------------------------------------------------------

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-slate-400">{icon}</span>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

function KpiCard({ title, value, sub, icon, color }: {
  title: string; value: string | number; sub?: string; icon: React.ReactNode; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50", purple: "bg-purple-50", amber: "bg-amber-50",
    emerald: "bg-emerald-50", green: "bg-green-50", indigo: "bg-indigo-50",
  };
  const bg = colorMap[color] ?? "bg-slate-50";
  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <div className={`p-1.5 rounded-md ${bg}`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold tracking-tight text-slate-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const cls =
    s === "completed" ? "bg-green-100 text-green-700" :
    s === "active" ? "bg-blue-100 text-blue-700" :
    s === "failed" ? "bg-red-100 text-red-700" :
    "bg-slate-100 text-slate-600";
  return (
    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
