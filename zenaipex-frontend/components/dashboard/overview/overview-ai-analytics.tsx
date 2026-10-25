import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { 
  Server, Activity, Database, Coins, ShieldAlert, Cpu, BarChart3, ChevronDown, ChevronRight, CheckCircle2
} from "lucide-react";

export interface ProviderUsageItem {
  provider_id: string;
  provider_name: string;
  model: string;
  enabled: boolean;
  usage: {
    api_calls: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    success_count: number;
    failure_count: number;
    last_used: string | null;
    latency: number | null;
    avg_latency_ms?: number | null;
  };
  zeniaai_cost: {
    amount_inr: number;
  };
  sync: {
    status: string;
  };
}

interface OverviewAiAnalyticsProps {
  dailyData: any[]; // daily_llm from trends
  providers: ProviderUsageItem[]; // unified-state providers
  failureReasons: any[]; // failure_reasons from trends
  delayMs?: number;
}

function fmtAxisDate(val: string): string {
  try {
    const parts = val.split("-");
    if (parts.length !== 3) return val;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`;
  } catch {
    return val;
  }
}

function fmtTooltipDate(val: string): string {
  try {
    const parts = val.split("-");
    if (parts.length !== 3) return val;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return val;
  }
}

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-lg">
        {label && <p className="font-semibold text-slate-800 text-sm mb-1">{fmtTooltipDate(String(label))}</p>}
        {payload.map((entry: any, index: number) => {
          let val = entry.value;
          if (formatter) {
             val = formatter(val, entry.name);
          } else if (entry.dataKey === 'cost') {
             val = `₹${Number(val).toFixed(2)}`;
          } else if (typeof val === 'number') {
             val = val.toLocaleString();
          }
          
          return (
            <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
              {entry.name}: {val}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

// Colors for outcomes pie chart
const OUTCOME_COLORS: Record<string, string> = {
  "Successful": "#10b981", // emerald-500
  "Quota / Rate Limit": "#f59e0b", // amber-500
  "Timeout": "#f97316", // orange-500
  "Service Unavailable": "#ef4444", // red-500
  "Authentication Failed": "#8b5cf6", // violet-500
  "Model Unavailable": "#ec4899", // pink-500
  "Network Error": "#64748b", // slate-500
  "Other": "#94a3b8", // slate-400
};

export function OverviewAiAnalytics({
  dailyData,
  providers,
  failureReasons,
  delayMs = 500,
}: OverviewAiAnalyticsProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate totals from daily data
  const totalRequests = dailyData?.reduce((acc, curr) => acc + (curr.api_calls || 0), 0) || 0;
  const totalTokens = dailyData?.reduce((acc, curr) => acc + (curr.total_tokens || 0), 0) || 0;
  const totalCost = dailyData?.reduce((acc, curr) => acc + (curr.cost || 0), 0) || 0;
  const totalSuccess = dailyData?.reduce((acc, curr) => acc + (curr.success || 0), 0) || 0;
  const totalFailed = dailyData?.reduce((acc, curr) => acc + (curr.failed || 0), 0) || 0;
  
  const totalCalls = totalSuccess + totalFailed;
  const successRate = totalCalls > 0 ? ((totalSuccess / totalCalls) * 100).toFixed(1) : "0.0";

  // Prepare Outcomes Data
  const outcomesData = [];
  if (totalSuccess > 0) {
    outcomesData.push({ name: "Successful", value: totalSuccess, fill: OUTCOME_COLORS["Successful"] });
  }
  if (failureReasons && failureReasons.length > 0) {
    failureReasons.forEach(fr => {
      outcomesData.push({ 
        name: fr.reason, 
        value: fr.count,
        fill: OUTCOME_COLORS[fr.reason] || OUTCOME_COLORS["Other"]
      });
    });
  }
  
  // Custom tooltip for donut
  const DonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: data.fill }}></span>
            <span className="text-slate-800">{data.name}:</span>
            <span className="font-bold text-slate-900">{data.value.toLocaleString()}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div 
      className="space-y-6 animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDuration: '500ms', animationDelay: `${delayMs}ms`, animationFillMode: 'backwards' }}
    >
      {/* ── Section Header ── */}
      <div className="pb-2 border-b border-slate-200">
        <h3 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Database className="h-5 w-5 text-sage-600" /> AI Usage & Cost Analytics
        </h3>
        <p className="text-sm text-slate-500 font-medium mt-1">Platform-wide AI usage, model performance, and cost insights.</p>
      </div>

      {/* ── Summary Metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Total AI Requests</span>
            <span className="text-2xl font-bold text-slate-900">{totalRequests.toLocaleString()}</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Total Tokens</span>
            <span className="text-2xl font-bold text-slate-900">{totalTokens.toLocaleString()}</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Total AI Cost</span>
            <span className="text-2xl font-bold text-slate-900">₹{totalCost.toFixed(2)}</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Success Rate</span>
            <span className={`text-2xl font-bold ${parseFloat(successRate) >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {totalCalls > 0 ? `${successRate}%` : "N/A"}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Request Trend & Outcomes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Trend */}
        <Card className="shadow-sm flex flex-col h-full lg:col-span-2">
          <CardHeader className="pb-2 border-b border-slate-50 mb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-400" />
              AI Request Trend
            </CardTitle>
            <CardDescription>Actual requests over the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 min-h-[250px] flex-1">
            {dailyData && dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 8, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={fmtAxisDate} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} tickMargin={8} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" name="Requests" dataKey="api_calls" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRequests)" activeDot={{ r: 5, strokeWidth: 0, fill: '#8b5cf6' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <span className="text-sm">No requests recorded.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Outcomes */}
        <Card className="shadow-sm flex flex-col h-full">
          <CardHeader className="pb-2 border-b border-slate-50 mb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-400" />
              Request Outcomes
            </CardTitle>
            <CardDescription>Successful vs Failed requests.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 min-h-[250px] flex-1 flex flex-col justify-center items-center">
            {outcomesData.length > 0 ? (
              <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={outcomesData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {outcomesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-2 w-full px-4">
                  {outcomesData.slice(0, 4).map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }}></span>
                      {entry.name}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <span className="text-sm">No outcomes recorded.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Token Usage & Cost Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage */}
        <Card className="shadow-sm flex flex-col h-full">
          <CardHeader className="pb-2 border-b border-slate-50 mb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-slate-400" />
              Token Usage
            </CardTitle>
            <CardDescription>Input and output token consumption.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 min-h-[250px] flex-1">
            {dailyData && dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 8, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={fmtAxisDate} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="input_tokens" name="Input Tokens" stackId="a" fill="#64748b" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="output_tokens" name="Output Tokens" stackId="a" fill="#cbd5e1" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <span className="text-sm">No token data recorded.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Cost Trend */}
        <Card className="shadow-sm flex flex-col h-full">
          <CardHeader className="pb-2 border-b border-slate-50 mb-2 shrink-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4 text-slate-400" />
              AI Cost Trend
            </CardTitle>
            <CardDescription>AI spending over the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 min-h-[250px] flex-1">
            {dailyData && dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 8, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={fmtAxisDate} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `₹${v}`} />
                  <RechartsTooltip content={<CustomTooltip formatter={(v: any) => `₹${Number(v).toFixed(2)}`} />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                  <Area type="monotone" name="Cost" dataKey="cost" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCost)" activeDot={{ r: 5, strokeWidth: 0, fill: '#10b981' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <span className="text-sm">No cost data recorded.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Provider & Model Table ── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-50 mb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2"><Server className="h-4 w-4 text-slate-400"/> Provider & Model Performance</span>
          </CardTitle>
          <CardDescription>Detailed telemetry for active AI models.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0 overflow-x-auto">
          {!providers || providers.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No provider usage recorded.</div>
          ) : (
            <div className="min-w-[800px]">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Provider & Model</th>
                    <th className="px-4 py-3 font-semibold text-right">API Calls</th>
                    <th className="px-4 py-3 font-semibold text-right">Success Rate</th>
                    <th className="px-4 py-3 font-semibold text-right">Cost</th>
                    <th className="px-4 py-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {providers.map((p) => {
                    const id = p.provider_id;
                    const isExpanded = expandedRows[id] || false;
                    const reqTotal = p.usage.success_count + p.usage.failure_count;
                    const sr = reqTotal > 0 ? ((p.usage.success_count / reqTotal) * 100).toFixed(1) : "0.0";
                    
                    return (
                      <React.Fragment key={id}>
                        {/* Main Row */}
                        <tr 
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          onClick={() => toggleRow(id)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 capitalize">{p.provider_name}</span>
                                <span className="text-xs text-slate-500">{p.model}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">
                            {p.usage.api_calls.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-semibold ${parseFloat(sr) >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {reqTotal > 0 ? `${sr}%` : "N/A"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-sage-700">
                            ₹{p.zeniaai_cost.amount_inr.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {p.enabled ? (
                              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                <CheckCircle2 className="h-3 w-3" /> Active
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                Inactive
                              </div>
                            )}
                          </td>
                        </tr>
                        
                        {/* Expanded Details Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={5} className="p-0">
                              <div className="px-10 py-5 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-200">
                                
                                {/* Calls Details */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Requests</h4>
                                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    <div className="text-slate-500">API Calls:</div>
                                    <div className="text-right font-medium text-slate-900">{p.usage.api_calls.toLocaleString()}</div>
                                    <div className="text-slate-500">Successful:</div>
                                    <div className="text-right font-medium text-emerald-600">{p.usage.success_count.toLocaleString()}</div>
                                    <div className="text-slate-500">Failed:</div>
                                    <div className="text-right font-medium text-red-500">{p.usage.failure_count.toLocaleString()}</div>
                                  </div>
                                </div>

                                {/* Token Details */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tokens</h4>
                                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    <div className="text-slate-500">Input:</div>
                                    <div className="text-right font-medium">{p.usage.input_tokens.toLocaleString()}</div>
                                    <div className="text-slate-500">Output:</div>
                                    <div className="text-right font-medium">{p.usage.output_tokens.toLocaleString()}</div>
                                    <div className="text-slate-700 font-semibold border-t border-slate-200 pt-1">Total:</div>
                                    <div className="text-right font-bold border-t border-slate-200 pt-1">{p.usage.total_tokens.toLocaleString()}</div>
                                  </div>
                                </div>
                                
                                {/* Performance */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Performance</h4>
                                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    <div className="text-slate-500">Cost:</div>
                                    <div className="text-right font-medium text-sage-600">₹{p.zeniaai_cost.amount_inr.toFixed(2)}</div>
                                    <div className="text-slate-500">Avg Latency:</div>
                                    <div className="text-right font-medium">{p.usage.latency ? `${p.usage.latency}ms` : "Not available"}</div>
                                    <div className="text-slate-500">Last Used:</div>
                                    <div className="text-right font-medium">{p.usage.last_used ? formatDistanceToNow(new Date(p.usage.last_used), { addSuffix: true }) : "Never"}</div>
                                  </div>
                                </div>
                                
                                {/* Failures */}
                                <div className="space-y-3">
                                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                    <ShieldAlert className="h-3 w-3" /> Failure Breakdown
                                  </h4>
                                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    {p.usage.failure_count === 0 ? (
                                      <div className="col-span-2 text-slate-400 text-sm">No failures recorded.</div>
                                    ) : (
                                      <>
                                        <div className="text-slate-500 truncate">Total Failed:</div>
                                        <div className="text-right font-medium text-red-500">{p.usage.failure_count.toLocaleString()}</div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
