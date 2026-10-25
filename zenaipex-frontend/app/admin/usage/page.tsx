"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fetchApi } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Activity, Zap, Database, Loader2, Server, 
  ChevronDown, ChevronRight, Hash, DollarSign, CheckCircle2, 
  XCircle, Percent, AlertTriangle, Cpu, RefreshCw, Download, Search,
  TrendingUp, Gauge, Clock3, Building2
  ,Lightbulb, ShieldCheck, Filter, FileText, Printer
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell, 
  ComposedChart
} from "recharts";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { SmartSelect } from "@/components/ui/smart-select";
import { getCompanyLogoUrl } from "@/lib/api/client";

const COLORS = ['#5F786D', '#8BA79C', '#DFE7E1', '#94A3B8', '#64748B'];
const SUCCESS_COLOR = '#10B981';
const ERROR_COLOR = '#EF4444';
const INPUT_COLOR = '#94A3B8';
const OUTPUT_COLOR = '#475569';
const COST_COLOR = '#059669';

function StatCard({ title, value, icon: Icon, color, subvalue }: any) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subvalue && <p className="text-xs text-slate-500 mt-1">{subvalue}</p>}
      </CardContent>
    </Card>
  );
}

function CompanyMark({ company }: { company: any }) {
  const [failed, setFailed] = useState(false);
  const label = String(company?.name || "Company");
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0])
    .join("")
    .toUpperCase();
  const logo = company?.id && !failed
    ? getCompanyLogoUrl(String(company.id), company.logo_url || "current")
    : undefined;

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#EAF6ED] text-[10px] font-extrabold text-[#087F5B]">
      {logo ? (
        <img src={logo} alt="" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      ) : initials || <Building2 className="h-4 w-4" />}
    </span>
  );
}

