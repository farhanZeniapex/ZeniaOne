import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HelpCircle } from "lucide-react";

export interface QuestionItem {
  question: string;
  count: number;
}

interface OverviewTopQuestionsProps {
  title: string;
  description?: string;
  items: QuestionItem[];
  delayMs?: number;
  emptyMessage?: string;
}

export function OverviewTopQuestions({
  title,
  description,
  items,
  delayMs = 550,
  emptyMessage = "Not enough data to extract topics.",
}: OverviewTopQuestionsProps) {
  return (
    <Card 
      className="shadow-sm animate-in fade-in slide-in-from-bottom-4 flex h-full flex-col" 
      style={{ animationDuration: '500ms', animationDelay: `${delayMs}ms`, animationFillMode: 'backwards' }}
    >
      <CardHeader className="pb-3 border-b border-slate-50 mb-2 shrink-0">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><HelpCircle className="h-4 w-4 text-slate-400"/> {title}</span>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="px-0 py-0 flex-1 overflow-y-auto">
        {!items || items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">{emptyMessage}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.slice(0, 5).map((q, i) => (
              <div key={i} className="flex gap-4 p-4 hover:bg-slate-50/80 transition-colors group">
                <div className="shrink-0 flex items-center justify-center h-6 w-6 rounded-md bg-slate-100 text-slate-500 font-bold text-xs group-hover:bg-sage-100 group-hover:text-sage-700 transition-colors">
                  {(i + 1).toString().padStart(2, '0')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-800 line-clamp-2 leading-snug pr-4">{q.question}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sage-600 mt-1">{q.count} occurrences</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
