"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, HardDrive, CheckCircle2, Clock, MessageSquare, Zap, Fingerprint, Coins, ChevronDown, ChevronRight } from "lucide-react";
import { useCurrentCompany } from "@/hooks/use-company";
import { fetchApi } from "@/lib/api/client";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

export default function UsagePage({ isInternalWorkspace = false }: { isInternalWorkspace?: boolean }) {
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  const toggleProvider = (provider: string) => {
    setExpandedProviders(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  useEffect(() => {
    if (!companyId) return;
    
    setIsLoading(true);
    fetchApi<any>(`/companies/${companyId}/subscription`)
      .then(res => {
        setData(res);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [companyId]);

  if (isCompanyLoading || isLoading) {
    return <PageLoadingSkeleton cards={3} />;
  }

  const sub = data?.subscription || {};
  const usage = data?.usage || {};

  const planName = (sub.plan || "free_trial").replace("_", " ");
  
  // Usage Values
  const creditsUsed = usage.ai_credits_used || 0;
  const creditsLimit = usage.ai_credits_limit || 20;
  const isCreditsUnlimited = creditsLimit >= 999999;
  const creditsPct = Math.min(100, (creditsUsed / Math.max(creditsLimit, 1)) * 100);
  const creditsRemaining = Math.max(0, creditsLimit - creditsUsed);

  const minutesUsed = usage.call_minutes_used || 0;
  const minutesLimit = usage.call_minutes_limit || 60;
  const isMinutesUnlimited = minutesLimit >= 999999;
  const minutesPct = Math.min(100, (minutesUsed / Math.max(minutesLimit, 1)) * 100);

  const agentsUsed = usage.agents_used || 0;
  const agentsLimit = usage.agents_limit || 1;
  const isAgentsUnlimited = agentsLimit >= 999999;
  const agentsPct = Math.min(100, (agentsUsed / Math.max(agentsLimit, 1)) * 100);

  const docsUsed = usage.kb_docs_used || 0;
  const docsLimit = usage.kb_docs_limit || 10;
  const isDocsUnlimited = docsLimit >= 999999;
  const docsPct = Math.min(100, (docsUsed / Math.max(docsLimit, 1)) * 100);

  const channelsUsed = usage.channels_used || 0;
  const channelsLimit = usage.channels_limit || 1;
  const isChannelsUnlimited = channelsLimit >= 999999;
  const channelsPct = Math.min(100, (channelsUsed / Math.max(channelsLimit, 1)) * 100);

  // Billing Cycle Formatting
  const formatBillingCycle = (monthStr: string) => {
    if (!monthStr) return "Current Cycle";
    const [y, m] = monthStr.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };
  const billingCycleLabel = formatBillingCycle(usage.month);

  // AI Usage Calculations
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalLatency = 0;
  let latencyCount = 0;
  
  if (usage.provider_usage_table && Array.isArray(usage.provider_usage_table)) {
    usage.provider_usage_table.forEach((prov: any) => {
      totalSuccess += prov.success || 0;
      totalFailed += prov.failed || 0;
      if (prov.models && Array.isArray(prov.models)) {
        prov.models.forEach((mod: any) => {
          if (mod.api_calls > 0 && mod.avg_latency > 0) {
            totalLatency += mod.avg_latency;
            latencyCount += 1;
          }
        });
      }
    });
  }
  const avgLatency = latencyCount > 0 ? (totalLatency / latencyCount).toFixed(0) : "0";
  
  // Voice Usage Calculations
  const voiceTurns = usage.call_count || 0;
  const avgTurnDurationSec = voiceTurns > 0 ? ((usage.call_minutes_used * 60) / voiceTurns).toFixed(1) : "0.0";
  const totalConvs = usage.total_conversations || 0;


  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{isInternalWorkspace ? "My Usage" : "Usage & Analytics"}</h2>
          {isInternalWorkspace ? (
            <>
              <p className="text-sm font-semibold text-sage-600 uppercase tracking-wide mt-2">Platform Workspace</p>
              <p className="mt-1 text-slate-500">Monitor your workspace usage and resource limits for the <span className="font-semibold text-slate-700">{billingCycleLabel}</span> billing cycle.</p>
            </>
          ) : (
            <p className="mt-1 text-slate-500">Monitor your workspace usage and resource limits for the <span className="font-semibold text-slate-700">{billingCycleLabel}</span> billing cycle.</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-sm border-sage-200 ring-1 ring-sage-100 relative overflow-hidden md:col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sage-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-70"></div>
          <CardHeader className="relative">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Current Plan</CardTitle>
            <div className="mt-2 text-3xl font-bold text-slate-900 capitalize">{planName}</div>
            <CardDescription className="mt-1 text-sage-600 font-medium capitalize">Status: {sub.status || "Trial"}</CardDescription>
          </CardHeader>
          <CardContent className="relative space-y-4">
            <ul className="space-y-2.5 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 
                {isCreditsUnlimited ? "Unlimited" : creditsLimit.toLocaleString()} AI Credits / mo
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 
                {isMinutesUnlimited ? "Unlimited" : minutesLimit.toLocaleString()} Voice Minutes / mo
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 
                {isAgentsUnlimited ? "Unlimited" : `Up to ${agentsLimit.toLocaleString()} AI Agents`}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 
                {isDocsUnlimited ? "Unlimited" : `Up to ${docsLimit.toLocaleString()} Knowledge Docs`}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 
                {isChannelsUnlimited ? "Unlimited" : `Up to ${channelsLimit.toLocaleString()} Channels`}
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 md:col-span-2 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg text-slate-800">Resource Limits</CardTitle>
            <CardDescription>Your current usage for the {billingCycleLabel} billing cycle.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-slate-800">AI Credits</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-0.5">Credits consumed by AI interactions.</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">{creditsUsed.toFixed(1)}</span>
                    <span className="text-sm font-medium text-slate-400">
                      {isCreditsUnlimited ? " used · Unlimited" : ` / ${creditsLimit.toLocaleString()}`}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  {isCreditsUnlimited ? (
                    <div className="h-full w-full bg-slate-200 rounded-full" />
                  ) : (
                    <div 
                      className={`h-full transition-all rounded-full min-w-[4px] ${creditsPct >= 100 ? "bg-red-500" : creditsPct >= 90 ? "bg-red-400" : creditsPct >= 70 ? "bg-amber-500" : "bg-gradient-to-r from-amber-400 to-amber-500"}`} 
                      style={{ width: `${Math.max(creditsPct, 1)}%` }} 
                    />
                  )}
                </div>
                {!isCreditsUnlimited && creditsUsed > creditsLimit ? (
                  <p className="text-[11px] text-red-600 font-medium">Exceeded limit</p>
                ) : !isCreditsUnlimited && creditsPct >= 100 ? (
                  <p className="text-[11px] text-red-600 font-medium">Limit reached</p>
                ) : !isCreditsUnlimited && creditsPct >= 70 ? (
                  <p className="text-[11px] text-amber-600 font-medium">{creditsRemaining.toFixed(1)} remaining</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-sage-500" />
                      <span className="font-semibold text-slate-800">Voice Minutes</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-0.5">Minutes consumed by voice conversations.</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">{minutesUsed.toFixed(1)}</span>
                    <span className="text-sm font-medium text-slate-400">
                      {isMinutesUnlimited ? " used · Unlimited" : ` / ${minutesLimit.toLocaleString()}`}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  {isMinutesUnlimited ? (
                    <div className="h-full w-full bg-slate-200 rounded-full" />
                  ) : (
                    <div className={`h-full transition-all rounded-full min-w-[4px] ${minutesPct >= 100 ? "bg-red-500" : minutesPct >= 90 ? "bg-red-400" : minutesPct >= 70 ? "bg-amber-500" : "bg-gradient-to-r from-sage-400 to-sage-500"}`} style={{ width: `${Math.max(minutesPct, 1)}%` }} />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-sage-500" />
                    <span className="font-semibold text-slate-800">Active Agents</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">{agentsUsed}</span>
                    <span className="text-sm font-medium text-slate-400">{isAgentsUnlimited ? " used · Unlimited" : ` / ${agentsLimit}`}</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  {isAgentsUnlimited ? (
                    <div className="h-full w-full bg-slate-200 rounded-full" />
                  ) : (
                    <div className={`h-full transition-all rounded-full min-w-[4px] ${agentsPct >= 100 ? "bg-red-500" : agentsPct >= 90 ? "bg-red-400" : agentsPct >= 70 ? "bg-amber-500" : "bg-gradient-to-r from-slate-400 to-slate-500"}`} style={{ width: `${Math.max(agentsPct, 1)}%` }} />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold text-slate-800">Knowledge Documents</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">{docsUsed}</span>
                    <span className="text-sm font-medium text-slate-400">{isDocsUnlimited ? " used · Unlimited" : ` / ${docsLimit}`}</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  {isDocsUnlimited ? (
                    <div className="h-full w-full bg-slate-200 rounded-full" />
                  ) : (
                    <div className={`h-full transition-all rounded-full min-w-[4px] ${docsPct >= 100 ? "bg-red-500" : docsPct >= 90 ? "bg-red-400" : docsPct >= 70 ? "bg-amber-500" : "bg-gradient-to-r from-emerald-400 to-emerald-500"}`} style={{ width: `${Math.max(docsPct, 1)}%` }} />
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-500" />
                    <span className="font-semibold text-slate-800">Connected Channels</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">{channelsUsed}</span>
                    <span className="text-sm font-medium text-slate-400">{isChannelsUnlimited ? " used · Unlimited" : ` / ${channelsLimit}`}</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  {isChannelsUnlimited ? (
                    <div className="h-full w-full bg-slate-200 rounded-full" />
                  ) : (
                    <div className={`h-full transition-all rounded-full min-w-[4px] ${channelsPct >= 100 ? "bg-red-500" : channelsPct >= 90 ? "bg-red-400" : channelsPct >= 70 ? "bg-amber-500" : "bg-gradient-to-r from-indigo-400 to-indigo-500"}`} style={{ width: `${Math.max(channelsPct, 1)}%` }} />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upgrade Banner for exhausted limits */}
        {!isInternalWorkspace && !isCreditsUnlimited && creditsPct >= 100 && (
          <Card className="shadow-sm border-red-200 bg-red-50 md:col-span-3">
            <CardContent className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-red-900 text-lg">AI Credit Limit Reached</h3>
                <p className="text-red-700 text-sm">Upgrade your plan to continue using AI features.</p>
              </div>
              <Button disabled className="bg-red-600 hover:bg-red-700 text-white shrink-0">
                Payment gateway coming soon
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2 md:col-span-3">
          {/* AI Analytics Card */}
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg text-slate-800">Detailed AI Usage</CardTitle>
              <CardDescription>Live metrics for AI interactions and tokens consumed.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100">
                <div className="p-6 space-y-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-50 text-amber-500 border border-amber-100/50">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Requests</div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{usage.llm_api_calls?.toLocaleString() || 0}</div>
                  <div className="text-xs text-slate-500 pt-1 font-medium">
                    <span className="text-emerald-600">{totalSuccess.toLocaleString()}</span> success <span className="mx-1 text-slate-300">•</span> <span className="text-rose-500">{totalFailed.toLocaleString()}</span> failed
                  </div>
                </div>
                <div className="p-6 space-y-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-indigo-50 text-indigo-500 border border-indigo-100/50">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Tokens</div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{usage.total_tokens?.toLocaleString() || 0}</div>
                  <div className="text-xs text-slate-500 pt-1 font-medium flex items-center gap-3">
                    <span><span className="text-blue-600">{usage.input_tokens?.toLocaleString() || 0}</span> in</span>
                    <span><span className="text-emerald-600">{usage.output_tokens?.toLocaleString() || 0}</span> out</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 bg-slate-50/30">
                <div className="p-5">
                  <div className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-400" /> Avg Latency</div>
                  <div className="text-xl font-bold text-slate-800">{avgLatency} <span className="text-xs font-normal text-slate-500">ms</span></div>
                </div>
                <div className="p-5">
                  <div className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5 text-teal-400" /> RAG Queries</div>
                  <div className="text-xl font-bold text-slate-800">{usage.rag_queries?.toLocaleString() || 0}</div>
                </div>
                <div className="p-5">
                  <div className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-blue-400" /> Conversations</div>
                  <div className="text-xl font-bold text-slate-800">{totalConvs.toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voice Analytics Card */}
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
              <CardTitle className="text-lg text-slate-800">Detailed Voice Usage</CardTitle>
              <CardDescription>Live metrics for voice conversations and audio processing.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
               <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100 h-full">
                <div className="p-6 space-y-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-sage-50 text-sage-600 border border-sage-100/50">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Minutes</div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{minutesUsed.toFixed(1)}</div>
                </div>
                <div className="p-6 space-y-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-sky-50 text-sky-500 border border-sky-100/50">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">Voice Turns</div>
                  </div>
                  <div className="text-3xl font-bold text-slate-900">{voiceTurns.toLocaleString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 divide-slate-100 bg-slate-50/30">
                 <div className="p-5 flex items-center justify-between">
                  <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-slate-400" /> Average Turn Duration</div>
                  <div className="text-xl font-bold text-slate-800">{avgTurnDurationSec} <span className="text-xs font-normal text-slate-500">sec</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
