import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity } from "lucide-react";

export interface HealthItem {
  id: string;
  name: string;
  category: string;
  isHealthy: boolean;
  value?: string | number;
  valueLabel?: string;
}

interface OverviewHealthCardProps {
  title: string;
  description?: string;
  items: HealthItem[];
  icon?: React.ElementType;
  delayMs?: number;
  emptyMessage?: string;
}

export function OverviewHealthCard({
  title,
  description,
  items,
  icon: Icon = Activity,
  delayMs = 400,
  emptyMessage = "No health data available.",
}: OverviewHealthCardProps) {
  return (
    <Card 
      className="shadow-sm animate-in fade-in slide-in-from-bottom-4 flex h-full flex-col" 
      style={{ animationDuration: '500ms', animationDelay: `${delayMs}ms`, animationFillMode: 'backwards' }}
    >
      <CardHeader className="pb-3 border-b border-slate-50 mb-2 shrink-0">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-slate-400"/> {title}</span>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-0 py-0 flex-1 overflow-hidden flex flex-col">
        {!items || items.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 m-auto">{emptyMessage}</div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.isHealthy ? 'bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900 capitalize">{item.name}</div>
                    <div className="text-[11px] font-medium text-slate-500">{item.category}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {item.value !== undefined && (
                    <span className="text-[13px] font-bold text-slate-700">
                      {item.value} {item.valueLabel && <span className="text-[10px] font-medium text-slate-500">{item.valueLabel}</span>}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${item.isHealthy ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {item.isHealthy ? 'Healthy' : 'Degraded'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
