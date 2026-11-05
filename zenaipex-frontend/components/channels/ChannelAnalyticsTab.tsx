"use client";

import React from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Loader2,
  BarChart,
  Clock,
  Zap,
  Database,
  Phone,
  Voicemail,
  MessageSquare,
  Bot,
} from "lucide-react";

export interface ChannelAnalyticsTabProps {
  analytics: any;
  setActiveTab: (tab: any) => void;
  formatSecs: (secs: number) => string;
  openCallDetails: (call: any) => void;
}

export default function ChannelAnalyticsTab({
  analytics,
  setActiveTab,
  formatSecs,
  openCallDetails,
}: ChannelAnalyticsTabProps) {
  if (!analytics) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-slate-300 animate-spin mb-4" />
        <p className="text-sm font-medium text-slate-500">
          Loading analytics...
        </p>
      </div>
    );
  }

  if (analytics.total_calls === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center min-h-[300px] text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <BarChart className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-1">
          No call data yet
        </h3>
        <p className="text-slate-500 max-w-sm mb-6 text-sm">
          There are no conversation records available for this channel yet.
        </p>
        <button
          onClick={() => setActiveTab("overview")}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
        >
          Return to Overview
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* SECTION 1: Usage & Plan Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Channel Talk Time
          </p>
          <div className="text-2xl font-bold text-slate-900">
            {analytics.subscription?.channel_call_minutes?.toFixed(1) ??
              (analytics.total_duration / 60).toFixed(1)}{" "}
            min
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {analytics.total_calls} total calls &middot; avg{" "}
            {formatSecs(analytics.average_duration)} per call
          </p>
        </div>

        {analytics.subscription ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Plan
              {analytics.subscription.usage_month
                ? ` — ${analytics.subscription.usage_month}`
                : ""}
            </p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-bold text-slate-900 capitalize">
                {analytics.subscription.plan}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  analytics.subscription.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {analytics.subscription.status}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Company-wide:{" "}
              {analytics.subscription.company_call_count?.toLocaleString() ?? "—"}{" "}
              calls &middot;{" "}
              {analytics.subscription.company_call_minutes_used?.toFixed(1) ?? "—"}{" "}
              min used
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center">
            <p className="text-sm text-slate-400">
              Subscription data not available
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> Cost Data
          </p>
          <p className="text-sm font-medium text-slate-600">Not configured</p>
          <p className="text-xs text-slate-400 mt-1">
            Per-call pricing is not set up for this system.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SECTION 2 & 3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Call Activity Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
                Call Activity
              </h3>
            </div>
            <div className="px-5 pt-4 pb-4">
              {analytics.call_trend?.length > 0 ? (
                (() => {
                  const formatDateStr = (d: string) => {
                    if (!d) return "";
                    return format(new Date(d), "MMM d");
                  };
                  const firstDate = analytics.call_trend[0]?.date;
                  const lastDate =
                    analytics.call_trend[analytics.call_trend.length - 1]?.date;
                  const dateRangeStr =
                    firstDate && lastDate
                      ? firstDate === lastDate
                        ? formatDateStr(firstDate)
                        : `${formatDateStr(firstDate)} - ${formatDateStr(lastDate)}`
                      : "";

                  const maxData = Math.max(
                    ...analytics.call_trend.map((x: any) => x.calls),
                    1,
                  );
                  let yMax = maxData;
                  if (yMax < 4) yMax = 4;
                  else yMax = Math.ceil(yMax / 4) * 4;
                  const ticks = [yMax, yMax * 0.75, yMax * 0.5, yMax * 0.25, 0];
                  const CHART_H = 220;

                  return (
                    <>
                      <div className="absolute top-3.5 right-5 text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                        {dateRangeStr}
                      </div>
                      <div
                        className="relative flex mt-2"
                        style={{ height: `${CHART_H}px` }}
                      >
                        {/* Y-axis Labels & Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                          {ticks.map((tick, i) => (
                            <div
                              key={i}
                              className="flex items-center w-full relative"
                            >
                              <span className="text-[10px] font-medium text-slate-400 w-8 text-right pr-3 -translate-y-1/2">
                                {tick}
                              </span>
                              <div className="flex-1 border-t border-slate-100"></div>
                            </div>
                          ))}
                        </div>

                        {/* Bars Container */}
                        <div className="flex-1 flex items-end gap-2 ml-8 pb-[1px] relative h-full">
                          {analytics.call_trend.map((t: any, idx: number) => {
                            const hPct = (t.calls / yMax) * 100;
                            return (
                              <div
                                key={idx}
                                className="flex-1 flex flex-col items-center justify-end h-full group relative"
                              >
                                {/* Tooltip on hover */}
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-10 bg-slate-900 text-white text-xs py-1.5 px-3 rounded-lg font-semibold whitespace-nowrap shadow-xl transition-all z-20 pointer-events-none flex flex-col items-center">
                                  <span className="text-[9px] text-slate-400 font-medium mb-0.5">
                                    {formatDateStr(t.date)}
                                  </span>
                                  <span>{t.calls} calls</span>
                                </div>

                                {/* Value above bar */}
                                <span className="text-[10px] font-bold text-slate-400 mb-1.5 transition-colors group-hover:text-slate-800">
                                  {t.calls > 0 ? t.calls : ""}
                                </span>

                                {/* Bar */}
                                <div
                                  className="w-full max-w-[40px] bg-slate-800 rounded-t-md transition-all duration-300 relative group-hover:bg-slate-900 cursor-default"
                                  style={{
                                    height: `${Math.max(hPct, 0)}%`,
                                    minHeight: t.calls > 0 ? "4px" : "0",
                                  }}
                                ></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {/* X-axis Labels */}
                      <div className="flex items-center ml-8 gap-2 mt-3">
                        {analytics.call_trend.map((t: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex-1 text-[10px] font-medium text-slate-400 text-center truncate"
                          >
                            {formatDateStr(t.date)}
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">
                  Not enough call data for a trend.
                </div>
              )}
            </div>
          </div>

          {/* Recent Calls */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
                Recent Activity
              </h3>
              <button
                onClick={() => setActiveTab("history")}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                View All &rarr;
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {analytics.recent_calls?.length > 0 ? (
                analytics.recent_calls.map((call: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                    onClick={() => openCallDetails(call)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 font-mono">
                          {call.contact_name ? (
                            <span>
                              <span className="font-sans text-slate-900">
                                {call.contact_name}
                              </span>{" "}
                              <span className="text-xs font-normal text-slate-500 font-mono">
                                ({call.caller_phone || call.caller_to || "Not available"})
                              </span>
                            </span>
                          ) : (
                            call.caller_phone || call.caller_to || "Not available"
                          )}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          <span
                            className={`uppercase text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${
                              call.direction === "outbound"
                                ? "bg-slate-800 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {call.direction}
                          </span>
                          <span>
                            {call.created_at
                              ? formatDistanceToNow(new Date(call.created_at), {
                                  addSuffix: true,
                                })
                              : ""}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-700">
                        {formatSecs(call.duration_seconds)}
                      </p>
                      <p className="text-xs text-slate-400 capitalize">
                        {(call.status || "unknown").replace(/-/g, " ")}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-sm text-slate-500">
                  No recent calls.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Call Outcomes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
                Outcomes
              </h3>
            </div>
            <div className="p-5 space-y-3">
              {analytics.outcomes?.map((o: any, idx: number) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          o.status === "Completed"
                            ? "bg-emerald-500"
                            : o.status === "Active"
                            ? "bg-sky-400"
                            : o.status === "Failed"
                            ? "bg-rose-400"
                            : "bg-slate-300"
                        }`}
                      ></div>
                      <span className="text-sm font-medium text-slate-700">
                        {o.status}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">
                      {o.count}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        o.status === "Completed"
                          ? "bg-emerald-400"
                          : o.status === "Active"
                          ? "bg-sky-400"
                          : o.status === "Failed"
                          ? "bg-rose-400"
                          : "bg-slate-300"
                      }`}
                      style={{
                        width: `${Math.round((o.count / analytics.total_calls) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Media & Transcripts */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
                Media & Data
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Voicemail className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">
                      Recordings
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    {analytics.recordings_count}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      ({analytics.recording_pct ?? 0}%)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-700 rounded-full"
                    style={{
                      width: `${analytics.recording_pct ?? 0}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">
                      Transcripts
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    {analytics.transcript_calls}{" "}
                    <span className="text-xs font-normal text-slate-400">
                      ({analytics.transcript_pct ?? 0}%)
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-700 rounded-full"
                    style={{
                      width: `${analytics.transcript_pct ?? 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Top Questions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
                Top Questions / Intents
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex flex-col items-center justify-center py-6 bg-slate-50 border border-slate-100 rounded-lg border-dashed">
                <Bot className="w-6 h-6 text-slate-300 mb-2" />
                <span className="text-sm font-semibold text-slate-500">
                  AI Intent Analysis
                </span>
                <span className="text-xs text-slate-400 text-center px-4 mt-1">
                  Collecting conversational data to automatically generate top intents and queries.
                </span>
              </div>
            </div>
          </div>

          {/* Agent Activity */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">
                Agent Activity
              </h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Successfully Handled
                </span>
                <span className="text-sm font-bold text-emerald-600">
                  {analytics.total_calls > 0
                    ? Math.round(
                        (analytics.completed_calls / analytics.total_calls) * 100,
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Active / Processing
                </span>
                <span className="text-sm font-bold text-amber-600">
                  {analytics.total_calls > 0
                    ? Math.round(
                        (analytics.active_calls / analytics.total_calls) * 100,
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">
                  Dropped / Hung-up
                </span>
                <span className="text-sm font-bold text-rose-600">
                  {analytics.total_calls > 0
                    ? Math.round(
                        (analytics.failed_calls / analytics.total_calls) * 100,
                      )
                    : 0}
                  %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