export default function AdminUsagePage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [unifiedProviders, setUnifiedProviders] = useState<any[]>([]);
  const [providerBalances, setProviderBalances] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("all");
  const [selectedDays, setSelectedDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrendsLoading, setIsTrendsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [providerQuery, setProviderQuery] = useState("");
  const [providerSort, setProviderSort] = useState("cost");
  const [providerStatus, setProviderStatus] = useState("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});
  const [expandedUsage, setExpandedUsage] = useState<string | null>(null);
  
  const toggleProvider = (provider: string) => {
    setExpandedProviders(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  useEffect(() => {
    fetchApi<any>("/admin/companies?limit=100").then(res => setCompanies(res.companies || [])).catch(console.error);
    fetchApi<any>("/admin/providers/balances").then(res => setProviderBalances(res.balances || [])).catch(console.error);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    let url = `/admin/metrics?days=${selectedDays}`;
    if (selectedCompanyId !== "all") url += `&company_id=${selectedCompanyId}`;
    fetchApi<any>(url).then(setMetrics).catch(console.error).finally(() => {
      setIsLoading(false);
      setLastUpdated(new Date());
    });
  }, [selectedCompanyId, selectedDays, refreshKey]);
  
  useEffect(() => {
    setIsTrendsLoading(true);
    let url = `/admin/metrics/trends?days=${selectedDays}`;
    if (selectedCompanyId !== "all") url += `&company_id=${selectedCompanyId}`;
    fetchApi<any>(url).then(setTrends).catch(console.error).finally(() => setIsTrendsLoading(false));
    
    // Fetch detailed provider analysis state
    let providerUrl = `/admin/providers/unified-state?days=${selectedDays}`;
    if (selectedCompanyId !== "all") providerUrl += `&company_id=${selectedCompanyId}`;
    fetchApi<any>(providerUrl)
      .then(res => setUnifiedProviders(res.providers || []))
      .catch(console.error);
  }, [selectedCompanyId, selectedDays, refreshKey]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => setRefreshKey(value => value + 1), 60000);
    return () => window.clearInterval(timer);
  }, [autoRefresh]);

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "MMM d");
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isFailure = payload[0]?.payload?.originalErrors;
      return (
        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-lg text-sm z-50 min-w-[200px]">
          <p className="font-semibold text-slate-800 mb-2 border-b border-slate-100 pb-2">
            {label && typeof label === 'string' && label.includes('-') && label.length === 10 ? formatDate(label) : label}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4 mb-1 text-[13px]">
              <span className="font-medium" style={{ color: entry.color || entry.fill }}>{entry.name}</span>
              <span className="font-bold text-slate-900">
                {typeof entry.value === 'number' && entry.name.includes('Cost') 
                  ? `₹${entry.value.toFixed(4)}` 
                  : entry.value.toLocaleString()}
              </span>
            </div>
          ))}
          {isFailure && (
            <div className="mt-3 pt-2 border-t border-slate-100">
              <p className="text-[11px] text-slate-500 font-bold mb-1 uppercase tracking-wider">Original Errors</p>
              <div className="max-h-[150px] overflow-y-auto pr-1 space-y-1">
                {payload[0].payload.originalErrors.map((err: string, i: number) => (
                  <p key={i} className="text-[11px] text-slate-600 font-mono bg-slate-50 p-1.5 rounded border border-slate-100 break-all leading-tight">{err}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };
  
  const getFailureCategory = (reason: string) => {
    const l = reason.toLowerCase();
    if (l.includes('quota') || l.includes('rate limit') || l.includes('429')) return 'Quota / Rate Limit';
    if (l.includes('timeout')) return 'Timeout';
    if (l.includes('empty response') || l.includes('empty content')) return 'Empty Response';
    if (l.includes('503') || l.includes('service unavailable')) return 'Service Unavailable';
    if (l.includes('auth') || l.includes('401') || l.includes('403')) return 'Authentication Failed';
    if (l.includes('model unavailable') || l.includes('404')) return 'Model Unavailable';
    if (l.includes('network') || l.includes('connect')) return 'Network Error';
    return 'Other';
  };

  let categorizedFailures: any[] = [];
  if (trends?.failure_reasons) {
      const cats: any = {};
      trends.failure_reasons.forEach((f: any) => {
          const cat = getFailureCategory(f.reason);
          if (!cats[cat]) cats[cat] = { category: cat, count: 0, originalErrors: [] };
          cats[cat].count += f.count;
          cats[cat].originalErrors.push(`${f.count}x: ${f.reason}`);
      });
      categorizedFailures = Object.values(cats).sort((a: any, b: any) => b.count - a.count);
  }

  let totalSuccess = 0;
  let totalFailed = 0;
  if (metrics?.provider_usage_table) {
      metrics.provider_usage_table.forEach((p: any) => {
          totalSuccess += p.success || 0;
          totalFailed += p.failed || 0;
      });
  }
  const totalCalls = totalSuccess + totalFailed;
  const successRate = totalCalls > 0 ? (totalSuccess / totalCalls) * 100 : 0;
  const totalCost = Number(metrics?.total_cost || 0);
  const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;
  const dailyCost = selectedDays > 0 ? totalCost / selectedDays : 0;
  const periodCostForecast = dailyCost * 30;
  const filteredProviders = useMemo(() => {
    const query = providerQuery.trim().toLowerCase();
    return [...unifiedProviders]
      .filter((provider: any) => !query || `${provider.provider_name} ${provider.model || ""}`.toLowerCase().includes(query))
      .filter((provider: any) => {
        if (providerStatus === "all") return true;
        if (providerStatus === "disabled") return provider.enabled === false;
        if (providerStatus === "failing") return (provider.usage?.failure_count || 0) > 0;
        if (providerStatus === "healthy") return provider.enabled !== false && (provider.usage?.failure_count || 0) === 0;
        return true;
      })
      .sort((a: any, b: any) => {
        if (providerSort === "calls") return (b.usage?.api_calls || 0) - (a.usage?.api_calls || 0);
        if (providerSort === "failures") return (b.usage?.failure_count || 0) - (a.usage?.failure_count || 0);
        if (providerSort === "tokens") return (b.usage?.total_tokens || 0) - (a.usage?.total_tokens || 0);
        return (b.zeniaai_cost?.amount_inr || 0) - (a.zeniaai_cost?.amount_inr || 0);
      });
  }, [unifiedProviders, providerQuery, providerSort, providerStatus]);

  const topCostProvider = [...unifiedProviders].sort((a: any, b: any) => (b.zeniaai_cost?.amount_inr || 0) - (a.zeniaai_cost?.amount_inr || 0))[0];
  const topFailureProvider = [...unifiedProviders].sort((a: any, b: any) => (b.usage?.failure_count || 0) - (a.usage?.failure_count || 0))[0];
  const topUsageProvider = [...unifiedProviders].sort((a: any, b: any) => (b.usage?.api_calls || 0) - (a.usage?.api_calls || 0))[0];
  const getProviderSuccessRate = (provider: any) => {
    const calls = provider?.usage?.api_calls || 0;
    const failures = provider?.usage?.failure_count || 0;
    return calls > 0 ? ((calls - failures) / calls) * 100 : 0;
  };
  const printReport = () => window.print();

  const exportProviderCsv = () => {
    const header = ["Provider", "Model", "API Calls", "Avg Latency (ms)", "Input Tokens", "Output Tokens", "Total Tokens", "Success", "Failures", "Cost INR"];
    const rows = filteredProviders.map((provider: any) => [
      provider.provider_name, provider.model || "", provider.usage?.api_calls || 0, provider.usage?.avg_latency_ms ?? "",
      provider.usage?.input_tokens || 0, provider.usage?.output_tokens || 0, provider.usage?.total_tokens || 0,
      provider.usage?.success_count || 0, provider.usage?.failure_count || 0,
      provider.zeniaai_cost?.amount_inr || 0,
    ]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `usage-${selectedDays}d-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-10 max-w-7xl">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Usage analytics</h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Live data</span>
          </div>
          <p className="text-slate-500">Monitor AI consumption, reliability, and provider cost in one place.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <SmartSelect
            value={selectedCompanyId}
            onChange={setSelectedCompanyId}
            searchPlaceholder="Search companies…"
            className="w-52"
            options={[
              { value: "all", label: "All Companies", icon: <Building2 className="h-4 w-4" /> },
              ...companies.map((company) => ({
                value: company.id,
                label: company.name,
                icon: <CompanyMark company={company} />,
              })),
            ]}
          />
          
          <SmartSelect value={String(selectedDays)} onChange={(value) => setSelectedDays(Number(value))} searchable={false} className="w-36" options={[{value:"7",label:"Last 7 Days"},{value:"30",label:"Last 30 Days"},{value:"90",label:"Last 90 Days"}]} />
          <button type="button" onClick={() => setRefreshKey(value => value + 1)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700" title="Refresh usage data">
            <RefreshCw className={`h-4 w-4 ${isLoading || isTrendsLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button type="button" onClick={() => setAutoRefresh(value => !value)} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium shadow-sm ${autoRefresh ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700"}`}>
            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500" : "bg-slate-300"}`} /> Auto-refresh
          </button>
        </div>
      </div>
      <div className="-mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>{lastUpdated ? `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}` : "Loading latest usage…"}</span>
        <span>{autoRefresh ? "Refreshes every 60 seconds" : "Auto-refresh off"}</span>
      </div>

      {/* 1. TOP KPI SUMMARY */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCard title="Total Conversations" value={metrics?.total_conversations?.toLocaleString() || 0} icon={Activity} color="text-indigo-500" />
        <StatCard title="Total AI API Calls" value={(metrics?.total_llm_calls ?? metrics?.total_api_calls ?? 0).toLocaleString()} icon={Zap} color="text-rose-500" />
        <StatCard title="RAG Queries" value={metrics?.total_rag_queries?.toLocaleString() || 0} icon={Database} color="text-blue-500" />
        <StatCard title="Input Tokens" value={metrics?.total_input_tokens?.toLocaleString() || 0} icon={Hash} color="text-slate-500" />
        <StatCard title="Output Tokens" value={metrics?.total_output_tokens?.toLocaleString() || 0} icon={Hash} color="text-slate-500" />
        <StatCard title="Total Tokens" value={metrics?.total_tokens?.toLocaleString() || 0} icon={Hash} color="text-sage-600" />
        <StatCard title="Estimated Cost" value={metrics?.total_cost != null ? `₹${metrics.total_cost.toFixed(2)}` : "—"} icon={DollarSign} color="text-emerald-600" />
        <StatCard title="Success" value={totalSuccess.toLocaleString()} icon={CheckCircle2} color="text-emerald-500" />
        <StatCard title="Failures" value={totalFailed.toLocaleString()} icon={XCircle} color="text-red-500" />
        <StatCard title="Success Rate" value={`${successRate.toFixed(1)}%`} icon={Percent} color="text-indigo-600" />
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <StatCard title="Avg cost / API call" value={`₹${avgCostPerCall.toFixed(4)}`} icon={Gauge} color="text-emerald-600" subvalue="Derived from selected period" />
        <StatCard title="30-day cost forecast" value={`₹${periodCostForecast.toFixed(2)}`} icon={TrendingUp} color="text-indigo-600" subvalue="Run-rate estimate, not a bill" />
        <StatCard title="Failure load" value={`${totalCalls > 0 ? ((totalFailed / totalCalls) * 100).toFixed(1) : "0.0"}%`} icon={Clock3} color="text-amber-600" subvalue={`${totalFailed.toLocaleString()} failed requests`} />
      </div>

      <Card className="overflow-hidden border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Lightbulb className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-bold text-slate-900">Usage intelligence</p>
              <p className="mt-1 text-sm text-slate-600">
                {topUsageProvider ? `${topUsageProvider.provider_name} handles the most requests` : "No provider usage recorded yet"}
                {topCostProvider ? ` · ${topCostProvider.provider_name} is the highest-cost provider` : ""}
                {topFailureProvider && (topFailureProvider.usage?.failure_count || 0) > 0 ? ` · ${topFailureProvider.provider_name} needs attention` : " · No provider failures detected"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white px-3 py-1.5 text-slate-600 shadow-sm">{totalCalls.toLocaleString()} requests analyzed</span>
            <span className={`rounded-full px-3 py-1.5 shadow-sm ${successRate >= 95 ? "bg-emerald-100 text-emerald-700" : successRate >= 85 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{successRate.toFixed(1)}% reliability</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Cost intelligence</CardTitle><CardDescription>Selected period run-rate</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-slate-500">Current cost</span><b>₹{totalCost.toFixed(2)}</b></div><div className="flex justify-between"><span className="text-slate-500">Daily average</span><b>₹{dailyCost.toFixed(2)}</b></div><div className="flex justify-between"><span className="text-slate-500">Highest-cost provider</span><b className="capitalize">{topCostProvider?.provider_name || "—"}</b></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Reliability posture</CardTitle><CardDescription>Provider health snapshot</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />Healthy providers</span><b>{unifiedProviders.filter((provider: any) => provider.enabled !== false && (provider.usage?.failure_count || 0) === 0).length}</b></div><div className="flex items-center justify-between"><span className="text-slate-500">Providers with failures</span><b className="text-rose-600">{unifiedProviders.filter((provider: any) => (provider.usage?.failure_count || 0) > 0).length}</b></div><div className="flex items-center justify-between"><span className="text-slate-500">Disabled providers</span><b>{unifiedProviders.filter((provider: any) => provider.enabled === false).length}</b></div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Report actions</CardTitle><CardDescription>Take the current filtered view with you</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2"><button type="button" onClick={exportProviderCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"><FileText className="h-4 w-4" /> CSV report</button><button type="button" onClick={printReport} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700"><Printer className="h-4 w-4" /> Print / PDF</button></CardContent></Card>
      </div>

      {/* 2. AI USAGE SUMMARY - PRIMARY SECTION */}
      <Card className="border-sage-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-sage-600" />
            <div>
                <CardTitle className="text-lg text-slate-800">AI Usage Summary</CardTitle>
                <CardDescription>Primary overview of active LLM providers and consumption.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!metrics?.provider_usage_table || metrics.provider_usage_table.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                <Server className="h-10 w-10 mb-3 opacity-20" />
                <p>No usage data available for this period.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {metrics.provider_usage_table.map((row: any, idx: number) => {
                const pb = providerBalances.find((b: any) => b.provider === row.provider?.toLowerCase());
                const isUnavailable = pb?.quota_unavailable ?? true;
                const lastUsed = pb?.last_synced ? formatDistanceToNow(parseISO(pb.last_synced), { addSuffix: true }) : "Unknown";
                const isExpanded = expandedUsage === row.provider;
                
                return (
                  <div key={idx} className="hover:bg-slate-50 transition-colors">
                    <div 
                      className="px-4 py-3 cursor-pointer flex flex-col"
                      onClick={() => setExpandedUsage(isExpanded ? null : row.provider)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <h3 className="font-bold text-slate-800 capitalize text-base sm:w-24">{row.provider}</h3>
                          <div className="hidden rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 sm:flex">
                            {row.api_calls?.toLocaleString() ?? 0} API Calls · {row.total_tokens?.toLocaleString() ?? 0} Tokens · ₹{(row.cost ?? 0).toFixed(4)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`hidden rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide sm:inline-flex ${row.api_calls > 0 && (row.failed || 0) === 0 ? "bg-emerald-50 text-emerald-700" : row.api_calls > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                            {row.api_calls > 0 ? ((1 - ((row.failed || 0) / row.api_calls)) * 100).toFixed(0) + "% healthy" : "No traffic"}
                          </span>
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      
                      {/* Mobile compact summary */}
                      <div className="flex gap-2 text-[11px] text-slate-500 font-medium sm:hidden">
                        {row.api_calls?.toLocaleString() ?? 0} Calls · {row.total_tokens?.toLocaleString() ?? 0} Tok · ₹{(row.cost ?? 0).toFixed(4)}
                      </div>
                      
                      <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] mt-2 opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-xs text-slate-400">Last used: {lastUsed}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                          <div>
                            <p className="text-xs text-slate-500 font-medium">API Calls</p>
                            <p className="font-mono text-sm font-semibold text-slate-900">{row.api_calls?.toLocaleString() ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-medium">Input Tokens</p>
                            <p className="font-mono text-sm font-semibold text-slate-900">{row.input_tokens?.toLocaleString() ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-medium">Output Tokens</p>
                            <p className="font-mono text-sm font-semibold text-slate-900">{row.output_tokens?.toLocaleString() ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 font-medium">Total Tokens</p>
                            <p className="font-mono text-sm font-bold text-sage-700">{row.total_tokens?.toLocaleString() ?? 0}</p>
                          </div>
                        </div>
                        
                        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                          {isUnavailable ? (
                            <div className="flex items-center gap-3 py-1">
                              <div className="p-2 bg-amber-50 rounded-full">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-slate-700 block">Official balance not exposed by this provider</span>
                                <span className="text-xs text-slate-500">Usage is tracked here; review credits and quotas in the provider console.</span>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Official balance</span>
                                <span className="text-sm font-bold text-slate-700">{pb.remaining_amount ?? "Unavailable"}</span>
                              </div>
                              <p className="text-xs text-slate-500">This figure comes from the provider balance endpoint. Percentage is not displayed because the provider does not return a verified credit limit.</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CHARTS SECTION */}
      <div className="my-8 flex items-center gap-4 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Deep Analytics</span>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* 3. Provider Distribution */}
        {(isTrendsLoading || unifiedProviders?.some((p: any) => p.usage?.api_calls > 0)) && (
          <Card className="border-slate-200 shadow-sm flex flex-col">
              <CardHeader className="px-4 pb-1 pt-4">
                  <CardTitle className="text-base font-semibold text-slate-800">Provider Distribution</CardTitle>
                  <CardDescription className="text-xs">API calls distribution among active providers</CardDescription>
              </CardHeader>
              <CardContent className="flex h-[205px] min-h-0 flex-col p-3">
                  <div className="flex-1 w-full relative">
                      {isTrendsLoading ? (
                          <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300"/></div>
                      ) : (
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                  <Pie
                                      data={unifiedProviders.filter((p: any) => p.usage?.api_calls > 0)}
                                      dataKey={(entry) => entry.usage.api_calls}
                                      nameKey="provider_name"
                                      cx="50%"
                                      cy="50%"
                                      innerRadius={58}
                                      outerRadius={82}
                                      paddingAngle={3}
                                      stroke="none"
                                  >
                                      {unifiedProviders.filter((p: any) => p.usage?.api_calls > 0).map((entry: any, index: number) => (
                                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                      ))}
                                  </Pie>
                                  <RechartsTooltip content={<CustomTooltip />} />
                              </PieChart>
                          </ResponsiveContainer>
                      )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 pt-1 text-[10px] font-medium text-slate-500">
                    {unifiedProviders.filter((provider: any) => provider.usage?.api_calls > 0).map((provider: any, index: number) => (
                      <span key={provider.provider_name} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="capitalize">{provider.provider_name}</span>
                      </span>
                    ))}
                  </div>
              </CardContent>
          </Card>
        )}

        {/* 4. Token Usage */}
        <Card className="border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="px-4 pb-1 pt-4">
                <CardTitle className="text-base font-semibold text-slate-800">Token Usage</CardTitle>
                <CardDescription className="text-xs">Daily input vs output token consumption</CardDescription>
            </CardHeader>
            <CardContent className="flex h-[205px] min-h-0 flex-col p-3">
                <div className="flex-1 w-full relative">
                    {isTrendsLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300"/></div>
                    ) : trends?.daily_llm?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trends.daily_llm} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={30} tick={{fontSize: 12, fill: '#64748B'}} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{fontSize: 12, fill: '#64748B'}} axisLine={false} tickLine={false} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(0)}k` : val} dx={-10} />
                                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
                                <Legend wrapperStyle={{fontSize: "11px", fontWeight: 500, paddingTop: "4px"}} iconType="circle" />
                                <Bar dataKey="input_tokens" name="Input Tokens" stackId="a" fill={INPUT_COLOR} radius={[0, 0, 4, 4]} maxBarSize={40} />
                                <Bar dataKey="output_tokens" name="Output Tokens" stackId="a" fill={OUTPUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Not enough data for this period</div>
                    )}
                </div>
            </CardContent>
        </Card>

        {/* 5. Cost Trend */}
        <Card className="border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="px-4 pb-1 pt-4">
                <CardTitle className="text-base font-semibold text-slate-800">Cost Trend</CardTitle>
                <CardDescription className="text-xs">Daily API Cost in INR (₹)</CardDescription>
            </CardHeader>
            <CardContent className="flex h-[205px] min-h-0 flex-col p-3">
                <div className="flex-1 w-full relative">
                    {isTrendsLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300"/></div>
                    ) : trends?.daily_llm?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trends.daily_llm} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COST_COLOR} stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor={COST_COLOR} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={30} tick={{fontSize: 12, fill: '#64748B'}} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{fontSize: 12, fill: '#64748B'}} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val}`} dx={-10} />
                                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#E2E8F0', strokeWidth: 2, strokeDasharray: '4 4' }} />
                                <Area type="monotone" dataKey="cost" name="API Cost" stroke={COST_COLOR} strokeWidth={3} fillOpacity={1} fill="url(#colorCost)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Not enough data for this period</div>
                    )}
                </div>
            </CardContent>
        </Card>
        
        {/* 6. Reliability */}
        <Card className="border-slate-200 shadow-sm flex flex-col">
            <CardHeader className="px-4 pb-1 pt-4">
                <CardTitle className="text-base font-semibold text-slate-800">Reliability</CardTitle>
                <CardDescription className="text-xs">Successful vs failed requests</CardDescription>
            </CardHeader>
            <CardContent className="flex h-[205px] min-h-0 flex-col p-3">
                <div className="flex-1 w-full relative">
                    {isTrendsLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300"/></div>
                    ) : trends?.daily_llm?.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={trends.daily_llm} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#F1F5F9" />
                                <XAxis dataKey="date" tickFormatter={formatDate} minTickGap={30} tick={{fontSize: 12, fill: '#64748B'}} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{fontSize: 12, fill: '#64748B'}} axisLine={false} tickLine={false} dx={-10} />
                                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
                                <Legend wrapperStyle={{fontSize: "11px", fontWeight: 500, paddingTop: "4px"}} iconType="circle" />
                                <Bar dataKey="success" name="Successful" fill={SUCCESS_COLOR} radius={[4, 4, 0, 0]} maxBarSize={20} />
                                <Bar dataKey="failed" name="Failed" fill={ERROR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">Not enough data for this period</div>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>
        
      {/* 7. Failure Analysis */}
      <Card className="border-slate-200 shadow-sm flex flex-col mt-4">
          <CardHeader className="px-4 pb-1 pt-4">
              <CardTitle className="text-base font-semibold text-slate-800">Failure Analysis</CardTitle>
              <CardDescription className="text-xs">Top reasons for API request failures across all providers</CardDescription>
          </CardHeader>
          <CardContent className="flex h-[220px] min-h-0 flex-col p-3">
              <div className="flex-1 w-full relative">
                  {isTrendsLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300"/></div>
                  ) : categorizedFailures.length > 0 ? (
                      <div className="absolute inset-0">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={categorizedFailures} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 10 }}>
                                  <CartesianGrid strokeDasharray="4 4" horizontal={true} vertical={false} stroke="#F1F5F9" />
                                  <XAxis type="number" tick={{fontSize: 12, fill: '#64748B'}} axisLine={false} tickLine={false} />
                                  <YAxis dataKey="category" type="category" width={160} tick={{fontSize: 13, fill: '#334155', fontWeight: 600}} axisLine={false} tickLine={false} dx={-10} />
                                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
                                  <Bar dataKey="count" name="Failed Requests" fill={ERROR_COLOR} radius={[0, 4, 4, 0]} barSize={32} />
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                  ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 text-sm">
                          <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3 opacity-60" />
                          <p className="font-medium text-slate-600">Perfect Reliability</p>
                          <p>No errors recorded in this period</p>
                      </div>
                  )}
              </div>
          </CardContent>
      </Card>
      
      {/* 8. DETAILED PROVIDER ANALYSIS TABLE */}

      <Card className="overflow-hidden">
         <CardHeader className="bg-slate-50 border-b border-slate-100">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">Detailed Provider Analysis</CardTitle>
                <CardDescription>Granular breakdown of models, latency, tokens, and cost.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={providerQuery} onChange={(event) => setProviderQuery(event.target.value)} placeholder="Search provider…" className="h-9 w-44 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <SmartSelect value={providerStatus} onChange={setProviderStatus} searchable={false} className="w-32" options={[{value:"all",label:"All health",icon:<Filter className="h-4 w-4"/>},{value:"healthy",label:"Healthy",icon:<ShieldCheck className="h-4 w-4"/>},{value:"failing",label:"Needs attention",icon:<AlertTriangle className="h-4 w-4"/>},{value:"disabled",label:"Disabled",icon:<XCircle className="h-4 w-4"/>}]} />
                <SmartSelect value={providerSort} onChange={setProviderSort} searchable={false} className="w-36" options={[{value:"cost",label:"Cost first"},{value:"calls",label:"Calls first"},{value:"tokens",label:"Tokens first"},{value:"failures",label:"Failures first"}]} />
                <button type="button" onClick={exportProviderCsv} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:border-emerald-300 hover:text-emerald-700" title="Export filtered provider data">
                  <Download className="h-4 w-4" /> Export CSV
                </button>
              </div>
            </div>
         </CardHeader>
         <CardContent className="p-0">
           {isLoading ? (
             <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
             </div>
           ) : !unifiedProviders || unifiedProviders.length === 0 ? (
             <div className="flex flex-col items-center p-12 text-slate-400">
                <Server className="h-10 w-10 mb-3 opacity-20" />
                <p>No provider usage recorded in this period.</p>
             </div>
           ) : (
             <div className="overflow-x-auto">
               <table className="w-full text-sm text-left">
                 <thead className="text-xs text-slate-500 uppercase bg-slate-50 whitespace-nowrap">
                   <tr>
                     <th className="px-6 py-4 font-semibold w-8"></th>
                     <th className="px-6 py-4 font-semibold">Provider / Model</th>
                     <th className="px-6 py-4 font-semibold text-right">API Calls</th>
                     <th className="px-6 py-4 font-semibold text-right">Avg Latency</th>
                     <th className="px-6 py-4 font-semibold text-right">Input Tokens</th>
                     <th className="px-6 py-4 font-semibold text-right">Output Tokens</th>
                     <th className="px-6 py-4 font-semibold text-right">Total Tokens</th>
                     <th className="px-6 py-4 font-semibold text-center">Status</th>
                     <th className="px-6 py-4 font-semibold text-right">Cost</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                   {filteredProviders.map((prov: any) => (
                     <React.Fragment key={prov.provider_name}>
                       <tr 
                         className="hover:bg-slate-50 transition-colors cursor-pointer"
                         onClick={() => toggleProvider(prov.provider_name)}
                       >
                         <td className="px-6 py-4">
                           {prov.model ? (
                             expandedProviders[prov.provider_name] ? 
                               <ChevronDown className="h-4 w-4 text-slate-400" /> : 
                               <ChevronRight className="h-4 w-4 text-slate-400" />
                           ) : null}
                         </td>
                         <td className="px-6 py-4 font-medium text-slate-900 capitalize whitespace-nowrap">
                           <div className="flex items-center gap-2">
                             <span className="truncate max-w-[150px] sm:max-w-xs">{prov.provider_name}</span>
                             {!prov.enabled && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 flex-shrink-0">Disabled</span>}
                           </div>
                           <span className="mt-1 block max-w-[220px] truncate text-[11px] font-normal normal-case text-slate-400" title={prov.model || "Model not configured"}>{prov.model || "Model not configured"}</span>
                         </td>
                         <td className="px-6 py-4 text-slate-600 text-right font-medium">
                           {prov.usage.api_calls === 0 ? <span className="text-slate-400">0</span> : prov.usage.api_calls?.toLocaleString()}
                         </td>
                         <td className="px-6 py-4 text-slate-600 text-right">
                           {prov.usage.avg_latency_ms != null ? `${Number(prov.usage.avg_latency_ms).toFixed(1)} ms` : <span className="text-slate-400">—</span>}
                         </td>
                         <td className="px-6 py-4 text-slate-600 text-right">
                           {prov.usage.api_calls === 0 ? <span className="text-slate-400">0</span> : (prov.usage.input_tokens?.toLocaleString() || 0)}
                         </td>
                         <td className="px-6 py-4 text-slate-600 text-right">
                           {prov.usage.api_calls === 0 ? <span className="text-slate-400">0</span> : (prov.usage.output_tokens?.toLocaleString() || 0)}
                         </td>
                         <td className="px-6 py-4 text-slate-600 text-right">
                           {prov.usage.api_calls === 0 ? <span className="text-slate-400">0</span> : (prov.usage.total_tokens?.toLocaleString() || 0)}
                         </td>
                         <td className="px-6 py-4 text-center">
                           <div className="flex items-center justify-center gap-2 text-xs">
                             <span className={`px-2 py-0.5 rounded-full font-medium ${prov.usage.success_count > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100'}`}>
                               {prov.usage.success_count || 0} OK
                             </span>
                             <span className={`px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${prov.usage.failure_count > 0 ? 'text-rose-600 bg-rose-50' : 'text-slate-400 bg-slate-100'}`}>
                               {prov.usage.failure_count > 0 && <AlertTriangle className="h-3 w-3"/>}
                               {prov.usage.failure_count || 0} Fail
                             </span>
                           </div>
                         </td>
                         <td className="px-6 py-4 text-slate-900 font-medium text-right">
                           {prov.usage.api_calls === 0 ? (
                             <span className="text-slate-400">₹0.0000</span>
                           ) : (prov.zeniaai_cost.amount_inr !== null && prov.zeniaai_cost.amount_inr !== undefined ? `₹${prov.zeniaai_cost.amount_inr.toFixed(4)}` : '₹0.0000')}
                         </td>
                       </tr>
                       
                       {/* Drilldown rows for models */}
                       {expandedProviders[prov.provider_name] && prov.model && (
                         <tr className="bg-slate-50/50">
                           <td className="px-6 py-3"></td>
                           <td className="px-6 py-3 text-slate-600 pl-8 flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                             {prov.model}
                           </td>
                           <td className="px-6 py-3 text-slate-500 text-right">
                             {prov.usage.api_calls === 0 ? <span className="text-slate-400">0</span> : prov.usage.api_calls?.toLocaleString()}
                           </td>
                           <td className="px-6 py-3 text-slate-500 text-right">
                             {prov.usage.avg_latency_ms != null ? `${Number(prov.usage.avg_latency_ms).toFixed(1)} ms` : <span className="text-slate-400">—</span>}
                           </td>
                           <td className="px-6 py-3 text-slate-500 text-right">
                             {prov.usage.api_calls === 0 ? <span className="text-slate-400">0</span> : (prov.usage.input_tokens?.toLocaleString() || 0)}
                           </td>
                           <td className="px-6 py-3 text-slate-500 text-right">
                             {prov.usage.api_calls === 0 ? <span className="text-slate-400">0</span> : (prov.usage.output_tokens?.toLocaleString() || 0)}
                           </td>
                           <td className="px-6 py-3 text-slate-500 text-right">
                             {prov.usage.api_calls === 0 ? <span className="text-slate-400">0</span> : (prov.usage.total_tokens?.toLocaleString() || 0)}
                           </td>
                           <td className="px-6 py-3 text-center">
                             <div className="flex items-center justify-center gap-1 text-[10px]">
                               <span className={`px-1.5 py-0.5 rounded font-medium ${prov.usage.success_count > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                 {prov.usage.success_count || 0} OK
                               </span>
                               <span className={`px-1.5 py-0.5 rounded font-medium ${prov.usage.failure_count > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                                 {prov.usage.failure_count || 0} Fail
                               </span>
                             </div>
                           </td>
                           <td className="px-6 py-3 text-slate-500 text-right text-xs">
                             {prov.usage.api_calls === 0 ? (
                               <span className="text-slate-400">₹0.0000</span>
                             ) : (prov.zeniaai_cost.amount_inr !== null && prov.zeniaai_cost.amount_inr !== undefined ? `₹${prov.zeniaai_cost.amount_inr.toFixed(4)}` : '₹0.0000')}
                           </td>
                         </tr>
                       )}
                     </React.Fragment>
                   ))}
                 </tbody>
               </table>
               {filteredProviders.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No providers match “{providerQuery}”.</div>}
             </div>
           )}
         </CardContent>
      </Card>
    </div>
  );
}
