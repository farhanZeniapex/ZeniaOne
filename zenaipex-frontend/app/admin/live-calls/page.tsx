"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { API_BASE_URL, fetchApi } from "@/lib/api/client";
import { Activity, Phone, PhoneOff, User, Clock, MessageSquare, ShieldAlert, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import org from "../organization.module.css";

interface Call {
  id: string;
  call_sid?: string;
  caller_phone: string;
  contact_name: string;
  agent_id: string;
  agent_name?: string;  // resolved dynamically
  channel_id: string;
  company_id?: string;
  status: string;
  started_at: number;
  ended_at?: number;
  is_returning?: boolean;  // advanced: was this number seen before?
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  latency_ms?: number;  // ms since last message (for AI response time)
  llm_first_token_ms?: number;
  stt_provider?: string;
  llm_model?: string;
  tts_voice?: string;
}

interface AgentMap {
  [id: string]: string;
}

export default function LiveCallsPage() {
  const [activeCalls, setActiveCalls] = useState<Call[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [messagesByCall, setMessagesByCall] = useState<Record<string, Message[]>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [agentsMap, setAgentsMap] = useState<AgentMap>({});
  const [callDurations, setCallDurations] = useState<Record<string, number>>({});
  const [endingCallId, setEndingCallId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMsgTimeByCall = useRef<Record<string, number>>({});
  const agentsMapRef = useRef<AgentMap>({});

  // Load agents and active calls on mount
  useEffect(() => {
    // 1. Load Agents
    fetchApi<any>("/admin/agents")
      .then(res => {
        const map: AgentMap = {};
        if (res.agents) res.agents.forEach((a: any) => { map[a.id] = a.name; });
        setAgentsMap(map);
      })
      .catch(() => {});

    // 2. Fetch existing in-progress calls
    fetchApi<any>("/admin/conversations?status=active")
      .then(res => {
        if (res.conversations && res.conversations.length > 0) {
          setActiveCalls(res.conversations.map((c: any) => ({
            ...c,
            started_at: c.started_at ? new Date(c.started_at).getTime() : Date.now(),
            status: "active"
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Keep the socket callback current without reconnecting whenever the agent
  // directory loads or changes.
  useEffect(() => {
    agentsMapRef.current = agentsMap;
  }, [agentsMap]);

  // Live call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDurations(prev => {
        const next = { ...prev };
        activeCalls.forEach(c => {
          if (c.status === "completed" && c.ended_at) {
             // Keep fixed duration once ended
             next[c.id] = Math.floor((c.ended_at - c.started_at) / 1000);
          } else {
             next[c.id] = Math.floor((Date.now() - c.started_at) / 1000);
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeCalls]);

  // Auto scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesByCall, selectedCallId]);

  // Helper: format duration in mm:ss
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Helper: format phone for display
  const formatPhone = (phone: string) => {
    if (!phone || phone === "Unknown" || phone === "Super Admin" || phone === "Voice Chat") return null;
    return phone;
  };

  const providerLabel = (provider?: string) => {
    if (!provider) return "Not recorded";
    if (provider === "gemini_live_transcribe") return "Gemini Live";
    if (provider === "deepgram") return "Deepgram";
    if (provider === "sarvam") return "Sarvam STT";
    return provider.replace(/[_-]+/g, " ");
  };

  const voiceLabel = (voice?: string) => {
    if (!voice) return "Not recorded";
    if (voice === "custom_clone") return "Custom cloned voice";
    return voice.replace(/[_-]+/g, " ");
  };

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    fetchApi<{ ticket?: string }>("/admin/live-monitoring-ticket")
      .then(({ ticket }) => {
        if (!ticket || cancelled) return;
        const wsUrl = `${API_BASE_URL.replace("http", "ws")}/admin/live-monitoring?ticket=${encodeURIComponent(ticket)}`;
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.event === "call_started") {
          const callData = data.data;
          setActiveCalls((prev) => {
            const exists = prev.find(c => c.id === callData.id);
            if (exists) return prev;
            // Resolve agent name from already-loaded map
            const agentName = agentsMapRef.current[callData.agent_id] || undefined;
            return [...prev, {
              ...callData,
              agent_name: agentName,
              started_at: Date.now()
            }];
          });
        }
        else if (data.event === "call_ended") {
          setActiveCalls((prev) => prev.map(c =>
            c.id === data.data.id ? { ...c, status: "completed", ended_at: Date.now() } : c
          ));
          // Remove it after 2 minutes
          setTimeout(() => {
            setActiveCalls((prev) => prev.filter(c => c.id !== data.data.id));
            if (selectedCallId === data.data.id) setSelectedCallId(null);
          }, 120000);
        }
        else if (data.event === "new_message") {
          const cid = data.data.conversation_id;
          const now = Date.now();
          const lastTime = lastMsgTimeByCall.current[cid] || now;
          const latency_ms = data.data.role === "assistant" ? now - lastTime : undefined;
          lastMsgTimeByCall.current[cid] = now;

          setMessagesByCall((prev) => {
            const msgs = prev[cid] || [];
            return {
              ...prev,
              [cid]: [...msgs, {
                role: data.data.role,
                content: data.data.content,
                timestamp: now,
                latency_ms
              }]
            };
          });
        }
        else if (data.event === "voice_metrics") {
          const cid = data.data.conversation_id;
          setMessagesByCall((prev) => {
            const msgs = [...(prev[cid] || [])];
            let assistantIndex = -1;
            for (let i = msgs.length - 1; i >= 0; i -= 1) {
              if (msgs[i].role === "assistant") {
                assistantIndex = i;
                break;
              }
            }
            if (assistantIndex < 0) return prev;
            msgs[assistantIndex] = {
              ...msgs[assistantIndex],
              latency_ms: data.data.tts_first_audio_ms ?? data.data.complete_ms,
              llm_first_token_ms: data.data.llm_first_token_ms,
              stt_provider: data.data.stt_provider,
              llm_model: data.data.llm_model,
              tts_voice: data.data.tts_voice,
            };
            return { ...prev, [cid]: msgs };
          });
        }
      } catch (err) {
        console.error("Error parsing WS message", err);
      }
        };

        ws.onclose = () => setIsConnected(false);
      })
      .catch(() => setIsConnected(false));

    return () => {
      cancelled = true;
      ws?.close();
      wsRef.current = null;
    };
  }, []);

  // Resolve agent names retroactively after agents load
  useEffect(() => {
    if (Object.keys(agentsMap).length === 0) return;
    setActiveCalls(prev => prev.map(c => ({
      ...c,
      agent_name: agentsMap[c.agent_id] || c.agent_name
    })));
  }, [agentsMap]);

  // Fetch messages for selected call if not already loaded
  useEffect(() => {
    if (!selectedCallId) return;
    if (messagesByCall[selectedCallId] && messagesByCall[selectedCallId].length > 0) return; // already loaded or receiving via WS

    const call = activeCalls.find(c => c.id === selectedCallId);
    if (!call) return;

    fetchApi<any>(`/admin/conversations/${call.company_id || "global"}/${selectedCallId}/messages`)
      .then(res => {
        if (res.messages && res.messages.length > 0) {
          setMessagesByCall(prev => ({
            ...prev,
            [selectedCallId]: res.messages.map((m: any) => ({
              role: m.role,
              content: m.text,
              timestamp: new Date(m.timestamp).getTime()
            }))
          }));
        }
      })
      .catch(() => {});
  }, [selectedCallId, activeCalls, messagesByCall]);

  const selectedCall = activeCalls.find(c => c.id === selectedCallId);
  const endSelectedCall = async () => {
    if (!selectedCall || endingCallId) return;
    setEndingCallId(selectedCall.id);
    try {
      let ended = false;
      if (selectedCall.call_sid) {
        try {
          await fetchApi(`/admin/conversations/by-call-sid/${encodeURIComponent(selectedCall.call_sid)}/end`, { method: "POST" });
          ended = true;
        } catch (callErr) {
          console.warn("Could not end call via provider SID, attempting fallback force-fail:", callErr);
        }
      }
      if (!ended && selectedCall.company_id) {
        await fetchApi(`/admin/conversations/${selectedCall.company_id}/${selectedCall.id}/force-fail`, { method: "POST" });
        ended = true;
      }
      setActiveCalls(prev => prev.filter(call => call.id !== selectedCall.id));
      setSelectedCallId(null);
    } catch (error) {
      console.error("Could not end live call", error);
      // Safely clear from active view if backend already closed or call is stale
      setActiveCalls(prev => prev.filter(call => call.id !== selectedCall.id));
      setSelectedCallId(null);
    } finally {
      setEndingCallId(null);
    }
  };
  const currentMessages = selectedCallId ? (messagesByCall[selectedCallId] || []) : [];
  const avgLatency = currentMessages
    .filter(m => m.role === "assistant" && m.latency_ms !== undefined)
    .reduce((acc, m, _, arr) => acc + (m.latency_ms || 0) / arr.length, 0);
  const latestMessageAt = currentMessages.length ? currentMessages[currentMessages.length - 1]?.timestamp : null;
  const quietSeconds = latestMessageAt ? Math.max(0, Math.floor((Date.now() - latestMessageAt) / 1000)) : null;
  const latestAssistantMetric = [...currentMessages].reverse().find(message =>
    message.role === "assistant" && (
      message.stt_provider || message.llm_model || message.tts_voice || message.llm_first_token_ms !== undefined || message.latency_ms !== undefined
    )
  );

  return (
    <div className={`${org.page} ${org.liveRoot}`}>
      <div className={org.pageHeader}>
        <div>
          <span className={org.eyebrow}><Activity size={14} /> REAL-TIME OPERATIONS</span>
          <h1 className={org.title}>Live calls</h1>
          <p className={org.subtitle}>Monitor active AI voice calls and live conversation activity.</p>
        </div>
        <Badge variant={isConnected ? "default" : "destructive"} className="gap-1.5 h-7">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          {isConnected ? "Live Connection Active" : "Disconnected"}
        </Badge>
      </div>

      <div className={org.liveGrid}>
        {/* Left pane: Active Calls List */}
        <Card className="col-span-1 flex flex-col border-slate-200 overflow-hidden shadow-sm rounded-2xl">
          <div className="bg-slate-50 border-b border-slate-200 p-4 font-semibold text-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-500" />
              Active Calls
            </div>
            <Badge variant="secondary">{activeCalls.length}</Badge>
          </div>

          <div className="flex-1 p-4 bg-slate-50/50 overflow-y-auto space-y-3">
            {activeCalls.length === 0 ? (
              <div className={org.empty}>
                <span className={org.emptyIcon}><PhoneOff size={26} /></span>
                <strong>No active calls right now</strong>
                <p>New calls will appear here automatically while the live connection is active.</p>
              </div>
            ) : (
              activeCalls.map(call => {
                const phone = formatPhone(call.caller_phone);
                const displayName = call.contact_name || (phone ? null : "Unknown Caller");
                const agentLabel = call.agent_name || agentsMap[call.agent_id] || "AI Agent";
                const duration = callDurations[call.id] || 0;

                return (
                  <button type="button"
                    key={call.id}
                    onClick={() => setSelectedCallId(call.id)}
                    aria-pressed={selectedCallId === call.id}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedCallId === call.id
                        ? "bg-white border-primary shadow-sm ring-1 ring-primary/20"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-slate-800 font-mono text-sm">
                        {phone || "Unknown Number"}
                      </div>
                      <Badge variant="outline" className="text-emerald-600 bg-emerald-50 border-emerald-200 animate-pulse text-[10px]">Live</Badge>
                    </div>
                    {displayName && (
                      <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1.5">
                        <User className="h-3 w-3" /> {displayName}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatDuration(duration)}
                      </span>
                      <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                        {agentLabel}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Right pane: Live Chat Preview */}
        <Card className="col-span-1 md:col-span-2 flex flex-col border-slate-200 shadow-sm overflow-hidden rounded-2xl">
          {selectedCall ? (
            <>
              {/* Header */}
              <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                    <User className="h-5 w-5 text-slate-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 font-mono text-sm">
                      {formatPhone(selectedCall.caller_phone) || "Unknown Number"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedCall.contact_name || "Unknown Caller"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {quietSeconds !== null && quietSeconds >= 20 && <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800" title="Time since the last captured message"><Clock size={12} /> Quiet {quietSeconds}s</div>}
                  {/* Advanced: AI Latency Indicator */}
                  {avgLatency > 0 && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${
                      avgLatency < 1000 ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                      avgLatency < 2500 ? "bg-amber-50 border-amber-200 text-amber-700" :
                      "bg-red-50 border-red-200 text-red-700"
                    }`}>
                      <Zap className="h-3 w-3" />
                      {Math.round(avgLatency)}ms avg
                    </div>
                  )}
                  {/* Agent badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                    <Activity className="h-3 w-3" />
                    {selectedCall.agent_name || agentsMap[selectedCall.agent_id] || "AI Agent"}
                  </div>
                  <Badge variant="secondary" className="gap-1.5 font-normal">
                    <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
                    Listening Live
                  </Badge>
                  <button type="button" onClick={endSelectedCall} disabled={endingCallId === selectedCall.id} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60" aria-label="End active call">
                    <PhoneOff className="h-3.5 w-3.5" />
                    {endingCallId === selectedCall.id ? "Ending…" : "End call"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4">
                <div className="bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Listen</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-700" title={latestAssistantMetric?.stt_provider}>{providerLabel(latestAssistantMetric?.stt_provider)}</p>
                </div>
                <div className="bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reason</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-700" title={latestAssistantMetric?.llm_model}>{latestAssistantMetric?.llm_model || "Not recorded"}</p>
                </div>
                <div className="bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Speak</p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-700" title={latestAssistantMetric?.tts_voice}>{voiceLabel(latestAssistantMetric?.tts_voice)}</p>
                </div>
                <div className="bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">First audio</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">{latestAssistantMetric?.latency_ms !== undefined ? `${Math.round(latestAssistantMetric.latency_ms)}ms` : "Not recorded"}</p>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-5">
                {currentMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <MessageSquare className="h-10 w-10 mb-3 opacity-20" />
                    <p className="text-sm">Waiting for conversation to start...</p>
                  </div>
                ) : (
                  currentMessages.map((msg, i) => {
                    const agentLabel = selectedCall.agent_name || agentsMap[selectedCall.agent_id] || "AI Voicebot";
                    return (
                      <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-sm"
                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                        }`}>
                          <div className="text-[10px] font-bold mb-1.5 opacity-60 flex items-center gap-1.5 uppercase tracking-wider">
                            {msg.role === "user" ? (
                              <>Customer <User className="h-3 w-3" /></>
                            ) : (
                              <><Activity className="h-3 w-3" /> {agentLabel}</>
                            )}
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap text-sm">{msg.content}</p>
                        </div>
                        {/* Advanced: per-message latency for AI turns */}
                        {msg.role === "assistant" && msg.latency_ms !== undefined && (
                          <span className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            msg.latency_ms < 1000 ? "text-emerald-600 bg-emerald-50" :
                            msg.latency_ms < 2500 ? "text-amber-600 bg-amber-50" :
                            "text-red-600 bg-red-50"
                          }`}>
                            <Zap className="h-2.5 w-2.5" /> {msg.latency_ms}ms first audio
                          </span>
                        )}
                        {msg.role === "assistant" && (msg.stt_provider || msg.llm_model || msg.tts_voice || msg.llm_first_token_ms !== undefined) && (
                          <span className="mt-1 text-[9px] font-medium text-slate-500">
                            {providerLabel(msg.stt_provider)}
                            {msg.llm_model ? ` · ${msg.llm_model}` : ""}
                            {msg.tts_voice ? ` · ${voiceLabel(msg.tts_voice)}` : ""}
                            {msg.llm_first_token_ms !== undefined ? ` · first token ${msg.llm_first_token_ms}ms` : ""}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 p-6 text-center">
              <span className={org.emptyIcon}><ShieldAlert size={26} /></span>
              <h3 className="mt-4 text-lg font-semibold text-slate-800">{activeCalls.length === 0 ? "Waiting for live calls" : "Select a call to monitor"}</h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">{activeCalls.length === 0 ? "When a customer call starts, its transcript and status will appear here." : "Choose an active call to see the conversation and agent activity in real time."}</p>
              {activeCalls.length === 0 && <Link href="/admin/conversations" className={org.textLink}>View recent calls & chats <ArrowRight size={15} /></Link>}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
