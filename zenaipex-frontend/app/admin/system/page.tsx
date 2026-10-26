"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, CircleAlert, Database, Loader2, Mic2, Phone, RefreshCw, ShieldCheck, Sparkles, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProviderRouting, RuntimeProvider, providersApi } from "@/lib/api/providers";
import { API_BASE_URL, fetchApi } from "@/lib/api/client";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

const flowIcons: Record<string, typeof Phone> = { phone_voice: Phone, browser_voice: Mic2, text_chat: Bot };
const flowNames: Record<string, string> = { phone_voice: "Phone Calls", browser_voice: "Voice Chat AI", text_chat: "Website & Chat" };

type MonitoringSummary = {
  database?: { status?: string; persistent?: boolean };
  background_jobs?: { pending?: number; running?: number; failed?: number };
  scheduled_calls?: { pending?: number; running?: number; failed?: number };
  ai_failures_last_24h?: number;
  alerts?: Array<{ code: string; severity: string; count?: number; provider?: string }>;
  production_readiness?: {
    status?: string;
    configuration_gaps?: Array<{ code: string; severity: string; action: string }>;
  };
};

export default function AdminSystemPage() {
  const [providers, setProviders] = useState<RuntimeProvider[]>([]);
  const [routing, setRouting] = useState<ProviderRouting>({});
  const [health, setHealth] = useState<any>(null);
  const [monitoring, setMonitoring] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    const [runtime, apiHealth, monitoringResult] = await Promise.allSettled([
      providersApi.getRuntime(),
      fetch(`${apiOrigin}/health`).then(response => response.json()),
      fetchApi<MonitoringSummary>("/admin/monitoring-summary"),
    ]);
    if (runtime.status === "fulfilled") { setProviders(runtime.value.providers); setRouting(runtime.value.routing); }
    if (apiHealth.status === "fulfilled") setHealth(apiHealth.value);
    if (monitoringResult.status === "fulfilled") setMonitoring(monitoringResult.value);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const configured = providers.filter(p => p.configured).length;
  const allConfigured = providers.length > 0 && configured === providers.length;
  const providerName = (id: string) => providers.find(provider => provider.id === id)?.name || id.replaceAll("_", " ");
  const activeStages = useMemo(() => Object.values(routing).reduce((total, stages) => total + Object.keys(stages).length, 0), [routing]);
  if (loading) return <PageLoadingSkeleton cards={4} />;

  return <div className="mx-auto max-w-7xl space-y-7 pb-10">
    <section className="relative overflow-hidden rounded-[28px] border border-[#CBE0D1] bg-[#09281C] px-6 py-8 text-white shadow-[0_22px_70px_rgba(11,46,33,.16)] sm:px-9"><div className="absolute right-[-4rem] top-[-5rem] h-72 w-72 rounded-full border border-[#9BEAB6]/20"/><div className="absolute right-5 top-4 h-56 w-56 rounded-full bg-[#6EE69C]/20 blur-3xl"/><div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#A7E6B8]"><Sparkles size={14}/> Platform command center</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">System Health</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#C7DBCF]">Backend, secure provider configuration aur active voice routes ek jagah monitor karein.</p></div><div className="flex items-center gap-5"><div className="relative grid h-28 w-28 place-items-center rounded-full border border-[#B9F3C8]/50 bg-[#0D3B29] shadow-[0_0_55px_rgba(105,239,153,.28)]"><span className="absolute inset-3 rounded-full border border-[#B9F3C8]/25 animate-pulse"/><CheckCircle2 className="relative h-9 w-9 text-[#B9F3C8]"/></div><div><p className="text-xs font-bold uppercase tracking-wider text-[#B8DCC1]">Platform state</p><p className="mt-1 text-2xl font-bold">{health?.status === "healthy" ? "Operational" : "Attention needed"}</p><p className="mt-1 text-xs text-[#B8DCC1]">{configured} of {providers.length} services configured</p></div></div></div></section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Activity} label="Backend API" value={health?.status === "healthy" ? "Healthy" : "Unavailable"} good={health?.status === "healthy"}/><Metric icon={Database} label="Database" value={health?.database === "connected" ? "Connected" : "Disconnected"} good={health?.database === "connected"}/><Metric icon={ShieldCheck} label="Provider setup" value={`${configured} / ${providers.length}`} good={allConfigured}/><Metric icon={Bot} label="Active stages" value={`${activeStages} routed`} good={activeStages > 0}/></section>

    <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]"><Card className="border-[#D9E7DD] shadow-sm"><CardContent className="p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-[#19372B]">Active experience flows</h2><p className="mt-1 text-sm text-slate-500">Primary provider pehle run hota hai; next provider failover hai.</p></div><Button variant="outline" onClick={load} className="border-[#CFE1D4] text-[#286044]"><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div><div className="mt-6 space-y-4">{Object.entries(routing).map(([surface, stages]) => { const Icon = flowIcons[surface] || Activity; return <div key={surface} className="rounded-2xl border border-[#E1EAE3] bg-[#FBFDFC] p-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E4F5E9] text-[#087F5B]"><Icon size={18}/></span><div><p className="font-bold text-[#244235]">{flowNames[surface] || surface}</p><p className="text-xs text-slate-500">Next session uses this flow</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3">{Object.entries(stages).map(([stage, chain]) => <div key={stage} className="rounded-xl border border-[#E2EDE4] bg-white p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#6A8B76]">{stage}</p><div className="mt-2 flex flex-wrap items-center gap-1.5">{chain.map((id, index) => <span key={id} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${index === 0 ? "bg-[#DCF7E4] text-[#177445]" : "bg-slate-100 text-slate-600"}`}>{index > 0 && "→ "}{providerName(id)}</span>)}</div></div>)}</div></div>})}</div></CardContent></Card>
      <div className="space-y-6"><Card className="border-[#D9E7DD] shadow-sm"><CardContent className="p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-[#19372B]">Operational telemetry</h2><p className="mt-1 text-sm text-slate-500">Live queue and AI failure signals from the backend.</p></div><Activity className="text-[#087F5B]" size={20}/></div><div className="mt-5 grid grid-cols-3 gap-2 text-center"><Telemetry label="Jobs pending" value={monitoring?.background_jobs?.pending ?? "—"}/><Telemetry label="Calls queued" value={monitoring?.scheduled_calls?.pending ?? "—"}/><Telemetry label="AI failures" value={monitoring?.ai_failures_last_24h ?? "—"}/></div><div className="mt-4 space-y-2">{monitoring?.alerts?.length ? monitoring.alerts.map((alert) => <Alert key={`${alert.code}-${alert.provider || ""}`} title={alert.code.replaceAll("_", " ")} text={`${alert.severity}${alert.provider ? ` · ${alert.provider}` : ""}${alert.count !== undefined ? ` · ${alert.count}` : ""}`}/>) : <Alert good title="No active runtime alerts" text="Queues and provider circuits are within the current thresholds."/>}</div></CardContent></Card><Card className="border-[#D9E7DD] shadow-sm"><CardContent className="p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold text-[#19372B]">Production readiness</h2><p className="mt-1 text-sm text-slate-500">Deployment safeguards and external operations checks.</p></div><ShieldCheck className="text-[#087F5B]" size={20}/></div><div className="mt-5 space-y-3">{monitoring?.production_readiness?.configuration_gaps?.length ? monitoring.production_readiness.configuration_gaps.map(gap => <Alert key={gap.code} title={gap.code.replaceAll("_", " ")} text={gap.action}/>) : <Alert good title="Production readiness verified" text="Required operational safeguards are configured."/>}</div></CardContent></Card><Card className="border-[#D9E7DD] shadow-sm"><CardContent className="p-6"><h2 className="text-lg font-bold text-[#19372B]">Configuration alerts</h2><p className="mt-1 text-sm text-slate-500">Safe checks only. No provider key is exposed.</p><div className="mt-5 space-y-3">{providers.filter(p => !p.configured).length === 0 ? <Alert good title="All listed services configured" text="Provider routing can use the configured services."/> : providers.filter(p => !p.configured).map(p => <Alert key={p.id} title={`${p.name} needs configuration`} text={`${p.category} cannot become active until its server key is added.`}/>)}</div><a href="/admin/system/ai-providers" className="mt-6 flex items-center justify-center rounded-xl bg-[#0C4A31] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0A3D29]">Open provider routing</a></CardContent></Card></div></section>
  </div>;
}

