"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCurrentCompany } from "@/hooks/use-company";
import { channelsApi, Channel } from "@/lib/api/channels";
import { agentsApi, Agent } from "@/lib/api/agents";
import { conversationsApi } from "@/lib/api/conversations";
import {
  MessageSquare, Phone, MessageCircle, Settings, Trash2,
  AlertCircle, ExternalLink,
  Activity, Zap, Shield, Clock,
  PhoneIncoming, Wifi, WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

export default function ChannelsPage() {
  const { companyId } = useCurrentCompany();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [callCount, setCallCount] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    async function loadData() {
      try {
        setIsLoading(true);
        const [channelsRes, agentsRes, convsRes] = await Promise.all([
          channelsApi.list(companyId!),
          agentsApi.list(companyId!),
          conversationsApi.list(companyId!),
        ]);
        if (cancelled) return;
        setChannels(channelsRes.channels);
        setAgents(agentsRes.agents);
        setCallCount(convsRes.count || 0);
      } catch (err) {
        console.error("Failed to load channels", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [companyId]);

  const currentCompanyId = companyId;
  const handleDelete = async (id: string) => {
    if (!currentCompanyId || !confirm("Are you sure you want to delete this channel?")) return;
    try {
      await channelsApi.delete(currentCompanyId, id);
      setChannels(channels.filter(c => c.id !== id));
    } catch (err) {
      console.error("Failed to delete channel", err);
    }
  };

  const getAgentName = (agentId: string) =>
    agents.find(a => a.id === agentId)?.name || "Unknown Agent";

  if (isLoading) {
    return <PageLoadingSkeleton cards={3} />;
  }

  const voiceChannels = channels.filter(c => c.type === "twilio_voice");
  const enablexChannels = channels.filter(c => c.type === "enablex_voice");
  const webChatChannels = channels.filter(c => c.type === "web_chat");
  const activeChannelCount = channels.filter(channel => channel.is_active).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Communication Channels</h1>
          <p className="text-slate-500 text-sm mt-1">Manage integrations, API credentials, and call routing.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 mr-2" />
            {activeChannelCount} active channel{activeChannelCount === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {/* === TWILIO VOICE === */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Phone className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Twilio Voice</h2>
              <p className="text-xs text-slate-500">Phone calls · Inbound & Outbound · AI-powered IVR</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {voiceChannels.length > 0 ? (
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
                <Wifi className="h-3 w-3 mr-1" /> {voiceChannels.length} Number{voiceChannels.length > 1 ? "s" : ""} Active
              </Badge>
            ) : (
              <Badge className="bg-slate-50 text-slate-500 border border-slate-200 text-xs">
                <WifiOff className="h-3 w-3 mr-1" /> Not Connected
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Connected Numbers */}
          <div className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Connected Numbers</p>
            {voiceChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Phone className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-xs text-slate-400">No phone numbers connected</p>
                <Link href="/dashboard/channels/voice" className="mt-3">
                  <Button size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">+ Connect Number</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {voiceChannels.map(ch => (
                  <div key={ch.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-mono text-sm font-bold text-slate-900">{ch.phone_number || ch.name}</p>
                        <p className="text-[11px] text-slate-500">{getAgentName(ch.agent_id)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/dashboard/channels/voice?id=${ch.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Settings className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(ch.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Link href="/dashboard/channels/voice">
                  <button className="w-full text-center text-xs font-medium text-emerald-600 hover:text-emerald-700 py-2 rounded-xl border border-dashed border-emerald-200 hover:bg-emerald-50/50 transition-all">
                    + Add Another Number
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* API Credentials */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Connection security</p>
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Shield className="h-3 w-3" /> Server managed</div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
              Credentials stay in the secure server environment and are never shown in the workspace. Use a test call or System Health to verify this connection.
            </div>
            <a href="https://console.twilio.com" target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-2 gap-1.5">
                <ExternalLink className="h-3 w-3" /> Open Twilio Console
              </Button>
            </a>
          </div>

          {/* Usage Stats */}
          <div className="p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Workspace activity</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                <PhoneIncoming className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-slate-900">{callCount}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Conversations</p>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-center">
                <Clock className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                <p className="text-xl font-bold text-slate-900">—</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Voice minutes</p>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-700">
              <p className="font-semibold mb-0.5">Voice usage is tracked in Usage &amp; Analytics</p>
              <p className="text-amber-600">Cost is not estimated here because provider billing varies by account and plan.</p>
            </div>
          </div>
        </div>
      </div>

      {/* === ENABLEX VOICE === */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Phone className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">EnableX Voice</h2>
              <p className="text-xs text-slate-500">Programmable Voice · Low Latency Streaming</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {enablexChannels.length > 0 ? (
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">
                <Wifi className="h-3 w-3 mr-1" /> {enablexChannels.length} Number{enablexChannels.length > 1 ? "s" : ""} Active
              </Badge>
            ) : (
              <Badge className="bg-slate-50 text-slate-500 border border-slate-200 text-xs">
                <WifiOff className="h-3 w-3 mr-1" /> Not Connected
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Connected Numbers */}
          <div className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Connected Numbers</p>
            {enablexChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Phone className="h-8 w-8 text-slate-200 mb-2" />
                <p className="text-xs text-slate-400">No EnableX numbers</p>
                <Link href="/dashboard/channels/enablex" className="mt-3">
                  <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700">+ Connect Number</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {enablexChannels.map(ch => (
                  <div key={ch.id} className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Phone className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-mono text-sm font-bold text-slate-900">{ch.phone_number || ch.name}</p>
                        <p className="text-[11px] text-slate-500">{getAgentName(ch.agent_id)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/dashboard/channels/enablex?id=${ch.id}`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Settings className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(ch.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Link href="/dashboard/channels/enablex">
                  <button className="w-full text-center text-xs font-medium text-blue-600 hover:text-blue-700 py-2 rounded-xl border border-dashed border-blue-200 hover:bg-blue-50/50 transition-all">
                    + Add Another Number
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* API Credentials */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Connection security</p>
              <div className="flex items-center gap-1 text-xs text-blue-600 font-medium"><Shield className="h-3 w-3" /> Server managed</div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
              EnableX credentials and webhook settings are stored securely on the server. Connection results appear after a real test call.
            </div>
            <a href="https://portal.enablex.io/" target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-2 gap-1.5">
                <ExternalLink className="h-3 w-3" /> Open EnableX Portal
              </Button>
            </a>
          </div>

          {/* Usage Stats */}
          <div className="p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Activity</p>
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-sm text-blue-900">Per-provider call minutes are shown when EnableX call telemetry is available. Until then, view workspace conversation history.</div>
          </div>
        </div>
      </div>

      {/* === SARVAM AI TTS/STT === */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Zap className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Sarvam AI (TTS / STT)</h2>
              <p className="text-xs text-slate-500">Speech-to-Text · Text-to-Speech · Hindi / Hinglish support</p>
            </div>
          </div>
          <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs">
            <Shield className="h-3 w-3 mr-1" /> Server configured
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {/* Models */}
          <div className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Agent runtime</p>
            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 text-sm text-slate-700">STT language, selected clone voice, TTS model and LLM are applied from the assigned AI agent. Open an agent to review or change its actual runtime configuration.</div>
          </div>

          {/* Provider security */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Provider access</p><div className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><Shield className="h-3 w-3" /> Server managed</div></div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">Provider keys are never exposed to workspace users. Use the agent voice preview and live test call to verify speech quality.</div>
            <a href="https://app.sarvam.ai" target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-2 gap-1.5">
                <ExternalLink className="h-3 w-3" /> Open Sarvam Dashboard
              </Button>
            </a>
          </div>

          {/* Usage */}
          <div className="p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Speech telemetry</p>
            <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4 text-sm text-purple-900">Live Calls records real STT, LLM, TTS and first-audio timing per turn. Estimated requests are intentionally not shown here.</div>
          </div>
        </div>
      </div>

      {/* === WEB CHAT === */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-indigo-700" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Website Chat Widget</h2>
              <p className="text-xs text-slate-500">Embed AI chat on your website · No-code setup</p>
            </div>
          </div>
          {webChatChannels.length > 0 ? (
            <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs">
              <Wifi className="h-3 w-3 mr-1" /> {webChatChannels.length} Widget Active
            </Badge>
          ) : (
            <Badge className="bg-slate-50 text-slate-500 border border-slate-200 text-xs">
              <WifiOff className="h-3 w-3 mr-1" /> Not Configured
            </Badge>
          )}
        </div>

        <div className="p-5">
          {webChatChannels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-10 w-10 text-slate-200 mb-3" />
              <p className="text-sm font-medium text-slate-700">No chat widgets configured</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">Add a web chat widget to embed an AI agent on your website.</p>
              <Link href="/dashboard/channels/web-chat" className="mt-4">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">+ Configure Web Chat</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {webChatChannels.map(ch => (
                <div key={ch.id} className="group rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/dashboard/channels/web-chat/${ch.id}/settings`}>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Settings className="h-3.5 w-3.5" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:bg-red-50" onClick={() => handleDelete(ch.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-semibold text-slate-900 text-sm">{ch.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Agent: {getAgentName(ch.agent_id)}</p>
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <Link href="/dashboard/my-ai/chat">
                      <Button variant="outline" size="sm" className="w-full h-7 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                        Test Chat Widget
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
              <Link href="/dashboard/channels/web-chat" className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all min-h-[140px]">
                <span className="text-2xl mb-2">+</span>
                <p className="text-xs font-medium text-slate-500">Add New Widget</p>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* === WHATSAPP (Coming Soon) === */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden opacity-75">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">WhatsApp Business</h2>
              <p className="text-xs text-slate-500">Deploy AI agents on WhatsApp</p>
            </div>
          </div>
          <Badge className="bg-slate-50 text-slate-500 border border-slate-200 text-xs">In Development</Badge>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-amber-800">Coming in Phase 3</p>
              <p className="text-xs text-amber-700 mt-0.5">WhatsApp Business API integration is currently under development and will be available in the next major release.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
