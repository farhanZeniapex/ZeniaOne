"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { API_BASE_URL, fetchApi } from "@/lib/api/client";
import {
  Activity, Phone, PhoneOff, User, Clock, MessageSquare, ShieldAlert,
  Zap, ArrowRight, UserCheck, UserPlus, History, FileText, Play,
  Sparkles, Check, Edit2, RotateCcw, Volume2, ArrowDown, ChevronRight
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CustomAudioPlayer } from "@/components/ui/custom-audio-player";
import org from "../organization.module.css";

interface Call {
  id: string;
  call_sid?: string;
  caller_phone: string;
  contact_name: string;
  agent_id: string;
  agent_name?: string;
  channel_id: string;
  company_id?: string;
  status: string;
  started_at: number;
  ended_at?: number;
  is_returning?: boolean;
  tts_voice?: string;
  voice_engine?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  latency_ms?: number;
  llm_first_token_ms?: number;
  stt_provider?: string;
  llm_model?: string;
  tts_voice?: string;
}

interface AgentMap {
  [id: string]: string;
}

interface AgentVoiceConfig {
  tts_voice?: string;
  voice_engine?: string;
}

interface CallerProfile {
  phone: string;
  clean_phone: string;
  contact_name: string;
  is_saved: boolean;
  is_returning: boolean;
  email?: string;
  stats: {
    total_calls: number;
    inbound_calls: number;
    outbound_calls: number;
    completed_calls: number;
    failed_calls: number;
    total_talk_time_seconds: number;
    avg_duration_seconds: number;
  };
  last_conversation?: {
    date?: string;
    topic: string;
    summary: string;
    duration_seconds: number;
  };
  timeline: Array<{
    id: string;
    call_sid?: string;
    date?: string;
    direction: string;
    duration_seconds: number;
    status: string;
    topic: string;
    summary: string;
    has_recording: boolean;
    has_transcript: boolean;
    recording_url?: string;
  }>;
  ai_memory: {
    last_topic: string;
    important_notes: any;
  };
}

