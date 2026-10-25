"use client";

import { useEffect, useState } from "react";
import { 
  Phone, Bot, MessageSquare, Zap, Coins, Book, Loader2, Plus, AlertCircle 
} from "lucide-react";
import { useCurrentCompany } from "@/hooks/use-company";
import { useBranding } from "@/hooks/use-branding";
import { companiesApi } from "@/lib/api/companies";
import { analyticsApi, DetailedAnalytics } from "@/lib/api/analytics";
import { channelsApi, Channel } from "@/lib/api/channels";
import { fetchApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AIWavePattern, SubtleGrid, SoftRadialHighlight } from "@/components/ui/decorative-backgrounds";
import { OverviewKpiCard } from "@/components/dashboard/overview/overview-kpi-card";
import { OverviewActivityChart } from "@/components/dashboard/overview/overview-activity-chart";
import { OverviewHealthCard } from "@/components/dashboard/overview/overview-health-card";
import { OverviewRecentActivity } from "@/components/dashboard/overview/overview-recent-activity";
import { OverviewTopQuestions } from "@/components/dashboard/overview/overview-top-questions";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

export default function DashboardOverview() {
  const { platformName } = useBranding();
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [range, setRange] = useState("30d");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      if (!isCompanyLoading) setIsLoading(false);
      return;
    }

    let isMounted = true;
    
    async function loadData() {
      try {
        if (!analytics) setIsLoading(true);
        else setIsRefetching(true);
        setError(null);
        
        // Fetch all data concurrently
        const [anData, ovData, subData, chData] = await Promise.all([
          analyticsApi.get(companyId!, range).catch(() => null),
          companiesApi.getOverview(companyId!).catch(() => null),
          fetchApi(`/companies/${companyId}/subscription`).catch(() => null),
          channelsApi.list(companyId!).catch(() => ({ channels: [] }))
        ]);
        
        if (isMounted) {
          if (anData) setAnalytics(anData);
          if (ovData) setOverview(ovData);
          if (subData) setSubscription(subData);
          if (chData) setChannels(chData.channels || []);
        }
      } catch (err: any) {
        console.error("Failed to load command center data", err);
        if (isMounted && !analytics) setError("Failed to load dashboard data.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefetching(false);
        }
      }
    }

    loadData();
    
    return () => { isMounted = false; };
  }, [companyId, isCompanyLoading, range]); // Removed analytics dependency as it's state

  if (isLoading || isCompanyLoading) {
    return <PageLoadingSkeleton cards={4} />;
  }

  if (!companyId) return null; // Handled by route protection

  const isNewAccount = !analytics || (analytics.kpi.total_conversations === 0 && overview?.metrics?.total_agents === 0);

  // Extract limits securely
  const callMinutesUsed = subscription?.usage?.call_minutes_used || 0;
  const kbUsed = subscription?.usage?.kb_docs_used || 0;
  
  // Format health data
  const agentHealthItems = (analytics?.agents || []).map(a => ({
    id: a.agent_id,
    name: a.name,
    category: `${a.conversations} convs`,
    isHealthy: a.success_rate >= 90,
    value: `${a.success_rate}%`,
    valueLabel: "success"
  }));

  const recentActivityItems = (analytics?.recent_activity || []).map(act => ({
    id: act._id,
    title: act.agent_name,
    subtitle: `${act.turn_count} turns`,
    timestamp: new Date(act.started_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    status: act.status,
    statusColor: act.status?.toLowerCase() === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100/50' : 'bg-slate-50 text-slate-600 border-slate-200/50',
    icon: MessageSquare
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative pb-12 max-w-[1600px] mx-auto">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 pt-2">
        <SoftRadialHighlight className="top-0 right-0 translate-x-1/4 -translate-y-1/4" color="bg-sage-200" />
        <AIWavePattern />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            Overview
            {isRefetching && <Loader2 className="h-5 w-5 animate-spin text-sage-500" />}
          </h2>
          <p className="mt-1.5 text-sm text-slate-500 font-medium">Your workspace performance at a glance.</p>
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex bg-slate-100/70 p-1 rounded-xl border border-slate-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] backdrop-blur-sm">
            {["7d", "30d", "90d"].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                disabled={isRefetching}
                className={`relative px-4 py-1.5 text-[13px] font-bold rounded-lg transition-all duration-200 ease-out ${
                  range === r 
                    ? "text-slate-800 bg-white shadow-sm ring-1 ring-slate-200/50" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                } ${isRefetching ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
          <Link href="/dashboard/agents/new">
            <Button size="sm" className="bg-sage-600 shadow-sm hover:bg-sage-700 hover:shadow transition-all duration-200 h-9 px-4 rounded-xl font-semibold">
              <Plus className="mr-1.5 h-4 w-4" /> New AI Agent
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 border border-red-100 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isNewAccount ? (
        // Onboarding State
        <div className="relative overflow-hidden rounded-xl border border-sage-200 bg-gradient-to-br from-[#E8F0EC] to-[#F4F7F6] shadow-sm">
          <SubtleGrid className="text-sage-700" />
          <SoftRadialHighlight className="bottom-0 left-0 -translate-x-1/2 translate-y-1/2" color="bg-sage-200" />
          <div className="relative z-10 px-6 py-8 sm:px-8">
            <div className="space-y-2 mb-8">
              <h3 className="text-2xl font-semibold text-sage-900">Welcome to {platformName}</h3>
              <p className="max-w-2xl text-sage-700">
                Your workspace is empty. Let's get started by building your first AI agent.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className={isRefetching ? "opacity-60 transition-opacity duration-300 pointer-events-none" : "transition-opacity duration-300"}>
          {/* ── 1. Primary KPI Row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <OverviewKpiCard 
              title="ACTIVE AGENTS" value={analytics?.kpi.active_agents || 0} icon={Bot} 
              iconBgColor="bg-indigo-50" iconTextColor="text-indigo-500"
              subtext="Configured AI Agents" delayMs={0}
              href="/dashboard/agents"
            />
            <OverviewKpiCard 
              title="CONVERSATIONS" value={analytics?.kpi.total_conversations || 0} icon={MessageSquare} 
              iconBgColor="bg-blue-50" iconTextColor="text-blue-500"
              subtext={`Last ${range}`} delayMs={50}
              href="/dashboard/conversations"
            />
            <OverviewKpiCard 
              title="AI REQUESTS" value={analytics?.kpi.ai_requests?.toLocaleString() || 0} icon={Zap} 
              iconBgColor="bg-amber-50" iconTextColor="text-amber-500"
              subtext={analytics ? `${analytics.kpi.success_rate}% success rate` : "No request data yet"} delayMs={100}
              href="/dashboard/usage"
            />
            <OverviewKpiCard 
              title="VOICE MINUTES" value={callMinutesUsed} icon={Phone} 
              iconBgColor="bg-emerald-50" iconTextColor="text-emerald-500"
              subtext="Used this cycle" delayMs={150}
              href="/dashboard/channels/voice"
            />
            <OverviewKpiCard 
              title="EST. COST" value={`₹${(analytics?.kpi.total_cost || 0).toFixed(2)}`} icon={Coins} 
              iconBgColor="bg-sage-100" iconTextColor="text-sage-600"
              subtext={`Last ${range}`} delayMs={200}
              href="/dashboard/usage"
            />
            <OverviewKpiCard 
              title="KNOWLEDGE BASES" value={kbUsed} icon={Book} 
              iconBgColor="bg-purple-50" iconTextColor="text-purple-500"
              subtext="Indexed Documents" delayMs={250}
              href="/dashboard/knowledge"
            />
          </div>

          {/* ── 2. Activity & Insights ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2">
              <OverviewActivityChart 
                title="Conversation Activity"
                description={`Daily interaction volume over the last ${range}`}
                data={(analytics?.usage_trend || []).map((item) => ({
                  date: item.date,
                  count: item.conversations
                }))}
                delayMs={300}
              />
            </div>
            <div>
              <OverviewTopQuestions 
                title="Top Customer Questions"
                description="Most frequently asked questions in this period"
                items={analytics?.top_questions || []}
                delayMs={350}
              />
            </div>
          </div>

          {/* ── 3. Health & Recent Activity ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <OverviewHealthCard 
              title="Agent Health"
              items={agentHealthItems}
              icon={Bot}
              delayMs={400}
              emptyMessage="No agent data."
            />
            <OverviewRecentActivity 
              title="Recent Conversations"
              description="Latest interactions across all your agents"
              items={recentActivityItems}
              viewAllLink="/dashboard/conversations"
              delayMs={450}
              emptyMessage="No recent conversations."
            />
          </div>
        </div>
      )}
    </div>
  );
}
