import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { Activity, BarChart3, TrendingUp } from "lucide-react";

export interface ActivityDataPoint {
  date: string;
  count: number;
}

interface OverviewActivityChartProps {
  title: string;
  description?: string;
  data: ActivityDataPoint[];
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-lg">
        <p className="font-semibold text-slate-800 text-sm mb-1">{fmtTooltipDate(String(label))}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function OverviewActivityChart({
  title,
  description,
  data,
  delayMs = 300,
}: OverviewActivityChartProps) {
  const total = data.reduce((sum, point) => sum + (Number(point.count) || 0), 0);
  const peak = data.reduce<ActivityDataPoint | null>(
    (highest, point) => (!highest || point.count > highest.count ? point : highest),
    null,
  );
  const first = data[0]?.count || 0;
  const latest = data[data.length - 1]?.count || 0;
  const trend = first > 0 ? ((latest - first) / first) * 100 : null;

  return (
    <Card 
      className="shadow-sm animate-in fade-in slide-in-from-bottom-4 flex h-full flex-col" 
      style={{ animationDuration: '500ms', animationDelay: `${delayMs}ms`, animationFillMode: 'backwards' }}
    >
      <CardHeader className="border-b border-slate-50 px-5 pb-3 pt-4 mb-0 shrink-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#5F786D]" />
              {title}
            </CardTitle>
            {description && <CardDescription className="mt-1 text-xs">{description}</CardDescription>}
          </div>
          {data.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1"><BarChart3 className="h-3 w-3" /> {total.toLocaleString()} total</span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700"><TrendingUp className="h-3 w-3" /> Peak {peak?.count.toLocaleString() || 0}</span>
            </div>
          )}
        </div>
        {data.length > 1 && <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500"><span>Latest: <b className="text-slate-700">{latest.toLocaleString()}</b></span><span className="text-slate-300">•</span><span className={trend !== null && trend >= 0 ? "text-emerald-700" : "text-amber-700"}>{trend === null ? "Trend unavailable" : `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}% vs period start`}</span></div>}
      </CardHeader>
      <CardContent className="min-h-[250px] flex-1 px-4 pb-4 pt-3">
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5F786D" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#5F786D" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={fmtAxisDate} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} tickMargin={8} />
              <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="monotone" name="Activity" dataKey="count" stroke="#5F786D" strokeWidth={2.5} fillOpacity={1} fill="url(#colorActivity)" activeDot={{ r: 5, strokeWidth: 0, fill: '#5F786D' }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Activity className="h-8 w-8 mb-2 opacity-20" />
            <span className="text-sm">No activity recorded in this period.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