function Metric({ icon: Icon, label, value, good }: { icon: typeof Activity; label: string; value: string; good: boolean }) { return <Card className="border-[#D9E7DD] shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E6F6EB] text-[#087F5B]"><Icon size={18}/></span><span className={`h-2.5 w-2.5 rounded-full ${good ? "bg-[#19B965] shadow-[0_0_0_4px_#DCF7E4]" : "bg-amber-500 shadow-[0_0_0_4px_#FEF3C7]"}`}/></div><p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-[#1C3A2D]">{value}</p></CardContent></Card>; }
function Telemetry({ label, value }: { label: string; value: number | string }) { return <div className="rounded-xl border border-[#E2EDE4] bg-[#FBFDFC] px-2 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#6A8B76]">{label}</p><p className="mt-1 text-xl font-bold text-[#1C3A2D]">{value}</p></div>; }
function Alert({ title, text, good = false }: { title: string; text: string; good?: boolean }) { const Icon = good ? CheckCircle2 : CircleAlert; return <div className={`flex gap-3 rounded-xl border p-3 ${good ? "border-[#C7E9D0] bg-[#F1FBF4]" : "border-amber-200 bg-amber-50"}`}><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${good ? "text-[#159653]" : "text-amber-600"}`}/><div><p className="text-sm font-bold text-[#315342]">{title}</p><p className="mt-0.5 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