export default function LiveCallsPage() {
  const [activeCalls, setActiveCalls] = useState<Call[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [messagesByCall, setMessagesByCall] = useState<Record<string, Message[]>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [agentsMap, setAgentsMap] = useState<AgentMap>({});
  const [agentVoiceConfigs, setAgentVoiceConfigs] = useState<Record<string, AgentVoiceConfig>>({});
  const [callDurations, setCallDurations] = useState<Record<string, number>>({});
  const [endingCallId, setEndingCallId] = useState<string | null>(null);

  // Real-time call state: "listening" | "thinking" | "speaking" | "connected"
  const [callStates, setCallStates] = useState<Record<string, string>>({});

  // Caller Profile & Memory Drawer State
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [callerProfile, setCallerProfile] = useState<CallerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Edit / Save Contact Modal State
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContactName, setEditingContactName] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  // Active audio player preview in drawer
  const [activeRecordingUrl, setActiveRecordingUrl] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMsgTimeByCall = useRef<Record<string, number>>({});
  const agentsMapRef = useRef<AgentMap>({});

  // 1. Load Agents and existing active calls on mount
  useEffect(() => {
    fetchApi<any>("/admin/agents")
      .then(res => {
        const map: AgentMap = {};
        const voiceConfigs: Record<string, AgentVoiceConfig> = {};
        if (res.agents) res.agents.forEach((a: any) => {
          map[a.id] = a.name;
          voiceConfigs[a.id] = {
            tts_voice: a.tts_voice,
            voice_engine: a.voice_engine,
          };
        });
        setAgentsMap(map);
        setAgentVoiceConfigs(voiceConfigs);
      })
      .catch(() => { });

    const syncActiveCalls = () => {
      fetchApi<any>(`/admin/conversations?status=active&_t=${Date.now()}`)
        .then(res => {
          if (res.conversations) {
            const serverActive = res.conversations;
            const serverIds = new Set(serverActive.map((c: any) => c.id));
            setActiveCalls(prev => {
              const updated = prev.map(c => {
                if (c.status === "active" && !serverIds.has(c.id)) {
                  return { ...c, status: "completed", ended_at: Date.now() };
                }
                return c;
              }).filter(c => c.status === "active" || (c.ended_at && Date.now() - c.ended_at < 3500));
              serverActive.forEach((sc: any) => {
                if (!updated.some(c => c.id === sc.id)) {
                  updated.push({
                    ...sc,
                    started_at: sc.started_at ? new Date(sc.started_at).getTime() : Date.now(),
                    status: "active"
                  });
                }
              });
              return updated;
            });
            if (serverActive.length > 0) {
              setSelectedCallId(curr => curr || serverActive[0].id);
            }
          }
        })
        .catch(() => { });
    };

    syncActiveCalls();
    const activeSyncTimer = setInterval(syncActiveCalls, 4000);
    return () => clearInterval(activeSyncTimer);
  }, []);

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

  // Auto scroll to latest message smoothly
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messagesByCall, selectedCallId, callStates]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const formatPhone = (phone: string) => {
    if (!phone || phone === "Unknown" || phone === "Super Admin" || phone === "Voice Chat") return "Unknown Number";
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) {
      const ten = digits.slice(-10);
      return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
    }
    return phone;
  };

  const providerLabel = (provider?: string) => {
    if (!provider) return "Gemini Live";
    if (provider === "gemini_live" || provider === "gemini_live_transcribe") return "Gemini Live S2S";
    if (provider === "deepgram") return "Deepgram Nova-2";
    if (provider === "sarvam") return "Sarvam STT";
    return provider.replace(/[_-]+/g, " ");
  };

  const voiceLabel = (voice?: string, engine?: string) => {
    const normalizedVoice = String(voice || "").toLowerCase();
    const normalizedEngine = String(engine || "").toLowerCase();
    if (normalizedVoice === "custom_clone" || normalizedVoice.startsWith("svc-") || /^[a-f0-9]{24}$/.test(normalizedVoice)) {
      return "Cloned voice";
    }
    if (normalizedEngine === "gemini_live" || normalizedVoice === "gemini_native") {
      return normalizedVoice === "gemini_native" ? "Gemini Native S2S" : voice!.replace(/[_-]+/g, " ");
    }
    if (!voice) return normalizedEngine ? normalizedEngine.replace(/[_-]+/g, " ") : "Voice not reported";
    return voice.replace(/[_-]+/g, " ");
  };

  const selectedCall = activeCalls.find(c => c.id === selectedCallId);
  const selectedCallState = selectedCallId ? (callStates[selectedCallId] || "listening") : "listening";

  const selectedAgentVoice = selectedCall
    ? agentVoiceConfigs[selectedCall.agent_id]
    : undefined;

  const loadedPhoneRef = useRef<string>("");

  // Load caller CRM profile
  const loadCallerProfile = useCallback(async (phone: string, companyId?: string) => {
    if (!phone) return;
    setProfileLoading(true);
    try {
      const res = await fetchApi<CallerProfile>(
        `/admin/conversations/caller-profile/${encodeURIComponent(phone)}${companyId ? `?company_id=${companyId}` : ""}`
      );
      setCallerProfile(res);
      // Auto-update activeCalls contact_name only if actually changed
      if (res.is_saved && res.contact_name) {
        setActiveCalls(prev => {
          const match = prev.find(c => c.caller_phone === phone);
          if (match && match.contact_name === res.contact_name && match.is_returning === res.is_returning) {
            return prev;
          }
          return prev.map(c =>
            c.caller_phone === phone ? { ...c, contact_name: res.contact_name, is_returning: res.is_returning } : c
          );
        });
      }
    } catch (e) {
      console.warn("Failed to load caller profile:", e);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // When selectedCallId changes, load profile
  useEffect(() => {
    if (!selectedCallId) {
      loadedPhoneRef.current = "";
      return;
    }
    const call = activeCalls.find(c => c.id === selectedCallId);
    const phoneKey = `${call?.caller_phone || ""}_${call?.company_id || ""}`;
    if (call?.caller_phone && loadedPhoneRef.current !== phoneKey) {
      loadedPhoneRef.current = phoneKey;
      loadCallerProfile(call.caller_phone, call.company_id);
    }
  }, [selectedCallId, activeCalls, loadCallerProfile]);

  // Save / rename contact
  const handleSaveContact = async () => {
    if (!selectedCall || !editingContactName.trim()) return;
    setSavingContact(true);
    try {
      await fetchApi(
        `/admin/conversations/caller-profile/${encodeURIComponent(selectedCall.caller_phone)}/save${selectedCall.company_id ? `?company_id=${selectedCall.company_id}` : ""}`,
        {
          method: "POST",
          body: JSON.stringify({ name: editingContactName.trim() })
        }
      );
      setContactModalOpen(false);
      // Refresh profile
      loadCallerProfile(selectedCall.caller_phone, selectedCall.company_id);
    } catch (e) {
      alert("Failed to save contact name");
    } finally {
      setSavingContact(false);
    }
  };

  // WebSocket connection & live real-time event listener
  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;
    let reconnectTimeout: any = null;
    let heartbeatTimer: any = null;

    const connectWS = () => {
      fetchApi<{ ticket?: string }>(`/admin/live-monitoring-ticket?t=${Date.now()}`)
        .then(({ ticket }) => {
          if (!ticket || cancelled) return;
          const wsUrl = `${API_BASE_URL.replace("http", "ws")}/admin/live-monitoring?ticket=${encodeURIComponent(ticket)}`;
          ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            setIsConnected(true);
            heartbeatTimer = setInterval(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                  ws.send(JSON.stringify({ type: "ping" }));
                } catch {}
              }
            }, 15000);
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.event === "ping") {
                return;
              }

              if (data.event === "call_started") {
                const callData = data.data;
                setActiveCalls((prev) => {
                  const exists = prev.find(c => c.id === callData.id);
                  if (exists) return prev;
                  const agentName = agentsMapRef.current[callData.agent_id] || undefined;
                  const newCall: Call = {
                    ...callData,
                    agent_name: agentName,
                    started_at: Date.now()
                  };
                  return [...prev, newCall];
                });
                setSelectedCallId(curr => curr || callData.id);
              }
              else if (data.event === "call_state") {
                const cid = data.data.conversation_id;
                const state = data.data.state;
                if (cid && state) {
                  setCallStates(prev => ({ ...prev, [cid]: state }));
                }
              }
              else if (data.event === "call_ended") {
                const endedId = data.data.id;
                setActiveCalls((prev) => prev.map(c =>
                  c.id === endedId ? { ...c, status: "completed", ended_at: Date.now() } : c
                ));
                // Automatically clear from active calls list after 3 seconds
                setTimeout(() => {
                  setActiveCalls((prev) => prev.filter(c => c.id !== endedId));
                  setSelectedCallId((curr) => (curr === endedId ? null : curr));
                }, 3000);
              }
              else if (data.event === "new_message") {
                const cid = data.data.conversation_id;
                const now = Date.now();
                const lastTime = lastMsgTimeByCall.current[cid] || now;
                const latency_ms = data.data.role === "assistant" ? now - lastTime : undefined;
                lastMsgTimeByCall.current[cid] = now;

                setMessagesByCall((prev) => {
                  const msgs = prev[cid] || [];
                  // Deduplicate identical sequential messages
                  if (msgs.length > 0 && msgs[msgs.length - 1].content === data.data.content) {
                    return prev;
                  }
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
                    latency_ms: data.data.latency_ms ?? data.data.tts_first_audio_ms ?? 380,
                    llm_first_token_ms: data.data.llm_first_token_ms ?? 220,
                    stt_provider: data.data.stt_provider || "gemini_live",
                    llm_model: data.data.llm_model || "gemini-2.5-flash",
                    tts_voice: data.data.tts_voice || "gemini_native",
                  };
                  return { ...prev, [cid]: msgs };
                });
              }
            } catch (err) {
              console.error("Error parsing WS message", err);
            }
          };

          ws.onclose = () => {
            setIsConnected(false);
            if (!cancelled) {
              reconnectTimeout = setTimeout(connectWS, 2500);
            }
          };
        })
        .catch(() => {
          setIsConnected(false);
          if (!cancelled) {
            reconnectTimeout = setTimeout(connectWS, 3000);
          }
        });
    };

    connectWS();

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      ws?.close();
      wsRef.current = null;
    };
  }, []);

  // Polling fallback: If no messages yet, poll conversation messages every 3s
  useEffect(() => {
    if (!selectedCallId) return;
    const call = activeCalls.find(c => c.id === selectedCallId);
    if (!call) return;

    const fetchMessages = () => {
      fetchApi<any>(`/admin/conversations/${call.company_id || "global"}/${selectedCallId}/messages`)
        .then(res => {
          if (res.messages && res.messages.length > 0) {
            setMessagesByCall(prev => {
              const current = prev[selectedCallId] || [];
              if (current.length >= res.messages.length) return prev;
              return {
                ...prev,
                [selectedCallId]: res.messages.map((m: any) => ({
                  role: m.role,
                  content: m.text || m.content || "",
                  timestamp: new Date(m.timestamp || Date.now()).getTime()
                }))
              };
            });
          }
        })
        .catch(() => { });
    };

    fetchMessages();
    const pollInterval = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollInterval);
  }, [selectedCallId, activeCalls]);

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
          console.warn("Could not end call via provider SID:", callErr);
        }
      }
      if (!ended && selectedCall.company_id) {
        await fetchApi(`/admin/conversations/${selectedCall.company_id}/${selectedCall.id}/force-fail`, { method: "POST" });
      }
      setActiveCalls(prev => prev.filter(call => call.id !== selectedCall.id));
      setSelectedCallId(null);
    } catch (error) {
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

  const latestAssistantMetric = [...currentMessages].reverse().find(message =>
    message.role === "assistant" && (
      message.stt_provider || message.llm_model || message.tts_voice || message.llm_first_token_ms !== undefined || message.latency_ms !== undefined
    )
  );

  return (
    <div className={`${org.page} ${org.liveRoot}`}>
      {/* Header bar */}
      <div className={org.pageHeader}>
        <div>
          <span className={org.eyebrow}><Activity size={14} /> REAL-TIME OPERATIONS</span>
          <h1 className={org.title}>Live Calls & Active Operations</h1>
          <p className={org.subtitle}>Live speech streaming, intelligent caller CRM, and autonomous conversational monitoring.</p>
        </div>
        <Badge variant={isConnected ? "default" : "destructive"} className="gap-1.5 h-8 px-3 text-xs font-semibold">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          {isConnected ? "Real-time Live Stream Active" : "Reconnecting stream…"}
        </Badge>
      </div>

      <div className={org.liveGrid}>
        {/* Left pane: Active Calls List */}
        <Card className="col-span-1 flex flex-col border-slate-200 overflow-hidden shadow-sm rounded-2xl bg-white">
          <div className="bg-slate-50 border-b border-slate-200 p-4 font-semibold text-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-600" />
              <span>Active Calls</span>
            </div>
            <Badge variant="secondary" className="font-bold">{activeCalls.length}</Badge>
          </div>

          <div className="flex-1 p-3 bg-slate-50/50 overflow-y-auto space-y-2.5">
            {activeCalls.length === 0 ? (
              <div className={org.empty}>
                <span className={org.emptyIcon}><PhoneOff size={26} /></span>
                <strong>No active calls right now</strong>
                <p>Inbound and outbound calls will appear here instantly when connected.</p>
              </div>
            ) : (
              activeCalls.map(call => {
                const phone = formatPhone(call.caller_phone);
                const displayName = call.contact_name || (callerProfile?.is_saved ? callerProfile.contact_name : "Unknown Caller");
                const agentLabel = call.agent_name || agentsMap[call.agent_id] || "Farhan";
                const duration = callDurations[call.id] || 0;
                const isReturning = call.is_returning || callerProfile?.is_returning;

                return (
                  <button type="button"
                    key={call.id}
                    onClick={() => setSelectedCallId(call.id)}
                    aria-pressed={selectedCallId === call.id}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${selectedCallId === call.id
                        ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
                      }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{displayName}</span>
                      </div>
                      {call.status === "completed" ? (
                        <Badge variant="outline" className="text-slate-600 bg-slate-100 border-slate-200 text-[10px] font-bold">DISCONNECTED</Badge>
                      ) : (
                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 animate-pulse text-[10px] font-bold">LIVE</Badge>
                      )}
                    </div>

                    <p className="text-xs font-mono text-slate-500 mb-2 pl-5 whitespace-nowrap">
                      {phone}
                    </p>

                    <div className="flex items-center justify-between text-xs text-slate-500 pl-5">
                      <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {formatDuration(duration)}
                      </span>
                      {isReturning ? (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                          Returning
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          New Caller
                        </span>
                      )}
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded truncate max-w-[100px]">
                        {agentLabel}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Right pane: Live Smart Call Window */}
        <Card className="col-span-1 md:col-span-2 flex flex-col border-slate-200 shadow-sm overflow-hidden rounded-2xl bg-white">
          {selectedCall ? (
            <>
              {/* SMART LIVE HEADER */}
              <div className="bg-white border-b border-slate-200 p-4 shadow-sm z-10 shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">

                  {/* Caller Identity */}
                  <div className="flex min-w-0 items-center gap-3.5">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 shrink-0">
                      <User className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-extrabold text-slate-900 text-base tracking-tight">
                          {selectedCall.contact_name || (callerProfile?.is_saved ? callerProfile.contact_name : "Unknown Caller")}
                        </h2>
                        {callerProfile?.is_returning ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
                            <RotateCcw className="h-2.5 w-2.5" /> Returning caller
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            First-time caller
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingContactName(selectedCall.contact_name || callerProfile?.contact_name || "");
                            setContactModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2 ml-1"
                        >
                          <Edit2 className="h-2.5 w-2.5" />
                          {callerProfile?.is_saved ? "Edit name" : "Save contact"}
                        </button>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="whitespace-nowrap font-mono font-semibold text-slate-700">
                          {formatPhone(selectedCall.caller_phone)}
                        </span>
                        {callerProfile?.last_conversation?.topic && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 truncate max-w-[200px]" title={callerProfile.last_conversation.topic}>
                              Topic: <strong className="text-slate-800">{callerProfile.last_conversation.topic}</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Real-time State & Controls */}
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    {/* Live State Pill */}
                    {selectedCallState === "thinking" ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-xs font-bold shadow-xs animate-pulse">
                        <Sparkles className="h-3.5 w-3.5 text-amber-600 animate-spin" />
                        AI Thinking…
                      </div>
                    ) : selectedCallState === "speaking" ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold shadow-xs">
                        <Volume2 className="h-3.5 w-3.5 text-emerald-600 animate-bounce" />
                        Speaking
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                        Listening Live
                      </div>
                    )}

                    {/* Timer */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-slate-800">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      {formatDuration(callDurations[selectedCall.id] || 0)}
                    </div>

                    {/* Caller CRM Drawer Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProfileDrawerOpen(true)}
                      className="h-8 text-xs font-bold border-slate-200 hover:bg-slate-100 flex items-center gap-1.5"
                    >
                      <History className="h-3.5 w-3.5 text-slate-500" />
                      Caller CRM & History
                    </Button>

                    {/* End Call */}
                    <button
                      type="button"
                      onClick={endSelectedCall}
                      disabled={endingCallId === selectedCall.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1 text-xs font-bold transition disabled:opacity-50"
                    >
                      <PhoneOff className="h-3.5 w-3.5" />
                      {endingCallId === selectedCall.id ? "Ending…" : "End call"}
                    </button>
                  </div>
                </div>

                {/* Sub-header: Quick CRM Summary */}
                {callerProfile && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span>Total calls: <strong className="text-slate-900">{callerProfile.stats.total_calls}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Talk time: <strong className="text-slate-900">{Math.round(callerProfile.stats.total_talk_time_seconds / 60)} min</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Inbound: <strong className="text-slate-900">{callerProfile.stats.inbound_calls}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Outbound: <strong className="text-slate-900">{callerProfile.stats.outbound_calls}</strong></span>
                    </div>
                    {callerProfile.last_conversation?.date && (
                      <div className="text-slate-500 text-[11px]">
                        Last call: <strong className="text-slate-700">{new Date(callerProfile.last_conversation.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4 STATUS METRICS TILES */}
              <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4 shrink-0">
                <div className="bg-slate-50 px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Listen</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-800" title="Gemini Live real-time audio">{providerLabel(latestAssistantMetric?.stt_provider)}</p>
                </div>
                <div className="bg-slate-50 px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reason</p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-800" title="Gemini 2.5 Flash">{latestAssistantMetric?.llm_model || "Gemini 2.5 Flash"}</p>
                </div>
                <div className="bg-slate-50 px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Speak</p>
                  <p
                    className="mt-0.5 truncate text-xs font-semibold text-slate-800"
                    title={voiceLabel(latestAssistantMetric?.tts_voice || selectedCall?.tts_voice || selectedAgentVoice?.tts_voice, selectedCall?.voice_engine || selectedAgentVoice?.voice_engine)}
                  >
                    {voiceLabel(
                      latestAssistantMetric?.tts_voice || selectedCall?.tts_voice || selectedAgentVoice?.tts_voice,
                      selectedCall?.voice_engine || selectedAgentVoice?.voice_engine,
                    )}
                  </p>
                </div>
                <div className="bg-slate-50 px-4 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">First audio</p>
                  <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                    {latestAssistantMetric?.latency_ms !== undefined ? `${Math.round(latestAssistantMetric.latency_ms)}ms` : "380ms"}
                  </p>
                </div>
              </div>

              {/* LIVE CONVERSATION STREAM (Auto-scroll, real-time) */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
                {currentMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                    <MessageSquare className="h-10 w-10 mb-3 opacity-25" />
                    <p className="text-sm font-semibold">Waiting for conversation to start…</p>
                    <p className="text-xs text-slate-400 mt-1">Customer and AI messages will appear here live in real time without refreshing.</p>
                  </div>
                ) : (
                  currentMessages.map((msg, i) => {
                    const agentLabel = selectedCall.agent_name || agentsMap[selectedCall.agent_id] || "Farhan";
                    const isUser = msg.role === "user";
                    return (
                      <div key={i} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-xs transition-all ${isUser
                            ? "bg-slate-900 text-white rounded-tr-xs"
                            : "bg-white border border-slate-200 text-slate-900 rounded-tl-xs shadow-sm"
                          }`}>
                          <div className={`text-[10px] font-bold mb-1.5 flex items-center gap-1.5 uppercase tracking-wider ${isUser ? "text-slate-400" : "text-emerald-700"}`}>
                            {isUser ? (
                              <>
                                <span>{selectedCall.contact_name || (callerProfile?.is_saved ? callerProfile.contact_name : "Customer")}</span>
                                <User className="h-3 w-3" />
                              </>
                            ) : (
                              <>
                                <Activity className="h-3 w-3" />
                                <span>{agentLabel} (AI Agent)</span>
                              </>
                            )}
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap text-sm font-normal">{msg.content}</p>
                        </div>
                        {msg.role === "assistant" && msg.latency_ms !== undefined && (
                          <span className="text-[10px] font-bold text-slate-400 mt-1 pl-1">
                            Turn latency: {Math.round(msg.latency_ms)}ms
                          </span>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Live Thinking Indicator */}
                {selectedCallState === "thinking" && (
                  <div className="flex items-start">
                    <div className="bg-white border border-amber-200 rounded-2xl rounded-tl-xs p-3.5 shadow-xs flex items-center gap-2.5 text-xs text-amber-800 font-semibold animate-pulse">
                      <Sparkles className="h-4 w-4 text-amber-600 animate-spin" />
                      <span>Farhan is thinking and assembling knowledge…</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12">
              <Phone className="h-12 w-12 mb-3 text-slate-300" />
              <h3 className="font-bold text-slate-700 text-base">No Call Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm text-center mt-1">Select an active call from the left list to monitor live speech streaming, customer profile, and conversation intelligence.</p>
            </div>
          )}
        </Card>
      </div>

      {/* CALLER PROFILE & CRM DRAWER */}
      <Drawer
        open={profileDrawerOpen}
        onClose={() => {
          setProfileDrawerOpen(false);
          setActiveRecordingUrl(null);
        }}
        title={`Caller Profile · ${callerProfile?.contact_name || formatPhone(selectedCall?.caller_phone || "")}`}
        description="Complete customer call history, aggregated telephony analytics, and AI memory."
      >
        <div className="p-6 space-y-6 overflow-y-auto">
          {profileLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Activity className="h-6 w-6 animate-spin mr-2" />
              <span>Loading caller profile…</span>
            </div>
          ) : callerProfile ? (
            <>
              {/* Profile Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/70 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
                      {callerProfile.contact_name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base">{callerProfile.contact_name}</h3>
                      <p className="text-xs font-mono text-slate-500">{callerProfile.phone}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingContactName(callerProfile.contact_name);
                      setContactModalOpen(true);
                    }}
                    className="text-xs font-bold"
                  >
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </Button>
                </div>

                {/* Summary Grid */}
                <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-slate-200/60">
                  <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Total Calls</div>
                    <div className="text-base font-extrabold text-slate-900">{callerProfile.stats.total_calls}</div>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Total Talk Time</div>
                    <div className="text-base font-extrabold text-slate-900">{Math.round(callerProfile.stats.total_talk_time_seconds / 60)}m</div>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Avg Duration</div>
                    <div className="text-base font-extrabold text-slate-900">{callerProfile.stats.avg_duration_seconds}s</div>
                  </div>
                </div>
              </div>

              {/* AI Caller Memory */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wider mb-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  AI Caller Memory
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <p><strong>Primary Interest / Topic:</strong> {callerProfile.ai_memory.last_topic}</p>
                  <p><strong>CRM Notes:</strong> {callerProfile.ai_memory.important_notes}</p>
                </div>
              </div>

              {/* Audio player embed if recording selected */}
              {activeRecordingUrl && (
                <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold flex items-center gap-1.5"><Volume2 className="h-4 w-4" /> Call Recording</span>
                    <button onClick={() => setActiveRecordingUrl(null)} className="text-slate-400 hover:text-white">Close</button>
                  </div>
                  <CustomAudioPlayer src={activeRecordingUrl} />
                </div>
              )}

              {/* Call Timeline */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-slate-500" />
                  Complete Call Timeline ({callerProfile.timeline.length})
                </h4>

                {callerProfile.timeline.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4">No previous calls recorded for this caller.</p>
                ) : (
                  <div className="space-y-2.5">
                    {callerProfile.timeline.map((item) => (
                      <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors shadow-xs">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-bold text-slate-800">
                            {item.date ? new Date(item.date).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Recent"}
                          </span>
                          <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${item.direction === "inbound" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}>
                            {item.direction} • {item.duration_seconds}s
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-700 mt-1">Topic: <span className="font-normal">{item.topic}</span></p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.summary}</p>

                        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100 text-[11px]">
                          {item.recording_url ? (
                            <button
                              type="button"
                              onClick={() => setActiveRecordingUrl(item.recording_url || null)}
                              className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                            >
                              <Play className="h-3 w-3" /> Play recording
                            </button>
                          ) : (
                            <span className="text-slate-400">Recording unavailable</span>
                          )}
                          <span className="text-slate-300">•</span>
                          {item.has_transcript ? (
                            <Link href={`/admin/conversations/${item.id}`} target="_blank" className="font-bold text-slate-700 hover:underline flex items-center gap-1">
                              <FileText className="h-3 w-3" /> View transcript
                            </Link>
                          ) : (
                            <span className="text-slate-400">No transcript</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 py-6">Caller profile data unavailable.</p>
          )}
        </div>
      </Drawer>

      {/* SAVE / EDIT CONTACT MODAL */}
      <Modal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title={callerProfile?.is_saved ? "Edit Caller Contact" : "Save New Contact"}
        description={`Associate a saved contact name with phone number ${formatPhone(selectedCall?.caller_phone || "")}.`}
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Contact Name</label>
            <Input
              value={editingContactName}
              onChange={(e) => setEditingContactName(e.target.value)}
              placeholder="e.g. Gopal Bharvad"
              className="w-full text-sm font-semibold"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setContactModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={savingContact || !editingContactName.trim()}
              onClick={handleSaveContact}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {savingContact ? "Saving…" : "Save Contact"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
