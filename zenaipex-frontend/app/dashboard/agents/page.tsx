"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SmartSelect } from "@/components/ui/smart-select";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Settings, PlayCircle, Users, Search, MoreVertical, Loader2, 
  Bot, Book, MessageSquare, Zap, Activity, Clock, X, ChevronRight, Copy, Trash2,
  Volume2, VolumeX, Play, Square, Mic, CheckCircle2, Sparkles, Check, ChevronDown, CheckCheck, AlertTriangle
} from "lucide-react";
import { agentsApi, Agent, CustomVoice } from "@/lib/api/agents";
import { analyticsApi, DetailedAnalytics } from "@/lib/api/analytics";
import { useCurrentCompany } from "@/hooks/use-company";
import { VOICES, Voice, getVoiceById, getVoiceAcoustics, findBrowserVoice } from "@/lib/data/voices";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { SubtleGrid } from "@/components/ui/decorative-backgrounds";
import { FilterSelect } from "@/components/ui/filter-select";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

// Helper: Click Outside for simple custom dropdowns
function useOnClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

export default function AgentsPage() {
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [customVoices, setCustomVoices] = useState<Voice[]>([]);
  const [analytics, setAnalytics] = useState<DetailedAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tab View: "agents" or "voices"
  const [activeTab, setActiveTab] = useState<"agents" | "voices">("agents");

  // Filters for Agents
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [knowledgeFilter, setKnowledgeFilter] = useState("all");

  // Filters for Voices
  const [voiceSearchQuery, setVoiceSearchQuery] = useState("");
  const [voiceGenderFilter, setVoiceGenderFilter] = useState<"all" | "Female" | "Male">("all");

  // Selection & Panels
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Voice Preview & Assignment State
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [updatingAgentVoiceId, setUpdatingAgentVoiceId] = useState<string | null>(null);
  const [drawerSelectedVoice, setDrawerSelectedVoice] = useState<string>("");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(menuRef, () => setOpenActionMenuId(null));

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!companyId) {
      if (!isCompanyLoading) setIsLoading(false);
      return;
    }

    async function loadData() {
      try {
        setIsLoading(true);
        const [agentsRes, analyticsRes, customVoicesRes] = await Promise.all([
          agentsApi.list(companyId!),
          analyticsApi.get(companyId!, '30d').catch(() => null),
          agentsApi.listCustomVoices(companyId!).catch(() => ({ voices: [] as CustomVoice[] })),
        ]);
        setAgents(agentsRes.agents || []);
        if (analyticsRes) setAnalytics(analyticsRes);
        setCustomVoices((customVoicesRes.voices || []).map((voice) => ({
          id: voice.voice_id || voice.id,
          name: voice.name || "Unnamed clone",
          gender: voice.gender === "Male" ? "Male" : "Female",
          provider: "Sarvam cloned voice",
          enabled: voice.status !== "archived",
          description: voice.description || "Custom cloned voice for this workspace.",
          tone: voice.tone || "Cloned voice",
          sampleText: "Hello, I am your business's custom AI voice assistant. How can I help you?",
          supportedLanguages: ["Hindi", "Hinglish", "English"],
          accent: "Custom clone",
        })));
      } catch (err) {
        console.error("Failed to load agents workspace", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [companyId, isCompanyLoading]);

  // Sync drawer selected voice when an agent is picked
  useEffect(() => {
    if (selectedAgentId) {
      const a = agents.find(ag => ag.id === selectedAgentId);
      if (a) setDrawerSelectedVoice(a.tts_voice || "ritu");
    }
  }, [selectedAgentId, agents]);

  // Merge Analytics into Agents
  const enhancedAgents = useMemo(() => {
    return agents.map(agent => {
      const usage = analytics?.agents?.find(a => a.agent_id === agent.id);
      return {
        ...agent,
        usage: usage || { conversations: 0, ai_requests: 0, success_rate: 0 }
      };
    });
  }, [agents, analytics]);

  // Derived Metrics
  const totalAgents = enhancedAgents.length;
  const activeAgents = enhancedAgents.filter(a => a.status === 'active').length;
  const knowledgeConnected = enhancedAgents.filter(a => !!a.knowledge_base_id).length;
  const totalConversations = enhancedAgents.reduce((acc, curr) => acc + (curr.usage?.conversations || 0), 0);

  // Filtering for agents
  const filteredAgents = enhancedAgents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (agent.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
    const matchesKnowledge = knowledgeFilter === "all" ? true :
                             knowledgeFilter === "connected" ? !!agent.knowledge_base_id :
                             !agent.knowledge_base_id;
    return matchesSearch && matchesStatus && matchesKnowledge;
  });

  // Filtering for voices
  const voiceOptions = [...customVoices, ...VOICES];

  const findVoice = (voiceId: string | undefined) =>
    voiceOptions.find((voice) => voice.id === voiceId) || getVoiceById(voiceId);

  const filteredVoices = voiceOptions.filter(voice => {
    const matchesSearch = voice.name.toLowerCase().includes(voiceSearchQuery.toLowerCase()) ||
                          voice.tone.toLowerCase().includes(voiceSearchQuery.toLowerCase()) ||
                          voice.description.toLowerCase().includes(voiceSearchQuery.toLowerCase());
    const matchesGender = voiceGenderFilter === "all" || voice.gender === voiceGenderFilter;
    return matchesSearch && matchesGender;
  });

  const selectedAgent = enhancedAgents.find(a => a.id === selectedAgentId);

  // Voice Preview Play / Pause
  const handleToggleVoicePreview = async (voice: Voice) => {
    if (previewingVoiceId === voice.id) {
      // Stop playback
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setPreviewingVoiceId(null);
      setIsPreviewLoading(false);
      return;
    }

    // Stop current playing voice
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setPreviewingVoiceId(voice.id);
    setIsPreviewLoading(true);

    const fallbackBrowser = () => {
      setIsPreviewLoading(false);
      const isCustomClone = customVoices.some((customVoice) => customVoice.id === voice.id);
      if (isCustomClone) {
        setPreviewingVoiceId(null);
        setPreviewError("Clone preview is unavailable. The selected clone was not played.");
        window.setTimeout(() => setPreviewError(null), 5000);
        return;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const acoustics = getVoiceAcoustics(voice.id);
        const utterance = new SpeechSynthesisUtterance(voice.sampleText);
        utterance.lang = "en-IN";
        utterance.rate = acoustics.rate;
        utterance.pitch = acoustics.pitch;
        const synthVoices = window.speechSynthesis.getVoices();
        const match = findBrowserVoice(synthVoices, acoustics.isMale, "en-IN", voice.sampleText, voice.id);
        if (match) utterance.voice = match;
        utterance.onend = () => setPreviewingVoiceId(null);
        utterance.onerror = () => setPreviewingVoiceId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setPreviewingVoiceId(null);
      }
    };

    try {
      if (!companyId) {
        fallbackBrowser();
        return;
      }
      const res = await agentsApi.previewVoice(companyId, voice.id, voice.sampleText, "hi-IN");
      setIsPreviewLoading(false);
      if (res && res.audio_base64 && !res.fallback_tts) {
        const isWav = res.audio_base64.startsWith("UklG");
        const mimeType = isWav ? "audio/wav" : "audio/mp3";
        const audio = new Audio(`data:${mimeType};base64,${res.audio_base64}`);
        previewAudioRef.current = audio;
        audio.onended = () => setPreviewingVoiceId(null);
        audio.onerror = () => fallbackBrowser();
        await audio.play();
      } else {
        fallbackBrowser();
      }
    } catch (err) {
      console.warn("TTS API preview error, using browser synthesis fallback", err);
      fallbackBrowser();
    }
  };

  // Assign Voice to Agent
  const handleAssignVoice = async (agentId: string, voiceId: string) => {
    try {
      setUpdatingAgentVoiceId(agentId);
      await agentsApi.update(companyId!, agentId, { tts_voice: voiceId });
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, tts_voice: voiceId } : a));
      const targetAgent = agents.find(a => a.id === agentId);
      const voiceObj = findVoice(voiceId);
      setAssignSuccessMsg(`Updated ${targetAgent?.name || 'Agent'} voice to "${voiceObj.name}"`);
      setTimeout(() => setAssignSuccessMsg(null), 3500);
    } catch (err) {
      console.error("Failed to assign voice", err);
      alert("Failed to update agent voice.");
    } finally {
      setUpdatingAgentVoiceId(null);
    }
  };

  const handleDelete = async (agentId: string) => {
    if (!window.confirm("Are you sure you want to delete this agent? This action cannot be undone.")) return;
    try {
      await agentsApi.delete(companyId!, agentId);
      setAgents(prev => prev.filter(a => a.id !== agentId));
      if (selectedAgentId === agentId) setSelectedAgentId(null);
    } catch (err) {
      console.error("Failed to delete agent", err);
      alert("Failed to delete agent.");
    }
  };

  if (isLoading || isCompanyLoading) {
    return <PageLoadingSkeleton cards={3} showTable />;
  }

  if (!companyId) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative flex flex-col h-[calc(100vh-80px)]">
      
      {/* Toast Notification */}
      {assignSuccessMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-slate-900 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl border border-slate-700 animate-in slide-in-from-bottom duration-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{assignSuccessMsg}</span>
        </div>
      )}
      {previewError && (
        <div role="alert" className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-rose-950 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-xl border border-rose-700 animate-in slide-in-from-bottom duration-300">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-200" />
          <span>{previewError}</span>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">AI Agents</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Configure agent intelligence, personas, and customizable natural voices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-xs">
            <button
              onClick={() => setActiveTab("agents")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "agents" 
                  ? "bg-white text-slate-900 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              Workforce ({totalAgents})
            </button>
            <button
              onClick={() => setActiveTab("voices")}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "voices" 
                  ? "bg-white text-sage-800 shadow-sm" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Volume2 className="h-3.5 w-3.5 text-sage-600" />
              Voice Selection & Audio Preview
              <span className="bg-sage-100 text-sage-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {voiceOptions.length}
              </span>
            </button>
          </div>

          <Link href="/dashboard/agents/new">
            <Button className="bg-sage-600 shadow-sm hover:bg-sage-700 hover:shadow-md transition-all h-9 px-4 rounded-xl font-semibold text-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Agent
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Summary (shown on Agents tab) */}
      {activeTab === "agents" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <Card className="shadow-xs hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Total Agents</span>
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 p-2 rounded-lg text-slate-500"><Bot className="h-4 w-4"/></div>
                <div className="text-2xl font-bold text-slate-900">{totalAgents}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Active Agents</span>
              <div className="flex items-center gap-3">
                <div className="bg-emerald-50 p-2 rounded-lg text-emerald-500"><Activity className="h-4 w-4"/></div>
                <div className="text-2xl font-bold text-slate-900">{activeAgents}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Knowledge Connected</span>
              <div className="flex items-center gap-3">
                <div className="bg-purple-50 p-2 rounded-lg text-purple-500"><Book className="h-4 w-4"/></div>
                <div className="text-2xl font-bold text-slate-900">{knowledgeConnected}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-xs hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">Total Conversations</span>
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-500"><MessageSquare className="h-4 w-4"/></div>
                <div className="text-2xl font-bold text-slate-900">{totalConversations}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 1: WORKFORCE / AGENTS LIST */}
      {activeTab === "agents" && (
        totalAgents === 0 ? (
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-sage-200 bg-gradient-to-br from-[#E8F0EC] to-[#F4F7F6] py-24 shadow-xs flex-1">
            <SubtleGrid className="text-sage-700 opacity-[0.04]" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-sage-600 shadow-xs border border-sage-100">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">Create your first AI agent</h3>
              <p className="mt-2 max-w-sm text-center text-sm text-slate-500">
                You haven&apos;t created any AI voice agents yet. Build your first agent to start handling customer conversations.
              </p>
              <div className="mt-8">
                <Link href="/dashboard/agents/new">
                  <Button className="bg-sage-600 shadow-xs hover:bg-sage-700 font-semibold rounded-xl h-10 px-6">
                    <Plus className="mr-2 h-4 w-4" /> Create Agent
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <Card className="shadow-xs overflow-hidden flex-1 flex flex-col min-h-0 border-slate-200">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 bg-white pb-3 pt-4 shrink-0">
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-[280px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-4 text-[13px] font-medium text-slate-900 outline-none transition-colors focus:border-sage-500 focus:bg-white placeholder:text-slate-400"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <FilterSelect
                    label="Status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    icon={<Activity className="h-3.5 w-3.5" />}
                    options={[
                      { label: "All", value: "all" },
                      { label: "Active", value: "active" },
                      { label: "Draft", value: "draft" },
                      { label: "Inactive", value: "inactive" },
                    ]}
                  />
                  <FilterSelect
                    label="Knowledge"
                    value={knowledgeFilter}
                    onChange={setKnowledgeFilter}
                    icon={<Book className="h-3.5 w-3.5" />}
                    options={[
                      { label: "All", value: "all" },
                      { label: "Connected", value: "connected" },
                      { label: "Missing", value: "missing" },
                    ]}
                  />
                </div>
              </div>
              <div className="text-[12px] font-bold text-slate-400 self-end sm:self-auto uppercase tracking-wider">{filteredAgents.length} Agents</div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto relative">
              {filteredAgents.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                   <Search className="h-8 w-8 text-slate-300 mb-3" />
                   <p className="text-sm font-medium">No agents match your search.</p>
                   <Button variant="link" className="text-sage-600 mt-1" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setKnowledgeFilter("all"); }}>Clear Filters</Button>
                 </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-500 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">Agent</th>
                      <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">Knowledge</th>
                      <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">Voice & Audio Profile</th>
                      <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider">30D Activity</th>
                      <th className="px-6 py-3 font-semibold text-[11px] uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredAgents.map((agent) => {
                      const voiceObj = getVoiceById(agent.tts_voice);
                      const isPlayingThisVoice = previewingVoiceId === voiceObj.id;
                      return (
                        <tr 
                          key={agent.id} 
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('.action-menu-btn')) return;
                            setSelectedAgentId(agent.id);
                          }}
                          className={`transition-colors cursor-pointer group ${selectedAgentId === agent.id ? 'bg-sage-50/50' : 'hover:bg-slate-50/60'}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-sage-100 group-hover:text-sage-600 transition-colors">
                                <Bot className="h-4 w-4" />
                              </div>
                              <div className="flex flex-col max-w-[200px]">
                                <span className="font-semibold text-slate-900 truncate">{agent.name}</span>
                                <span className="text-[11px] text-slate-500 truncate">{agent.description || "No description"}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              agent.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' : 
                              agent.status === 'draft' ? 'bg-slate-100 text-slate-600 border border-slate-200/50' : 
                              'bg-amber-50 text-amber-600 border border-amber-100/50'
                            }`}>
                              {agent.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {agent.knowledge_base_id ? (
                              <div className="flex items-center gap-1.5 text-slate-700">
                                <Book className="h-3.5 w-3.5 text-purple-500" />
                                <span className="text-[13px] font-medium">Connected</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <div className="h-3.5 w-3.5 rounded-full border border-dashed border-slate-300 flex items-center justify-center" />
                                <span className="text-[13px] font-medium">No Knowledge</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleVoicePreview(voiceObj);
                                }}
                                title={`Preview voice: ${voiceObj.name}`}
                                className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                                  isPlayingThisVoice 
                                    ? "bg-sage-600 text-white shadow-xs animate-pulse" 
                                    : "bg-slate-100 text-slate-600 hover:bg-sage-100 hover:text-sage-700"
                                }`}
                              >
                                {isPlayingThisVoice ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 ml-0.5 fill-current" />}
                              </button>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
                                  <span>{voiceObj.name}</span>
                                  <span className="text-[10px] font-medium text-slate-400">({voiceObj.gender})</span>
                                </div>
                                <span className="text-[10px] text-sage-600 font-medium">{voiceObj.tone}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[13px] font-bold text-slate-900">{agent.usage.conversations.toLocaleString()} <span className="font-medium text-slate-500 text-[11px]">convs</span></span>
                              <span className="text-[11px] font-semibold text-emerald-600 mt-0.5">{agent.usage.success_rate}% success</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right relative">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100 action-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === agent.id ? null : agent.id);
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                            
                            {/* Custom Dropdown */}
                            {openActionMenuId === agent.id && (
                              <div ref={menuRef} className="absolute right-8 top-10 z-50 w-44 rounded-lg border border-slate-100 bg-white p-1 shadow-lg animate-in fade-in zoom-in-95">
                                <Link href={`/dashboard/my-ai/chat`}>
                                  <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                                    <PlayCircle className="h-4 w-4 text-sage-600" /> Test Voice Chat
                                  </button>
                                </Link>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAgentId(agent.id);
                                    setOpenActionMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                >
                                  <Volume2 className="h-4 w-4 text-amber-500" /> Change Voice
                                </button>
                                <div className="my-1 h-px bg-slate-100" />
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(agent.id); }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" /> Delete Agent
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )
      )}

      {/* TAB 2: VOICE SELECTION & AUDIO PREVIEW GALLERY */}
      {activeTab === "voices" && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          {/* Sub-header & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search voices or tones..."
                  value={voiceSearchQuery}
                  onChange={(e) => setVoiceSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-medium text-slate-900 outline-none transition-colors focus:border-sage-500 focus:bg-white"
                />
              </div>

              {/* Gender Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
                {(["all", "Female", "Male"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setVoiceGenderFilter(g)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      voiceGenderFilter === g ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {g === "all" ? "All Genders" : g}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 self-end sm:self-auto">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Click <strong className="text-slate-700">Listen Sample</strong> to test audio before assigning</span>
            </div>
          </div>

          {/* Voice Cards Grid */}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-6">
              {filteredVoices.map((voice) => {
                const isPlaying = previewingVoiceId === voice.id;
                // Find all agents currently using this voice
                const assignedAgents = agents.filter(a => (a.tts_voice || "ritu").toLowerCase() === voice.id.toLowerCase());

                return (
                  <Card 
                    key={voice.id} 
                    className={`border transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between ${
                      isPlaying ? "border-sage-500 ring-2 ring-sage-500/20 bg-sage-50/20" : "border-slate-200 bg-white"
                    }`}
                  >
                    <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                      {/* Top Header of Card */}
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-3">
                            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs ${
                              voice.gender === "Female" 
                                ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                : "bg-indigo-50 text-indigo-600 border border-indigo-100"
                            }`}>
                              {voice.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-base font-bold text-slate-900">{voice.name}</h4>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {voice.gender}
                                </span>
                              </div>
                              <span className="text-xs font-semibold text-sage-700">{voice.tone}</span>
                            </div>
                          </div>

                          {/* Listen Preview Button */}
                          <button
                            onClick={() => handleToggleVoicePreview(voice)}
                            disabled={isPreviewLoading && isPlaying}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs transition-all shadow-xs cursor-pointer ${
                              isPlaying
                                ? "bg-sage-700 text-white ring-2 ring-sage-500/40"
                                : "bg-sage-50 hover:bg-sage-100 text-sage-800 border border-sage-200"
                            }`}
                          >
                            {isPlaying ? (
                              <>
                                <Square className="h-3 w-3 fill-current" />
                                <span>Stop</span>
                                <div className="flex items-end gap-0.5 h-3 ml-0.5">
                                  <span className="w-0.5 h-2.5 bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <span className="w-0.5 h-3 bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <span className="w-0.5 h-1.5 bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3 fill-current ml-0.5" />
                                <span>Listen</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                          {voice.description}
                        </p>

                        {/* Sample Quote */}
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 text-[12px] text-slate-700 italic relative">
                          <span className="not-italic text-slate-400 mr-1">&ldquo;</span>
                          {voice.sampleText}
                          <span className="not-italic text-slate-400 ml-1">&rdquo;</span>
                        </div>
                      </div>

                      {/* Bottom: In use by & Assign to agent */}
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-400 text-[11px] uppercase tracking-wider">Assigned To:</span>
                          {assignedAgents.length > 0 ? (
                            <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px]">
                              {assignedAgents.length} {assignedAgents.length === 1 ? "Agent" : "Agents"} using
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Not in use</span>
                          )}
                        </div>

                        {/* Agent names badge */}
                        {assignedAgents.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {assignedAgents.map(ag => (
                              <span key={ag.id} className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                                {ag.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Quick Assign Dropdown */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <SmartSelect value="" placeholder="Assign to agent…" searchPlaceholder="Search agents…" onChange={(targetAgentId) => handleAssignVoice(targetAgentId, voice.id)} options={agents.map(ag => ({value:ag.id,label:ag.name,badge:ag.tts_voice === voice.id ? "Current" : undefined}))} className="flex-1 [&>button]:h-8 [&>button]:rounded-lg [&>button]:bg-slate-50/70 [&>button]:px-2.5 [&>button]:text-xs" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Right Side Detail Panel Overlay (when an agent row is clicked) */}
      {selectedAgent && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-xs animate-in fade-in" onClick={() => setSelectedAgentId(null)} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-4 shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-xs">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedAgent.name}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                          selectedAgent.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 
                          selectedAgent.status === 'draft' ? 'bg-slate-100 text-slate-600' : 
                          'bg-amber-50 text-amber-600'
                        }`}>
                      {selectedAgent.status}
                    </span>
                    <span className="text-[11px] text-slate-500">ID: {selectedAgent.id.slice(0,8)}...</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:bg-slate-100 rounded-full" onClick={() => setSelectedAgentId(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-7">
              
              {/* Voice Persona Selector inside Drawer */}
              <div className="rounded-2xl border border-sage-200 bg-sage-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4 text-sage-700" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-sage-900">Agent Voice Persona</h4>
                  </div>
                  {/* Play preview for drawer selected voice */}
                  <button
                    onClick={() => {
                      const vObj = findVoice(drawerSelectedVoice);
                      handleToggleVoicePreview(vObj);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-sage-700 bg-white border border-sage-200 hover:bg-sage-50 px-2.5 py-1 rounded-full shadow-2xs"
                  >
                    {previewingVoiceId === drawerSelectedVoice ? (
                      <>
                        <Square className="h-3 w-3 fill-current" /> Stop
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 fill-current" /> Listen Sample
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  Select which voice will speak when answering customer calls and voice chats.
                </p>

                <div className="space-y-2">
                  <SmartSelect value={drawerSelectedVoice} onChange={setDrawerSelectedVoice} searchPlaceholder="Search voices…" options={voiceOptions.map(v => ({value:v.id,label:v.name,description:v.tone,badge:v.gender,group:`${v.gender} voices`}))} />

                  {drawerSelectedVoice !== (selectedAgent.tts_voice || "ritu") && (
                    <Button
                      size="sm"
                      onClick={() => handleAssignVoice(selectedAgent.id, drawerSelectedVoice)}
                      disabled={updatingAgentVoiceId === selectedAgent.id}
                      className="w-full bg-sage-600 hover:bg-sage-700 text-white font-semibold text-xs h-8 rounded-lg shadow-xs"
                    >
                      {updatingAgentVoiceId === selectedAgent.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Save Voice to Agent
                    </Button>
                  )}
                </div>
              </div>

              {/* Performance Summary */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Performance (30D)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <div className="text-[11px] font-medium text-slate-500 mb-1">Conversations</div>
                    <div className="text-xl font-bold text-slate-900">{selectedAgent.usage.conversations.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <div className="text-[11px] font-medium text-slate-500 mb-1">AI Requests</div>
                    <div className="text-xl font-bold text-slate-900">{selectedAgent.usage.ai_requests.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <div className="text-[11px] font-medium text-slate-500 mb-1">Success Rate</div>
                    <div className="text-xl font-bold text-emerald-600">{selectedAgent.usage.success_rate}%</div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <div className="text-[11px] font-medium text-slate-500 mb-1">Last Updated</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">{formatRelativeTime(selectedAgent.updated_at)}</div>
                  </div>
                </div>
              </div>

              {/* Configuration Profile */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Configuration Profile</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[13px] font-medium text-slate-500">Knowledge</span>
                    <span className="text-[13px] font-semibold text-slate-900">{selectedAgent.knowledge_base_id ? 'Connected' : 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[13px] font-medium text-slate-500">Default Language</span>
                    <span className="text-[13px] font-semibold text-slate-900">{selectedAgent.default_language}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-[13px] font-medium text-slate-500">LLM Provider</span>
                    <span className="text-[13px] font-semibold text-slate-900">{selectedAgent.llm_model}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex gap-3">
              <Link href={`/dashboard/my-ai/chat`} className="flex-1">
                <Button variant="outline" className="w-full bg-white text-slate-700 font-semibold shadow-xs text-xs h-9">
                  <PlayCircle className="mr-2 h-4 w-4 text-slate-400" /> Test Voice
                </Button>
              </Link>
              <Link href={`/dashboard/agents/new`} className="flex-1">
                <Button className="w-full bg-sage-600 hover:bg-sage-700 font-semibold shadow-xs text-xs h-9">
                  <Settings className="mr-2 h-4 w-4" /> Edit Config
                </Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
