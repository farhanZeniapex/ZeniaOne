"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { conversationsApi, Conversation } from "@/lib/api/conversations";
import { useCurrentCompany } from "@/hooks/use-company";
import {
  Loader2, ArrowLeft, Phone, Clock, User, Bot, PlayCircle,
  FileText, Copy, Check, Sparkles, Database, ThumbsUp, ThumbsDown,
  Share, PhoneIncoming, PhoneOutgoing, MessageSquare, Mic,
  Hash, BarChart2, Calendar, Download
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatSystemDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function ChannelBadge({ direction }: { direction: string }) {
  const map: Record<string, { label: string; bg: string }> = {
    inbound:     { label: "Inbound Call",  bg: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    outbound:    { label: "Outbound Call", bg: "bg-amber-50 text-amber-700 border-amber-200" },
    "test-chat": { label: "Web Chat",      bg: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    voice:       { label: "Voice Agent",   bg: "bg-purple-50 text-purple-700 border-purple-200" },
  };
  const cfg = map[direction] || { label: direction, bg: "bg-slate-50 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function StatTile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
        <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [transcript, setTranscript] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedSources, setExpandedSources] = useState<number[]>([]);
  const [feedbackState, setFeedbackState] = useState<Record<number, "like" | "dislike">>({});

  const toggleSources = (i: number) =>
    setExpandedSources(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);

  function handleShare(text: string) {
    if (navigator.share) navigator.share({ title: "ZeniaOne", text }).catch(() => {});
    else { navigator.clipboard.writeText(text); setCopiedIndex(-1); setTimeout(() => setCopiedIndex(null), 2000); }
  }

  function handleExport() {
    if (!transcript.length) return;
    const text = transcript.map(m => `[${m.role.toUpperCase()}] ${typeof m.content === 'string' ? m.content : m.text || ''}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${conversationId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!companyId || !conversationId) { if (!isCompanyLoading) setIsLoading(false); return; }
    async function load() {
      try {
        setIsLoading(true);
        const conv = await conversationsApi.get(companyId!, conversationId);
        if (conv) setConversation(conv);
        const transRes = await conversationsApi.getMessages(companyId!, conversationId);
        if (transRes.messages) setTranscript(transRes.messages);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    }
    load();
  }, [companyId, conversationId, isCompanyLoading]);

  if (isLoading || isCompanyLoading) return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-sage-600" />
      <p className="text-sm text-slate-500">Loading transcript...</p>
    </div>
  );

  if (!conversation) return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <p className="text-slate-500">Conversation not found.</p>
      <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
    </div>
  );

  const dur = conversation.duration_seconds || 0;
  const durFmt = dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : (dur ? `${dur}s` : "—");
  const costRs = (dur / 60 * 1.5).toFixed(2);
  const userMsgs = transcript.filter(m => m.role === "user").length;
  const aiMsgs = transcript.filter(m => m.role !== "user").length;
  const isPhone = conversation.direction === "inbound" || conversation.direction === "outbound";
  const isChat = conversation.direction === "test-chat";

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/conversations">
          <Button variant="outline" size="icon" className="h-9 w-9 border-slate-200 bg-white shadow-sm">
            <ArrowLeft className="h-4 w-4 text-slate-500" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">
              {isPhone ? (conversation.caller_phone || "Unknown Number") : (conversation.title || "Web Chat Session")}
            </h2>
            <ChannelBadge direction={conversation.direction} />
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
              conversation.status === "completed"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-blue-50 text-blue-700 border-blue-200"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${conversation.status === "completed" ? "bg-emerald-500" : "bg-blue-500 animate-pulse"}`}></span>
              {conversation.status}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{formatSystemDateTime(conversation.started_at)}</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={<Hash className="h-4 w-4 text-slate-500" />} label="Total Turns" value={`${transcript.length}`} sub={`${userMsgs} user · ${aiMsgs} AI`} />
        <StatTile icon={<Clock className="h-4 w-4 text-amber-500" />} label="Duration" value={durFmt} sub="Call length" />
        <StatTile icon={<BarChart2 className="h-4 w-4 text-purple-500" />} label="Est. Cost" value={`₹${costRs}`} sub="@ ₹1.50/min" />
        <StatTile
          icon={<Calendar className="h-4 w-4 text-indigo-500" />}
          label="Date"
          value={new Date(conversation.started_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
          sub={new Date(conversation.started_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3 pt-4">
              <CardTitle className="text-xs text-slate-400 uppercase tracking-wider">Session Info</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {isPhone && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Customer Number</p>
                  <p className="font-mono font-bold text-slate-900 flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-slate-400" />{conversation.caller_phone || "Unknown"}
                  </p>
                </div>
              )}
              {isChat && conversation.title && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Topic</p>
                  <p className="text-slate-900 font-medium text-sm">{conversation.title}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Channel</p>
                <ChannelBadge direction={conversation.direction} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Language</p>
                <p className="text-slate-900 font-medium text-sm capitalize">{conversation.language || "en"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Session ID</p>
                <p className="font-mono text-[11px] text-slate-500 break-all">{conversation.id}</p>
              </div>
              {isPhone && (
                <div className="pt-2 border-t border-slate-100">
                  <Button variant="outline" className="w-full h-9 text-xs gap-2">
                    <PlayCircle className="h-4 w-4" /> Play Recording
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transcript */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm border-slate-200 flex flex-col overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3 pt-4 flex-row items-center justify-between">
              <CardTitle className="text-xs text-slate-400 uppercase tracking-wider">Conversation Transcript</CardTitle>
              <span className="text-xs text-slate-400">{transcript.length} messages</span>
            </CardHeader>
            <CardContent className="pt-5 bg-gradient-to-b from-slate-50/30 to-white overflow-y-auto max-h-[700px]">
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-16">
                  <FileText className="h-10 w-10 text-slate-200 mb-3" />
                  <p className="text-sm font-medium text-slate-700">No transcript available</p>
                  <p className="text-xs text-slate-400 mt-1">Messages for this session could not be found.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {transcript.map((entry, idx) => {
                    const isUser = entry.role === "user";
                    const content = typeof entry.content === "string" ? entry.content : (entry as any).text || "";
                    const sources = (entry as any).sources || [];
                    const raw = entry.timestamp;
                    const timeStr = raw ? (() => {
                      const d = !String(raw).endsWith("Z") && !String(raw).match(/[+-]\d{2}:?\d{2}$/)
                        ? new Date(raw + "Z") : new Date(raw);
                      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    })() : null;

                    return (
                      <div key={idx} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                        {!isUser && (
                          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-200 flex items-center justify-center shadow-sm mt-0.5">
                            {isChat ? <Sparkles className="h-4 w-4 text-indigo-600" /> : <Bot className="h-4 w-4 text-indigo-600" />}
                          </div>
                        )}
                        <div className="flex flex-col max-w-[80%]">
                          <div className={`flex items-center gap-2 mb-1 ${isUser ? "justify-end" : ""}`}>
                            <span className="text-[11px] font-semibold text-slate-400">{isUser ? "Customer" : "Zenia AI"}</span>
                            {timeStr && <span className="text-[10px] text-slate-300">{timeStr}</span>}
                          </div>
                          <div className={`px-4 py-3 text-sm leading-relaxed shadow-sm ${
                            isUser
                              ? "bg-sage-600 text-white rounded-2xl rounded-tr-sm"
                              : "bg-white text-slate-800 rounded-2xl rounded-tl-sm border border-slate-100"
                          }`}>
                            {!isUser ? (
                              <div className="prose prose-sm max-w-none prose-a:text-sage-600 prose-p:last:mb-0">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">{content}</div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className={`mt-1 flex items-center gap-2 ${isUser ? "justify-end mr-1" : "ml-1"}`}>
                            <button onClick={() => { navigator.clipboard.writeText(content); setCopiedIndex(idx); setTimeout(() => setCopiedIndex(null), 2000); }} className="text-slate-300 hover:text-slate-500 transition-colors" title="Copy">
                              {copiedIndex === idx ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                            </button>
                            {!isUser && (
                              <>
                                <button onClick={() => setFeedbackState(p => ({ ...p, [idx]: "like" }))} className={`transition-colors ${feedbackState[idx] === "like" ? "text-sage-600" : "text-slate-300 hover:text-slate-500"}`}>
                                  <ThumbsUp className={`h-3 w-3 ${feedbackState[idx] === "like" ? "fill-current" : ""}`} />
                                </button>
                                <button onClick={() => setFeedbackState(p => ({ ...p, [idx]: "dislike" }))} className={`transition-colors ${feedbackState[idx] === "dislike" ? "text-red-400" : "text-slate-300 hover:text-slate-500"}`}>
                                  <ThumbsDown className={`h-3 w-3 ${feedbackState[idx] === "dislike" ? "fill-current" : ""}`} />
                                </button>
                                <button onClick={() => handleShare(content)} className="text-slate-300 hover:text-slate-500 transition-colors"><Share className="h-3 w-3" /></button>
                              </>
                            )}
                          </div>

                          {/* Sources */}
                          {!isUser && sources.filter((s: any) => s.filename !== "System Workspace Metadata").length > 0 && (
                            <div className="mt-1.5 ml-1">
                              <button onClick={() => toggleSources(idx)} className="text-[11px] font-medium text-sage-600 hover:text-sage-700 flex items-center gap-1">
                                <Database className="h-3 w-3" />
                                {expandedSources.includes(idx) ? "Hide" : `${sources.filter((s: any) => s.filename !== "System Workspace Metadata").length} sources`}
                              </button>
                              {expandedSources.includes(idx) && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {sources.filter((s: any) => s.filename !== "System Workspace Metadata").map((s: any, si: number) => (
                                    <div key={si} className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 shadow-sm">
                                      <FileText className="h-3 w-3 mr-1.5 text-slate-400" />{s.filename}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {isUser && (
                          <div className="h-8 w-8 shrink-0 rounded-full bg-sage-100 border border-sage-200 flex items-center justify-center mt-0.5">
                            <User className="h-4 w-4 text-sage-700" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}