import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Clock, MessageSquare, Activity } from "lucide-react";

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string | React.ReactNode;
  status?: string;
  statusColor?: string;
  icon?: React.ElementType;
  avatarUrl?: string;
  avatarLabel?: string;
}

interface OverviewRecentActivityProps {
  title: string;
  description?: string;
  items: ActivityItem[];
  viewAllLink?: string;
  delayMs?: number;
  emptyMessage?: string;
}

export function OverviewRecentActivity({
  title,
  description,
  items,
  viewAllLink,
  delayMs = 500,
  emptyMessage = "No recent activity.",
}: OverviewRecentActivityProps) {
  return (
    <Card
      className="shadow-sm animate-in fade-in slide-in-from-bottom-4 flex h-full flex-col"
      style={{
        animationDuration: "500ms",
        animationDelay: `${delayMs}ms`,
        animationFillMode: "backwards",
      }}
    >
      <CardHeader className="pb-3 border-b border-slate-50 mb-2 shrink-0">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" /> {title}
          </span>
          {viewAllLink && (
            <Link href={viewAllLink}>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] font-bold uppercase tracking-wider text-sage-600 hover:text-sage-700"
              >
                View All
              </Button>
            </Link>
          )}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-0 py-0 flex-1 overflow-hidden flex flex-col">
        {!items || items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 m-auto">
            {emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {items.slice(0, 5).map((act) => {
              const Icon = act.icon || Activity;
              return (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-50/80 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0 bg-slate-100 h-9 w-9 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-sage-100 group-hover:text-sage-600 transition-colors overflow-hidden">
                      {act.avatarUrl ? (
                        <img
                          src={act.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : act.avatarLabel ? (
                        <span className="text-xs font-bold text-emerald-700">
                          {act.avatarLabel}
                        </span>
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">
                        {act.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mt-0.5">
                        <span className="truncate">{act.subtitle}</span>
                        <span>•</span>
                        <span>{act.timestamp}</span>
                      </div>
                    </div>
                  </div>
                  {act.status && (
                    <div className="flex items-center shrink-0">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${act.statusColor || "bg-slate-50 text-slate-600 border-slate-200/50"}`}
                      >
                        {act.status}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
