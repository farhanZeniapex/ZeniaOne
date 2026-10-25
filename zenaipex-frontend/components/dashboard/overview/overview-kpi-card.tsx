import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

interface OverviewKpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: React.ReactNode;
  iconBgColor?: string;
  iconTextColor?: string;
  delayMs?: number;
  href?: string;
}

export function OverviewKpiCard({
  title,
  value,
  icon: Icon,
  subtext,
  iconBgColor = "bg-slate-50",
  iconTextColor = "text-slate-500",
  delayMs = 0,
  href,
}: OverviewKpiCardProps) {
  const cardContent = (
    <Card 
      className={`shadow-sm transition-all duration-200 animate-in fade-in slide-in-from-bottom-4 group ${href ? 'hover:shadow-md hover:-translate-y-0.5 hover:border-sage-300 cursor-pointer' : ''}`}
      style={{ animationDuration: '400ms', animationDelay: `${delayMs}ms`, animationFillMode: 'backwards' }}
    >
      <CardContent className="p-5 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{title}</span>
          <div className={`${iconBgColor} p-1.5 rounded-lg ${iconTextColor} group-hover:scale-110 transition-transform duration-200`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-auto">
          <div className="text-3xl font-bold text-slate-900 tracking-tight">{value}</div>
          {subtext && (
            <div className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wide">
              {subtext}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} aria-label={`View details for ${title}`} className="block h-full">{cardContent}</Link>;
  }
  
  return <div className="h-full">{cardContent}</div>;
}
