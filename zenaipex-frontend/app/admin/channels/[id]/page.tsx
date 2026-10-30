"use client";

import { useEffect, useState, use, useRef, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi, API_BASE_URL } from "@/lib/api/client";
import {
  MessageSquare,
  Phone,
  Clock,
  Mic,
  BarChart2,
  PhoneMissed,
  CheckCircle2,
  ChevronRight as ChevronRightIcon,
  ChevronDown,
  X,
  Check,
  ShieldCheck,
  Zap,
  Calendar,
  PhoneCall,
  RefreshCw,
  BarChart,
  History,
  Voicemail,
  Server,
  Database,
  Bot,
  Activity,
  ArrowDown,
  Settings,
  User,
  Play,
  ArrowRight,
  Save,
  Loader2,
  Volume2,
  Download,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneOff,
  Eye,
  Archive,
  Pin,
  Trash2,
  Search,
  AlertTriangle,
  Sparkles,
  RotateCcw, Edit2,
  CircleX,
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { LiveCallMonitor } from "@/components/ui/live-call-monitor";
import { FilterSelect } from "@/components/ui/filter-select";
import { SmartSelect } from "@/components/ui/smart-select";
import { Drawer } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import LiveCallsPage from "../../live-calls/page";
import org from "../../organization.module.css";

const VOICE_MODES = [
  {
    id: "gemini_clone",
    title: "Gemini + Clone Voice",
    description: "Gemini Live captures speech, Google Gemini generates the answer, and Sarvam speaks with your cloned voice.",
    flow: "Gemini Live â†’ Google Gemini â†’ Sarvam Clone TTS",
    voiceEngine: "pipeline",
    stt: "gemini_live",
    llm: "gemini",
    tts: "sarvam_clone",
  },
  {
    id: "classic",
    title: "Classic Deepgram + Groq",
    description: "The predictable pipeline: Deepgram speech recognition, Groq reasoning, and the selected voice output.",
    flow: "Deepgram â†’ Groq â†’ Sarvam Clone TTS",
    voiceEngine: "pipeline",
    stt: "deepgram",
    llm: "groq",
    tts: "sarvam_clone",
  },
  {
    id: "gemini_s2s",
    title: "Gemini Live S2S Â· Browser + Phone",
    description: "Gemini's native real-time voice-to-voice mode for browser voice and Exotel calls. The selected clone voice is bypassed in this mode.",
    flow: "Microphone / Phone â†’ Gemini Live â†’ Gemini native audio",
    voiceEngine: "gemini_live",
    stt: "gemini_live",
    llm: "gemini",
    tts: "sarvam_clone",
  },
] as const;

const LiveCountdown = ({
  runDate,
  isPassed,
}: {
  runDate: Date;
  isPassed: boolean;
}) => {
  const [timeLeft, setTimeLeft] = useState(runDate.getTime() - Date.now());

  useEffect(() => {
    if (isPassed) return;
    const interval = setInterval(() => {
      const remaining = runDate.getTime() - Date.now();
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [runDate, isPassed]);

  if (isPassed || timeLeft <= 0) {
    return <span>Running Soon</span>;
  }

  if (timeLeft < 60000) {
    return (
      <span className="text-rose-600 animate-pulse">
        in {Math.ceil(timeLeft / 1000)} seconds
      </span>
    );
  }

  return <span>{formatDistanceToNow(runDate, { addSuffix: true })}</span>;
};

function ChannelIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  if (type === "twilio_voice" || type === "exotel_voice" || type === "exotel") {
    return <Phone className={className || "h-4 w-4"} />;
  }
  if (type === "web_chat" || type === "whatsapp") {
    return <MessageSquare className={className || "h-4 w-4"} />;
  }
  return <Server className={className || "h-4 w-4"} />;
}

const CustomAudioPlayer = ({ src }: { src: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [isError, setIsError] = useState(false);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => setIsError(true));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsError(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setVolume(vol);
    }
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
      setSpeed(newSpeed);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const m = Math.floor(time / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(time % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 w-full">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsError(true)}
      />

      {isError ? (
        <div className="text-red-500 text-xs font-semibold py-2">
          Audio could not be loaded or is unavailable.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
            >
              {isPlaying ? (
                <span className="w-3 h-3 bg-white rounded-sm" />
              ) : (
                <Play className="w-4 h-4 ml-1" />
              )}
            </button>
            <div className="flex-1 flex flex-col gap-1.5">
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full"
              />
              <div className="flex justify-between text-[10px] font-mono font-medium text-slate-500">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">
                <Volume2 className="w-4 h-4" />
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={handleVolume}
                className="w-20 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-slate-400 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
              <button
                onClick={cycleSpeed}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 transition-colors w-12 text-center"
              >
                {speed}x
              </button>
              <a
                href={src}
                download="recording.wav"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm bg-white"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default function AdminChannelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId");
  const resolvedParams = use(params);
  const channelId = resolvedParams.id;

  const [channel, setChannel] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [companiesMap, setCompaniesMap] = useState<Record<string, string>>({});
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});
  const [agentsData, setAgentsData] = useState<Record<string, any>>({});
  const [runtimeRouting, setRuntimeRouting] = useState<any>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const renderPageNumbers = () => {
    const totalPages = Math.ceil(conversations.length / itemsPerPage);
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = startPage + maxVisible - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    const pages = [];
    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => setCurrentPage(1)}
          className={`w-8 h-8 flex items-center justify-center rounded text-xs font-semibold ${currentPage === 1 ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          1
        </button>,
      );
      if (startPage > 2)
        pages.push(
          <span key="dots-start" className="text-slate-400 px-1">
            ...
          </span>,
        );
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setCurrentPage(i)}
          className={`w-8 h-8 flex items-center justify-center rounded text-xs font-semibold transition-colors ${currentPage === i ? "bg-indigo-600 text-white border-transparent shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          {i}
        </button>,
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1)
        pages.push(
          <span key="dots-end" className="text-slate-400 px-1">
            ...
          </span>,
        );
      pages.push(
        <button
          key={totalPages}
          onClick={() => setCurrentPage(totalPages)}
          className={`w-8 h-8 flex items-center justify-center rounded text-xs font-semibold ${currentPage === totalPages ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
        >
          {totalPages}
        </button>,
      );
    }

    return pages;
  };

  const [activeTab, setActiveTab] = useState<
    "overview" | "scheduler" | "history" | "analytics" | "live_calls"
  >("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeCallContact, setActiveCallContact] = useState<string>("");

  // Scheduler state
  const [contactName, setContactName] = useState("Farhan Kureshi");
  const [destNumber, setDestNumber] = useState("+918799046710");
  const [callTopic, setCallTopic] = useState("Platform Testing");
  const [customPrompt, setCustomPrompt] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [scheduledJobs, setScheduledJobs] = useState<any[]>([]);

  // New States for Advanced Pro UI
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const phoneRef = useRef<HTMLDivElement>(null);
  const topicRef = useRef<HTMLDivElement>(null);

  const DEFAULT_TOPICS = [
    "Platform Testing",
    "Payment Reminder",
    "Sales Pitch",
    "Feedback Collection",
    "Appointment Confirmation",
    "Welcome Onboarding",
  ];

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (phoneRef.current && !phoneRef.current.contains(e.target as Node))
        setShowPhoneDropdown(false);
      if (topicRef.current && !topicRef.current.contains(e.target as Node))
        setShowTopicDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  useEffect(() => {
    const savedContact = localStorage.getItem("zen_saved_contact");
    const savedNumber = localStorage.getItem("zen_saved_number");
    const savedTopic = localStorage.getItem("zen_saved_topic");
    if (savedContact !== null) setContactName(savedContact);
    if (savedNumber !== null) setDestNumber(savedNumber);
    if (savedTopic !== null) setCallTopic(savedTopic);
    setIsInitialized(true);
  }, []);

  const fetchScheduledJobs = async () => {
    try {
      const res = await fetchApi<any>(
        `/admin/channels/${channelId}/scheduled-calls`,
      );
      if (res.success) {
        setScheduledJobs(res.jobs || []);
      }
    } catch (err) {
      console.error("Failed to fetch scheduled jobs", err);
    }
  };

  useEffect(() => {
    if (activeTab === "scheduler") {
      fetchScheduledJobs();
      const interval = setInterval(fetchScheduledJobs, 10000); // refresh every 10s
      return () => clearInterval(interval);
    }
  }, [activeTab, channelId]);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("zen_saved_contact", contactName);
      localStorage.setItem("zen_saved_number", destNumber);
      localStorage.setItem("zen_saved_topic", callTopic);
    }
  }, [contactName, destNumber, callTopic, isInitialized]);

  const [isDialing, setIsDialing] = useState(false);
  const [testCallStatus, setTestCallStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);
  const isMonitorOpenRef = useRef(isMonitorOpen);
  useEffect(() => {
    isMonitorOpenRef.current = isMonitorOpen;
  }, [isMonitorOpen]);

  const [historyTimeFilter, setHistoryTimeFilter] = useState("all");
  const [historyOutcomeFilter, setHistoryOutcomeFilter] = useState("all");

  // Detail Drawer state
  const [selectedCall, setSelectedCall] = useState<any | null>(null);
  const [callMessages, setCallMessages] = useState<any[]>([]);
  const [contactEditOpen, setContactEditOpen] = useState(false);
  const [contactEditName, setContactEditName] = useState("");
  const [contactEditSaving, setContactEditSaving] = useState(false);

  // Config State
  const [editForm, setEditForm] = useState({
    name: "",
    phone_number: "",
    agent_id: "",
    is_active: true,
    exotel_account_sid: "",
    exotel_api_key: "",
    exotel_api_token: "",
    exotel_flow_id: "",
    voicebot_url: "",
    status_url: "",
    recording_enabled: true,
    recording_channels: "dual",
  });
  const [hasChanges, setHasChanges] = useState(false);
  const hasChangesRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGeneratingUrls, setIsGeneratingUrls] = useState(false);
  const [verification, setVerification] = useState<any>(null);
  const [showExotelSecrets, setShowExotelSecrets] = useState(false);
  const [aiConfigDraft, setAiConfigDraft] = useState<any>(null);
  const [aiConfigDirty, setAiConfigDirty] = useState(false);
  const [aiConfigSaving, setAiConfigSaving] = useState(false);
  const [aiConfigMessage, setAiConfigMessage] = useState<string | null>(null);
  const [languageInput, setLanguageInput] = useState("");
  const [routingDraft, setRoutingDraft] = useState<any>(null);
  const [routingDirty, setRoutingDirty] = useState(false);
  const [routingSaving, setRoutingSaving] = useState(false);
  const [voiceModeApplying, setVoiceModeApplying] = useState(false);
  const [isEditChannelModalOpen, setIsEditChannelModalOpen] = useState(false);

  const getCallContactPhone = (call: any) => {
    if (!call) return "";
    return call.direction === "outbound"
      ? call.to_phone || call.destination_phone || call.caller_to || call.caller_phone || ""
      : call.from_phone || call.caller_phone || call.caller_to || "";
  };

  const normalizeContactPhone = (value: string) => {
    const digits = String(value || "").replace(/\D/g, "");
    return digits.length >= 10 ? digits.slice(-10) : digits;
  };

  const saveSelectedCallerName = async () => {
    const name = contactEditName.trim();
    const phone = getCallContactPhone(selectedCall);
    if (!name || !phone || !channel?.company_id) return;

    setContactEditSaving(true);
    try {
      await fetchApi(
        `/admin/conversations/caller-profile/${encodeURIComponent(phone)}/save?company_id=${encodeURIComponent(channel.company_id)}`,
        {
          method: "POST",
          body: JSON.stringify({ name }),
        },
      );

      const cleanPhone = normalizeContactPhone(phone);
      setSelectedCall((prev: any) => (prev ? { ...prev, contact_name: name } : prev));
      setConversations((prev) =>
        prev.map((conversation) => {
          const conversationPhone = getCallContactPhone(conversation);
          return normalizeContactPhone(conversationPhone) === cleanPhone
            ? { ...conversation, contact_name: name }
            : conversation;
        }),
      );
      setContactName(name);
      setContactEditOpen(false);
    } catch (error) {
      console.error("Failed to rename caller", error);
      alert("Caller name save nahi ho paya. Please try again.");
    } finally {
      setContactEditSaving(false);
    }
  };

  useEffect(() => {
    const agent = agentsData[editForm.agent_id];
    if (!agent || aiConfigDirty) return;
    setAiConfigDraft({
      default_language: agent.default_language || agent.supported_languages?.[0] || "en-IN",
      supported_languages: agent.supported_languages || [agent.default_language || "en-IN"],
      voice_engine: agent.voice_engine || "pipeline",
      gemini_voice: agent.gemini_voice || "Aoede",
      voice_speed: agent.voice_speed ?? 1,
      voice_volume: agent.voice_volume ?? 1,
      voice_clarity: agent.voice_clarity ?? 94,
      voice_stability: agent.voice_stability ?? 85,
      tts_voice: agent.tts_voice || "anushka",
      tts_model: agent.tts_model || "bulbul:v3",
      llm_model: agent.llm_model || "sarvam-105b",
      llm_max_tokens: agent.llm_max_tokens || 1200,
      llm_temperature: agent.llm_temperature ?? 0.3,
      max_conversation_turns: agent.max_conversation_turns || 20,
      silence_timeout_ms: agent.silence_timeout_ms || 800,
      force_process_timeout_sec: agent.force_process_timeout_sec || 8,
      enable_background_audio: agent.enable_background_audio ?? true,
      barge_in_enabled: agent.barge_in_enabled ?? true,
    });
  }, [agentsData, editForm.agent_id, aiConfigDirty]);

  useEffect(() => {
    if (!runtimeRouting || routingDirty) return;
    setRoutingDraft(JSON.parse(JSON.stringify(runtimeRouting.routing || {})));
  }, [runtimeRouting, routingDirty]);

  const updateAiConfig = (key: string, value: any) => {
    setAiConfigDraft((prev: any) => ({ ...prev, [key]: value }));
    setAiConfigDirty(true);
  };

  const saveAiConfiguration = async () => {
    const agentId = editForm.agent_id;
    if (!agentId || !aiConfigDraft) return;
    const languages = Array.from(new Set<string>((aiConfigDraft.supported_languages || []) as string[]));
    if (!languages.length || !languages.every((code: string) => /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(code))) {
      setAiConfigMessage("Add at least one valid BCP-47 language code, for example en-IN or hi-IN.");
      return;
    }
    if (!languages.includes(aiConfigDraft.default_language)) {
      setAiConfigMessage("Default language must be included in supported languages.");
      return;
    }
    setAiConfigSaving(true);
    setAiConfigMessage(null);
    try {
      const saved = await fetchApi<any>(`/companies/${companyId}/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({ ...aiConfigDraft, supported_languages: languages }),
      });
      setAgentsData((prev: any) => ({ ...prev, [agentId]: saved }));
      setAiConfigDraft((prev: any) => ({ ...prev, supported_languages: languages }));
      setAiConfigDirty(false);
      setAiConfigMessage("AI configuration saved. It will apply to the next call/session.");
    } catch (error: any) {
      setAiConfigMessage(error.message || "Unable to save AI configuration.");
    } finally {
      setAiConfigSaving(false);
    }
  };

  const saveProviderRouting = async () => {
    if (!routingDraft) return;
    setRoutingSaving(true);
    try {
      const result = await fetchApi<any>("/admin/providers/runtime/routing", {
        method: "PUT",
        body: JSON.stringify({ routing: routingDraft }),
      });
      setRuntimeRouting((prev: any) => ({ ...(prev || {}), routing: result.routing }));
      setRoutingDraft(result.routing);
      setRoutingDirty(false);
      setAiConfigMessage("Provider routing saved. New calls will use the updated order.");
    } catch (error: any) {
      setAiConfigMessage(error.message || "Unable to save provider routing.");
    } finally {
      setRoutingSaving(false);
    }
  };

  const resolveProviderId = (aliases: string[], fallback: string) => {
    const provider = (runtimeRouting?.providers || []).find((item: any) => {
      const haystack = `${item.id || ""} ${item.name || ""}`.toLowerCase();
      return aliases.some((alias) => haystack.includes(alias));
    });
    return provider?.id || fallback;
  };

  const applyVoiceMode = async (mode: (typeof VOICE_MODES)[number]) => {
    if (!editForm.agent_id || !aiConfigDraft) {
      setAiConfigMessage("Select an AI agent before applying a voice mode.");
      return;
    }
    setVoiceModeApplying(true);
    setAiConfigMessage(null);
    try {
      const nextConfig = { ...aiConfigDraft, voice_engine: mode.voiceEngine };
      const languages = Array.from(new Set<string>((nextConfig.supported_languages || []) as string[]));
      const savedAgent = await fetchApi<any>(`/companies/${companyId}/agents/${editForm.agent_id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...nextConfig, supported_languages: languages }),
      });
      setAgentsData((prev: any) => ({ ...prev, [editForm.agent_id]: savedAgent }));
      setAiConfigDraft(nextConfig);
      setAiConfigDirty(false);

      const currentRouting = routingDraft || runtimeRouting?.routing || {};
      const nextRouting = JSON.parse(JSON.stringify(currentRouting));
      const stt = resolveProviderId([mode.stt], mode.stt);
      const llm = resolveProviderId([mode.llm], mode.llm);
      const tts = resolveProviderId([mode.tts], mode.tts);
      ["phone_voice", "browser_voice"].forEach((surface) => {
        nextRouting[surface] = {
          ...(nextRouting[surface] || {}),
          stt: [stt],
          llm: [llm],
          tts: [tts],
        };
      });
      if (nextRouting.text_chat) nextRouting.text_chat = { ...nextRouting.text_chat, llm: [llm] };
      const result = await fetchApi<any>("/admin/providers/runtime/routing", {
        method: "PUT",
        body: JSON.stringify({ routing: nextRouting }),
      });
      setRuntimeRouting((prev: any) => ({ ...(prev || {}), routing: result.routing }));
      setRoutingDraft(result.routing);
      setRoutingDirty(false);
      setAiConfigMessage(`${mode.title} applied. New calls and voice sessions will use this mode.`);
    } catch (error: any) {
      setAiConfigMessage(error.message || "Unable to apply voice mode.");
    } finally {
      setVoiceModeApplying(false);
    }
  };

  const updateForm = (key: string, value: any) => {
    setEditForm((prev) => {
      const next = { ...prev, [key]: value };
      setHasChanges(
        Boolean(next.exotel_api_key?.trim() || next.exotel_api_token?.trim()) ||
        next.name !== (channel?.name || "") ||
        next.phone_number !== (channel?.phone_number || "") ||
        next.agent_id !== (channel?.agent_id || "") ||
        next.is_active !== (channel?.is_active ?? true) ||
        next.exotel_account_sid !== (channel?.config?.exotel_account_sid || "") ||
        next.exotel_flow_id !== (channel?.config?.exotel_flow_id || "") ||
        next.voicebot_url !== (channel?.config?.voicebot_url || "") ||
        next.status_url !== (channel?.config?.status_url || "") ||
        next.recording_enabled !== (channel?.config?.recording_enabled ?? true) ||
        next.recording_channels !== (channel?.config?.recording_channels || "dual"),
      );
      hasChangesRef.current = true;
      return next;
    });
  };

  const cancelEdits = () => {
    if (channel) {
      setEditForm({
        name: channel.name || "",
        phone_number: channel.phone_number || "",
        agent_id: channel.agent_id || "",
        is_active: channel.is_active ?? true,
        exotel_account_sid: channel.config?.exotel_account_sid || "",
        exotel_api_key: "",
        exotel_api_token: "",
        exotel_flow_id: channel.config?.exotel_flow_id || "",
        voicebot_url: channel.config?.voicebot_url || "",
        status_url: channel.config?.status_url || "",
        recording_enabled: channel.config?.recording_enabled ?? true,
        recording_channels: channel.config?.recording_channels || "dual",
      });
      setHasChanges(false);
      hasChangesRef.current = false;
      setSaveMessage(null);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetchApi<any>(
        `/companies/${companyId}/channels/${channelId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: editForm.name,
            phone_number: editForm.phone_number || undefined,
            agent_id: editForm.agent_id,
            is_active: editForm.is_active,
            config: {
              ...(channel?.config || {}),
              exotel_account_sid: editForm.exotel_account_sid,
              exotel_flow_id: editForm.exotel_flow_id,
              voicebot_url: editForm.voicebot_url,
              status_url: editForm.status_url,
              recording_enabled: editForm.recording_enabled,
              recording_channels: editForm.recording_channels,
            },
            ...(editForm.exotel_api_key.trim() ? { exotel_api_key: editForm.exotel_api_key.trim() } : {}),
            ...(editForm.exotel_api_token.trim() ? { exotel_api_token: editForm.exotel_api_token.trim() } : {}),
          }),
        },
      );
      if (res.id) {
        setChannel({
          ...channel,
          name: res.name,
          phone_number: res.phone_number,
          agent_id: res.agent_id,
          is_active: res.is_active,
          config: res.config || channel.config,
        });
        setHasChanges(false);
        hasChangesRef.current = false;
        setSaveMessage({
          type: "success",
          text: "Configuration saved successfully.",
        });
        // Credentials are write-only. Clear them after the encrypted save so
        // they cannot remain visible in the form or be accidentally resent.
        setEditForm((current) => ({ ...current, exotel_api_key: "", exotel_api_token: "" }));
        setVerification(null);
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch (e: any) {
      setSaveMessage({
        type: "error",
        text: `Unable to save configuration. ${e.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyConfig = async () => {
    setIsVerifying(true);
    setVerification(null);
    try {
      const result = await fetchApi<any>(`/admin/channels/${channelId}/verify`, { method: "POST" });
      setVerification(result);
    } catch (error: any) {
      setVerification({ valid: false, checks: [{ name: "Verification request", ok: false, detail: error.message || "Verification failed" }] });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGenerateCallbackUrls = async () => {
    setIsGeneratingUrls(true);
    try {
      const result = await fetchApi<any>(`/admin/channels/${channelId}/callback-urls`, { method: "POST" });
      updateForm("voicebot_url", result.voicebot_url || "");
      updateForm("status_url", result.status_url || "");
      setSaveMessage({ type: "success", text: "Signed callback URLs generated. Save Integration to persist them." });
    } catch (error: any) {
      setSaveMessage({ type: "error", text: error.message || "Unable to generate callback URLs." });
    } finally {
      setIsGeneratingUrls(false);
    }
  };

  useEffect(() => {
    if (!companyId) {
      router.replace("/admin/channels");
      return;
    }

    const loadData = async () => {
      try {
        const [chanRes, convRes, anRes, compRes, agentRes, routingRes] = await Promise.all([
          fetchApi<any>(`/admin/channels/${channelId}`),
          fetchApi<any>(`/admin/channels/${channelId}/conversations?limit=500&sync_provider=true`),
          fetchApi<any>(`/admin/channels/${channelId}/analytics`).catch(
            () => null,
          ),
          fetchApi<any>(`/admin/companies`),
          fetchApi<any>(`/admin/agents`),
          fetchApi<any>(`/admin/providers/runtime`).catch(() => null),
        ]);
        setChannel(chanRes);
        setRuntimeRouting(routingRes);
        if (!hasChangesRef.current) {
          setEditForm({
            name: chanRes.name || "",
            phone_number: chanRes.phone_number || "",
            agent_id: chanRes.agent_id || "",
            is_active: chanRes.is_active ?? true,
            exotel_account_sid: chanRes.config?.exotel_account_sid || "",
            exotel_api_key: "",
            exotel_api_token: "",
            exotel_flow_id: chanRes.config?.exotel_flow_id || "",
            voicebot_url: chanRes.config?.voicebot_url || "",
            status_url: chanRes.config?.status_url || "",
            recording_enabled: chanRes.config?.recording_enabled ?? true,
            recording_channels: chanRes.config?.recording_channels || "dual",
          });
        }

        const rawConvs = convRes.conversations || [];
        const seenSids = new Set<string>();
        const convs = rawConvs.filter((item: any) => {
          if (item.is_archived === true || item.provider_verified === false) return false;
          const sid = String(item.call_sid || "");
          if (!sid || seenSids.has(sid)) return false;
          seenSids.add(sid);
          return true;
        });
        setConversations(convs);
        setSelectedCall((previous: any) => {
          if (!previous) return previous;
          const fresh = convs.find((item: any) => item.id === (previous.id || previous._id));
          return fresh ? { ...previous, ...fresh } : previous;
        });
        if (anRes && Object.keys(anRes).length > 0) {
          setAnalytics(anRes);
        }

        const cMap: Record<string, string> = {};
        if (compRes.companies)
          compRes.companies.forEach((c: any) => {
            cMap[c.id] = c.name;
          });
        setCompaniesMap(cMap);

        const aMap: Record<string, string> = {};
        const aData: Record<string, any> = {};
        if (agentRes.agents) {
          agentRes.agents.forEach((a: any) => {
            aMap[a.id] = a.name;
            aData[a.id] = a;
          });
        }
        setAgentsMap(aMap);
        setAgentsData(aData);

        const activeCall = convs.find(
          (c: any) =>
            c.status === "in-progress" ||
            c.status === "active" ||
            c.status === "ringing",
        );
        if (activeCall) {
          // If there's an active call, update activeCallId
          // We only do this if it's empty, or maybe we just don't overwrite if monitor is open
          if (!isMonitorOpenRef.current) {
            setActiveCallId(activeCall.call_sid || activeCall._id);
            setActiveCallContact(activeCall.contact_name ? `${activeCall.contact_name} (${activeCall.caller_phone || "Unknown"})` : (activeCall.caller_phone || "Unknown"));
          }
        } else {
          // Only clear active call ID if monitor is not manually opened
          if (!isMonitorOpenRef.current) {
            setActiveCallId(null);
          }
        }
      } catch (err) {
        console.error("Failed to load channel details", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [channelId, companyId, router]);

  const handleDialImmediate = async (e?: React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    setActiveTab("scheduler"); // Always show the scheduler tab to see status/inputs

    const phoneTrimmed = destNumber.trim();
    if (!phoneTrimmed) {
      setTestCallStatus({
        type: "error",
        message: "Please enter a phone number.",
      });
      // Scroll down slightly so they see the inputs
      setTimeout(() => window.scrollBy({ top: 300, behavior: "smooth" }), 50);
      return;
    }

    // Basic formatting validation (at least some digits, no letters)
    const phoneRegex = /^\+?[0-9\s\-\(\)]+$/;
    if (
      !phoneRegex.test(phoneTrimmed) ||
      phoneTrimmed.replace(/[^0-9]/g, "").length < 7
    ) {
      setTestCallStatus({
        type: "error",
        message: "Please enter a valid phone number format.",
      });
      return;
    }

    setIsDialing(true);
    setTestCallStatus(null);
    try {
      const res = await fetchApi<any>(
        `/admin/channels/${channelId}/test-call`,
        {
          method: "POST",
          body: JSON.stringify({
            contact_name: contactName.trim() || "Test User",
            phone_number: phoneTrimmed,
            topic: callTopic.trim(),
            system_prompt: customPrompt.trim() || null,
          }),
        },
      );
      if (res.success) {
        console.log("TEST CALL RESPONSE:", res);
        setTestCallStatus({
          type: "success",
          message: "Call request accepted! Exotel is dialing the number.",
        });
        if (res.call_sid || res.call_id) {
          setActiveCallId(res.call_sid || res.call_id);
          setIsMonitorOpen(true);
        } else {
          console.error("NO CALL SID IN RESPONSE");
        }
      }
    } catch (err: any) {
      setTestCallStatus({
        type: "error",
        message: `Call request failed: ${err.message}`,
      });
    } finally {
      setIsDialing(false);
    }
  };

  const handleSaveContact = () => {
    localStorage.setItem("zen_saved_contact", contactName);
    localStorage.setItem("zen_saved_number", destNumber);
    localStorage.setItem("zen_saved_topic", callTopic);
    setTestCallStatus({
      type: "success",
      message: "Contact details saved to browser.",
    });
    setTimeout(() => setTestCallStatus(null), 3000);
  };

  const handleGeneratePrompt = async () => {
    if (!callTopic.trim()) {
      setTestCallStatus({
        type: "error",
        message: "Please select or type a topic first!",
      });
      return;
    }
    setIsGeneratingPrompt(true);
    setTestCallStatus(null);
    try {
      const res = await fetchApi<any>(`/admin/channels/generate-prompt`, {
        method: "POST",
        body: JSON.stringify({
          contact_name: contactName || "",
          phone_number: destNumber || "",
          topic: callTopic,
          history_context: "Use an engaging and professional tone.",
        }),
      });
      if (res.success && res.prompt) {
        setCustomPrompt(res.prompt);
      } else {
        setTestCallStatus({
          type: "error",
          message: "AI Prompt generation failed.",
        });
      }
    } catch (e: any) {
      setTestCallStatus({
        type: "error",
        message: `Generation failed: ${e.message}`,
      });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleScheduleCall = async (e?: React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!destNumber.trim() || !scheduledDate || !scheduledTime) return;

    setIsDialing(true);
    setTestCallStatus(null);

    try {
      const isoDateTime = new Date(
        `${scheduledDate}T${scheduledTime}:00`,
      ).toISOString();
      const res = await fetchApi<any>(
        `/admin/channels/${channelId}/schedule-call`,
        {
          method: "POST",
          body: JSON.stringify({
            contact_name: contactName.trim() || "Test User",
            phone_number: destNumber.trim(),
            topic: callTopic.trim(),
            system_prompt: customPrompt.trim() || null,
            scheduled_at: isoDateTime,
          }),
        },
      );
      if (res.success) {
        setTestCallStatus({
          type: "success",
          message: res.message || "Call scheduled successfully!",
        });
        fetchScheduledJobs(); // Refresh the list
      }
    } catch (err: any) {
      setTestCallStatus({
        type: "error",
        message: `Call scheduling failed: ${err.message}`,
      });
    } finally {
      setIsDialing(false);
    }
  };

  const handleCancelScheduledCall = async (jobId: string) => {
    try {
      const res = await fetchApi<any>(
        `/admin/channels/${channelId}/scheduled-calls/${jobId}`,
        {
          method: "DELETE",
        },
      );
      if (res.success) {
        setTestCallStatus({
          type: "success",
          message: "Scheduled call cancelled successfully.",
        });
        fetchScheduledJobs(); // refresh list
      } else {
        setTestCallStatus({
          type: "error",
          message: res.error || "Failed to cancel.",
        });
      }
    } catch (err: any) {
      setTestCallStatus({
        type: "error",
        message: `Cancel failed: ${err.message}`,
      });
    }
  };

  const [recordingToken, setRecordingToken] = useState<string | null>(null);

  const openCallDetails = async (call: any) => {
    setSelectedCall(call);
    setCallMessages([]);
    setRecordingToken(null);
    const callId = call.id || call._id;
    try {
      const res = await fetchApi<any>(
        `/admin/conversations/${companyId}/${callId}/messages`,
      );
      setCallMessages(res.messages || []);
    } catch (e) {
      console.error(e);
    }

    if (call.recording_url) {
      fetchApi<{ token: string }>(
        `/admin/conversations/${companyId}/${callId}/recording-token`,
      )
        .then((res) => setRecordingToken(res.token))
        .catch((err) => console.error("Failed to fetch recording token:", err));
    }
  };

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  if (!channel)
    return (
      <div className="p-8 text-center text-red-500">Channel not found.</div>
    );

  const isVoice =
    channel.type === "twilio_voice" ||
    channel.type === "exotel_voice" ||
    channel.type === "exotel";
  const formatSecs = (secs: number) => {
    if (!secs) return "00:00";
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const companyName = companiesMap[channel.company_id] || "ZeniaOne";
  const agentName = channel.agent_id
    ? agentsMap[channel.agent_id] || "ZeniaOne Assistant"
    : "Unassigned";

  const recordings = conversations.filter((c) => c.recording_url);
  const latestRecording = recordings.length > 0 ? recordings[0] : null;
  const isExotelChannel = channel.type === "exotel_voice" || channel.type === "exotel";
  const providerName = isExotelChannel ? "Exotel" : "Twilio";
  const integrationChecks: Array<[string, boolean]> = isExotelChannel
    ? [
      ["Channel name", Boolean(editForm.name.trim())],
      ["ExoPhone / caller ID", Boolean(editForm.phone_number.trim())],
      ["Exotel account ID", Boolean(editForm.exotel_account_sid.trim())],
      ["Exotel flow ID", Boolean(editForm.exotel_flow_id.trim())],
      ["Voicebot callback URL", Boolean(editForm.voicebot_url.trim())],
      ["Status callback URL", Boolean(editForm.status_url.trim())],
      ["Backend credentials", Boolean(channel.config?.provider_credentials_configured)],
    ]
    : [
      ["Channel name", Boolean(editForm.name.trim())],
      ["Caller ID", Boolean(editForm.phone_number.trim())],
      ["Backend credentials", Boolean(channel.config?.provider_credentials_configured)],
    ];
  const completedIntegrations = integrationChecks.filter(([, complete]) => complete).length;
  const integrationPercent = Math.round((completedIntegrations / integrationChecks.length) * 100);
  const missingIntegrations = integrationChecks.filter(([, complete]) => !complete).map(([label]) => label);

  return (
    <div className={org.page}>
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Breadcrumb Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className="flex items-center text-xs font-semibold text-slate-500 mb-2 mt-2">
        <button
          onClick={() => router.push("/admin/channels")}
          className="hover:text-slate-900 transition-colors"
        >
          System Channels
        </button>
        <ChevronRightIcon className="w-3.5 h-3.5 mx-1" />
        <span className="text-slate-900">{channel.name}</span>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ 1. PREMIUM HEADER Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className={org.pageHeader}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shadow-sm shrink-0">
            <ChannelIcon
              type={channel.type}
              className="w-7 h-7 text-emerald-700"
            />
          </div>
          <div>
            <h1 className={`${org.title} flex items-center gap-3 flex-wrap`}>
              {channel.name}
              <button
                type="button"
                onClick={() => setIsEditChannelModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                Edit
              </button>
              {channel.is_active ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>{" "}
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold border border-slate-200 bg-slate-50 text-slate-600 shadow-sm uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>{" "}
                  Inactive
                </span>
              )}
            </h1>
            <p className="text-slate-500 font-medium mt-1.5 text-sm flex items-center flex-wrap gap-x-3 gap-y-1">
              <span className="uppercase text-[11px] font-bold tracking-wider text-slate-900">
                {channel.type?.replace("_", " ")}
              </span>
              {channel.phone_number && (
                <>
                  <span className="text-slate-300">&bull;</span>
                  <span className="font-mono text-slate-700">
                    {channel.phone_number}
                  </span>
                </>
              )}
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-600">
                Company:{" "}
                <span className="font-semibold text-slate-900">
                  {companyName}
                </span>
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-slate-600">
                AI Agent:{" "}
                <span className="font-semibold text-slate-900">
                  {agentName}
                </span>
              </span>
            </p>
          </div>
        </div>

        <div className={org.toolbar}>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setActiveTab("scheduler")}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-sm"
          >
            <Calendar className="w-4 h-4" /> Schedule
          </button>
          {isVoice && (
            <button
              onClick={handleDialImmediate}
              disabled={isDialing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-800 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-colors shadow-sm disabled:opacity-70"
            >
              {isDialing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PhoneCall className="w-4 h-4" />
              )}
              {isDialing ? "Dialing..." : "Test Call"}
            </button>
          )}
        </div>
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ LIVE STATUS BAR Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div className={org.note}>
        <Activity size={16} className="shrink-0" />
        <span>
          <strong>
            {channel.is_active ? "Channel active" : "Channel inactive"}
          </strong>{" "}
          Â· {channel.type?.replaceAll("_", " ")} Â· Agent: {agentName}. Use a
          test call and recent history to verify the live connection.
        </span>
      </div>
      <details className={org.diagnostics}>
        <summary>
          <Activity size={16} /> Connection diagnostics{" "}
          <span>
            Configuration and recent activity <ChevronDown size={15} />
          </span>
        </summary>
        <div className={org.diagnosticGrid}>
          <div>
            <strong>Operating status</strong>
            <span
              className={
                channel.is_active ? org.diagnosticGood : org.diagnosticWarning
              }
            >
              {channel.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div>
            <strong>Endpoint</strong>
            <span
              className={
                channel.phone_number || channel.type === "web_chat"
                  ? org.diagnosticGood
                  : org.diagnosticWarning
              }
            >
              {channel.phone_number ||
                (channel.type === "web_chat" ? "Web / App" : "Not assigned")}
            </span>
          </div>
          <div>
            <strong>AI agent</strong>
            <span
              className={
                channel.agent_id ? org.diagnosticGood : org.diagnosticWarning
              }
            >
              {channel.agent_id ? agentName : "Not assigned"}
            </span>
          </div>
          <div>
            <strong>Recent calls</strong>
            <span>
              {conversations.length
                ? `${conversations.length} records loaded`
                : "No recent records"}
            </span>
          </div>
          <div>
            <strong>Latest recorded event</strong>
            <span>
              {conversations[0]?.created_at
                ? `${conversations[0].status || "Unknown outcome"} Â· ${format(new Date(conversations[0].created_at), "dd MMM yyyy, hh:mm a")}`
                : "No event recorded"}
            </span>
          </div>
        </div>
        <p>
          These checks reflect saved configuration and history. Use a test call
          to verify the provider connection.
        </p>
      </details>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ ACTIVE CALL BANNER Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {activeCallId && (
        <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-md flex items-center justify-between animate-in slide-in-from-top border border-slate-800">
          <div className="flex items-center gap-4 w-full">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-wide text-emerald-400">
                LIVE CALL
              </span>
              <span className="text-slate-300 text-xs flex items-center gap-2">
                Caller:{" "}
                <span className="font-mono text-white">
                  {activeCallContact}
                </span>{" "}
                &bull; AI: <span className="text-white">{agentName}</span>
              </span>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => setIsMonitorOpen(true)}
              className="px-4 py-2 bg-white text-slate-900 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
            >
              View Live Call
            </button>
          </div>

        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ 2. KPI SUMMARY Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {analytics && (
        <div className={org.metrics}>
          <div className={org.metric}>
            <span className={org.metricIcon}>
              <Phone size={17} />
            </span>
            <span className={org.metricLabel}>Total calls</span>
            <strong className={org.metricValue}>
              {analytics.total_calls || 0}
            </strong>
            <span className={org.metricSub}>
              {analytics.inbound_calls || 0} inbound Â·{" "}
              {analytics.outbound_calls || 0} outbound
            </span>
          </div>
          <div className={org.metric}>
            <span className={org.metricIcon}>
              <CheckCircle2 size={17} />
            </span>
            <span className={org.metricLabel}>Completed</span>
            <strong className={org.metricValue}>
              {analytics.completed_calls || 0}
            </strong>
            <span className={org.metricSub}>
              Answer rate: {analytics.answer_rate || 0}%
            </span>
          </div>
          <div className={org.metric}>
            <span className={org.metricIcon}>
              <PhoneMissed size={17} />
            </span>
            <span className={org.metricLabel}>Failed</span>
            <strong className={org.metricValue}>
              {analytics.failed_calls || 0}
            </strong>
            <span className={org.metricSub}>Needs attention</span>
          </div>
          <div className={org.metric}>
            <span className={org.metricIcon}>
              <Clock size={17} />
            </span>
            <span className={org.metricLabel}>Avg duration</span>
            <strong className={org.metricValue}>
              {formatSecs(analytics.average_duration)}
            </strong>
            <span className={org.metricSub}>Per call</span>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ 3. MAIN NAVIGATION TABS Ã¢â€â‚¬Ã¢â€â‚¬ */}
      <div
        className={`${org.sectionTabs} self-start max-w-full overflow-x-auto`}
        role="group"
        aria-label="Channel sections"
      >
        {(
          [
            "overview",
            "scheduler",
            "history",
            "analytics",
            "live_calls",
          ] as const
        ).map((tab) => {
          const labels: Record<string, string> = {
            overview: "Overview & Config",
            scheduler: "Scheduler",
            history: "History & Audio",
            analytics: "Analytics",
            live_calls: "Live Calls",
          };
          const icons: Record<string, React.ReactNode> = {
            overview: <Settings className="w-3.5 h-3.5 mr-2" />,
            scheduler: <Calendar className="w-3.5 h-3.5 mr-2" />,
            history: <History className="w-3.5 h-3.5 mr-2" />,
            analytics: <BarChart className="w-3.5 h-3.5 mr-2" />,
            live_calls: <Activity className="w-3.5 h-3.5 mr-2" />,
          };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className={org.sectionTab}
            >
              {icons[tab]} {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ TAB CONTENTS Ã¢â€â‚¬Ã¢â€â‚¬ */}

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-2 xl:gap-3 items-stretch">
          <div className="lg:contents">
            {hasChanges && (
              <div className="lg:col-span-6 bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="text-sm text-emerald-900">
                  <strong>Review channel impact before saving</strong>
                  {editForm.agent_id !== (channel.agent_id || "") && (
                    <p>
                      AI agent: {agentName} â†’{" "}
                      {agentsMap[editForm.agent_id] || "Unassigned"}
                    </p>
                  )}
                  {editForm.is_active !== (channel.is_active ?? true) && (
                    <p>
                      Operating status:{" "}
                      {channel.is_active ? "Active" : "Inactive"} â†’{" "}
                      {editForm.is_active ? "Active" : "Inactive"}
                      {!editForm.is_active
                        ? ". New inbound calls will stop on this channel."
                        : ""}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={cancelEdits}
                    disabled={isSaving}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfig}
                    disabled={isSaving}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center shadow-sm border border-emerald-700"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {saveMessage && (
              <div
                className={`lg:col-span-6 p-4 rounded-xl flex items-center shadow-sm animate-in fade-in slide-in-from-top-2 ${saveMessage.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-800"}`}
              >
                {saveMessage.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 mr-3 text-emerald-500" />
                ) : (
                  <X className="w-5 h-5 mr-3 text-red-500" />
                )}
                <span className="text-sm font-semibold">
                  {saveMessage.text}
                </span>
              </div>
            )}

            <div className="lg:col-span-3 lg:order-[10] h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-emerald-700" /> Telephony
                  Configuration
                </h3>
              </div>
              <div className="p-4 grid grid-cols-2 xl:grid-cols-3 gap-y-4 gap-x-4">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                    Provider
                  </p>
                  <p className="font-semibold text-slate-900 capitalize text-sm bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 inline-block">
                    {channel.type?.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                    Caller ID
                  </p>
                  <p className="font-mono text-sm text-slate-900 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100 inline-block">
                    {channel.phone_number || "Not assigned"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                    Connection Type
                  </p>
                  <p className="font-medium text-slate-900 text-sm">
                    WebSocket Stream
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                    Call Direction
                  </p>
                  <p className="font-medium text-slate-900 text-sm">
                    Inbound & Outbound
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                    Time Limit
                  </p>
                  <p className="font-medium text-slate-900 text-sm">
                    3600 seconds
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                    Status Callback
                  </p>
                  <p className="font-medium text-slate-900 text-sm">
                    Configured
                  </p>
                </div>
              </div>
            </div>

            {isVoice && (
              <div className="lg:col-span-3 lg:order-[50] h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
                    <Server className="w-4 h-4 mr-2 text-emerald-700" /> {providerName} Integration
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Edit & save from here
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Integration readiness</p>
                        <p className="text-xs text-slate-500">{completedIntegrations} of {integrationChecks.length} required checks complete</p>
                      </div>
                      <span className={`text-sm font-extrabold ${integrationPercent === 100 ? "text-emerald-700" : "text-amber-700"}`}>{integrationPercent}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full rounded-full ${integrationPercent === 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${integrationPercent}%` }} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                      {integrationChecks.map(([label, complete]) => (
                        <div key={label} className={`text-xs flex items-center gap-1.5 ${complete ? "text-emerald-700" : "text-amber-700"}`}>
                          {complete ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          <span>{label}</span>
                        </div>
                      ))}
                    </div>
                    {missingIntegrations.length > 0 && (
                      <p className="mt-2 text-xs text-amber-800">Missing: {missingIntegrations.join(", ")}</p>
                    )}
                  </div>
                  <label className="text-xs font-semibold text-slate-600 min-w-0">
                    Channel name
                    <input value={editForm.name} onChange={(e) => updateForm("name", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 min-w-0">
                    ExoPhone / caller ID
                    <input value={editForm.phone_number} onChange={(e) => updateForm("phone_number", e.target.value)} placeholder="+919513886363" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono text-slate-900" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 min-w-0">
                    {providerName} account / subdomain ID
                    <input value={editForm.exotel_account_sid} onChange={(e) => updateForm("exotel_account_sid", e.target.value)} placeholder="zeniaone3" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900" />
                  </label>
                  {isExotelChannel && (
                    <>
                      <label className="text-xs font-semibold text-slate-600 min-w-0">
                        <span className="flex items-center justify-between gap-2">
                          <span>Exotel API key</span>
                          {channel.config?.provider_credentials_configured && <span className="text-[10px] font-bold text-emerald-700">Saved securely</span>}
                        </span>
                        <span className="relative mt-1 block">
                          <input type={showExotelSecrets ? "text" : "password"} autoComplete="new-password" value={editForm.exotel_api_key} onChange={(e) => updateForm("exotel_api_key", e.target.value)} placeholder={channel.config?.provider_credentials_configured ? "Saved securely â€” enter a new key to replace" : "Enter API key"} className="w-full rounded-lg border border-slate-200 px-3 py-1.5 pr-10 text-sm font-mono text-slate-900" />
                          <button type="button" aria-label={showExotelSecrets ? "Hide API key" : "Show API key"} onClick={() => setShowExotelSecrets((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                            <Eye className="h-4 w-4" />
                          </button>
                        </span>
                      </label>
                      <label className="text-xs font-semibold text-slate-600 min-w-0">
                        <span className="flex items-center justify-between gap-2">
                          <span>Exotel API token</span>
                          {channel.config?.provider_credentials_configured && <span className="text-[10px] font-bold text-emerald-700">Saved securely</span>}
                        </span>
                        <span className="relative mt-1 block">
                          <input type={showExotelSecrets ? "text" : "password"} autoComplete="new-password" value={editForm.exotel_api_token} onChange={(e) => updateForm("exotel_api_token", e.target.value)} placeholder={channel.config?.provider_credentials_configured ? "Saved securely â€” enter a new token to replace" : "Enter API token"} className="w-full rounded-lg border border-slate-200 px-3 py-1.5 pr-10 text-sm font-mono text-slate-900" />
                          <button type="button" aria-label={showExotelSecrets ? "Hide API token" : "Show API token"} onClick={() => setShowExotelSecrets((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                            <Eye className="h-4 w-4" />
                          </button>
                        </span>
                      </label>
                    </>
                  )}
                  <label className="text-xs font-semibold text-slate-600 min-w-0">
                    {isExotelChannel ? "Exotel flow ID" : "Webhook / stream mode"}
                    <input value={editForm.exotel_flow_id} onChange={(e) => updateForm("exotel_flow_id", e.target.value)} placeholder={isExotelChannel ? "1369877" : "WebSocket Stream"} disabled={!isExotelChannel} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono text-slate-900 disabled:bg-slate-50 disabled:text-slate-400" />
                  </label>
                  <label className="md:col-span-2 text-xs font-semibold text-slate-600 min-w-0">
                    Voicebot callback URL
                    <input value={editForm.voicebot_url} onChange={(e) => updateForm("voicebot_url", e.target.value)} placeholder="https://zeniaone-backend.onrender.com/.../voicebot?..." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono text-slate-900" />
                  </label>
                  <label className="md:col-span-2 text-xs font-semibold text-slate-600 min-w-0">
                    Status callback URL
                    <input value={editForm.status_url} onChange={(e) => updateForm("status_url", e.target.value)} placeholder="https://zeniaone-backend.onrender.com/.../status?..." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono text-slate-900" />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 min-w-0">
                    <input type="checkbox" checked={editForm.recording_enabled} onChange={(e) => updateForm("recording_enabled", e.target.checked)} />
                    Call recording enabled
                  </label>
                  <label className="text-xs font-semibold text-slate-600 min-w-0">
                    Recording channels
                    <select value={editForm.recording_channels} onChange={(e) => updateForm("recording_channels", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900">
                      <option value="dual">Dual channel</option>
                      <option value="single">Single channel</option>
                    </select>
                  </label>
                  <div className="md:col-span-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    API keys, API tokens, and webhook secrets are never shown after saving. They are encrypted in the backend database; Render credentials are used only as a fallback.
                  </div>
                  <div className={`md:col-span-2 rounded-lg border px-3 py-2 text-xs font-semibold ${channel.config?.provider_credentials_configured ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
                    {channel.config?.provider_credentials_configured
                      ? "Provider credentials configured for this channel"
                      : isExotelChannel
                        ? "Channel credentials missing â€” enter this Exotel account API key and API token, then save"
                        : "Backend provider credentials missing â€” configure the provider credentials"}
                  </div>
                  <div className="md:col-span-2 flex flex-wrap items-center gap-2 pt-1">
                    {isExotelChannel && (
                      <button onClick={handleGenerateCallbackUrls} disabled={isGeneratingUrls} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 disabled:opacity-50">
                        {isGeneratingUrls ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        Generate Callback URLs
                      </button>
                    )}
                    <button onClick={handleSaveConfig} disabled={isSaving || !hasChanges} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                      {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save Integration
                    </button>
                    <button onClick={handleVerifyConfig} disabled={isVerifying} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
                      {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Verify Connection
                    </button>
                    {verification && (
                      <span className={`text-xs font-bold ${verification.valid ? "text-emerald-700" : "text-rose-700"}`}>
                        {verification.valid ? "Configuration verified" : "Verification needs attention"}
                      </span>
                    )}
                  </div>
                  {verification?.checks?.length > 0 && (
                    <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                      {verification.checks.map((check: any) => (
                        <div key={check.name} className={`flex items-center justify-between gap-3 text-xs ${check.ok ? "text-emerald-700" : "text-rose-700"}`}>
                          <span className="font-semibold">{check.ok ? "âœ“" : "!"} {check.name}</span>
                          <span className="text-right text-slate-500">{check.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="lg:col-span-3 lg:order-[60] h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-emerald-700" /> AI
                  Configuration & Routing
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Editable Â· validated</span>
              </div>
              <div className="p-5 space-y-5">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1.5">
                    AI Agent
                  </label>
                  <SmartSelect
                    value={editForm.agent_id}
                    onChange={(value) => updateForm("agent_id", value)}
                    placeholder="Unassigned"
                    searchPlaceholder="Search agentsâ€¦"
                    options={Object.entries(agentsMap).map(
                      ([value, label]) => ({ value, label }),
                    )}
                  />
                </div>
                {aiConfigDraft ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <label className="text-xs font-semibold text-slate-600">
                        Default language
                        <select value={aiConfigDraft.default_language} onChange={(e) => updateAiConfig("default_language", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                          {(aiConfigDraft.supported_languages || []).map((code: string) => <option key={code} value={code}>{code}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Voice engine
                        <select value={aiConfigDraft.voice_engine} onChange={(e) => updateAiConfig("voice_engine", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900">
                          <option value="pipeline">Pipeline</option><option value="gemini_live">Gemini Live</option><option value="gemini_clone">Gemini Clone</option>
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Gemini voice
                        <input value={aiConfigDraft.gemini_voice} onChange={(e) => updateAiConfig("gemini_voice", e.target.value)} placeholder="Aoede" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
                      </label>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between mb-2"><span className="text-xs font-bold text-slate-700">Supported languages</span><span className="text-[10px] text-slate-400">BCP-47 codes</span></div>
                      <div className="flex flex-wrap gap-2 mb-3">{(aiConfigDraft.supported_languages || []).map((code: string) => <button type="button" key={code} onClick={() => updateAiConfig("supported_languages", (aiConfigDraft.supported_languages || []).filter((item: string) => item !== code || item === aiConfigDraft.default_language))} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{code} Ã—</button>)}</div>
                      <div className="flex gap-2"><input value={languageInput} onChange={(e) => setLanguageInput(e.target.value)} placeholder="Add language, e.g. hi-IN" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button type="button" onClick={() => { const value = languageInput.trim(); if (value && !(aiConfigDraft.supported_languages || []).includes(value)) { updateAiConfig("supported_languages", [...(aiConfigDraft.supported_languages || []), value]); setLanguageInput(""); } }} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Add</button></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <label className="text-xs font-semibold text-slate-600">LLM model<input value={aiConfigDraft.llm_model} onChange={(e) => updateAiConfig("llm_model", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-semibold text-slate-600">LLM max tokens<input type="number" min="100" max="4096" value={aiConfigDraft.llm_max_tokens} onChange={(e) => updateAiConfig("llm_max_tokens", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-semibold text-slate-600">Temperature<input type="number" min="0" max="2" step="0.1" value={aiConfigDraft.llm_temperature} onChange={(e) => updateAiConfig("llm_temperature", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-semibold text-slate-600">TTS voice<input value={aiConfigDraft.tts_voice} onChange={(e) => updateAiConfig("tts_voice", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <label className="text-xs font-semibold text-slate-600">Voice speed<input type="number" min="0.5" max="2" step="0.1" value={aiConfigDraft.voice_speed} onChange={(e) => updateAiConfig("voice_speed", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-semibold text-slate-600">Voice volume<input type="number" min="0" max="2" step="0.1" value={aiConfigDraft.voice_volume} onChange={(e) => updateAiConfig("voice_volume", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-semibold text-slate-600">Voice clarity<input type="number" min="0" max="100" value={aiConfigDraft.voice_clarity} onChange={(e) => updateAiConfig("voice_clarity", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-semibold text-slate-600">Voice stability<input type="number" min="0" max="100" value={aiConfigDraft.voice_stability} onChange={(e) => updateAiConfig("voice_stability", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <label className="text-xs font-semibold text-slate-600">TTS model<input value={aiConfigDraft.tts_model} onChange={(e) => updateAiConfig("tts_model", e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-semibold text-slate-600">Max turns<input type="number" min="1" max="100" value={aiConfigDraft.max_conversation_turns} onChange={(e) => updateAiConfig("max_conversation_turns", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="text-xs font-semibold text-slate-600">Silence timeout (ms)<input type="number" min="200" max="5000" value={aiConfigDraft.silence_timeout_ms} onChange={(e) => updateAiConfig("silence_timeout_ms", Number(e.target.value))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
                      <label className="flex items-center gap-2 pt-5 text-xs font-semibold text-slate-600"><input type="checkbox" checked={aiConfigDraft.enable_background_audio} onChange={(e) => updateAiConfig("enable_background_audio", e.target.checked)} />Background audio</label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={saveAiConfiguration} disabled={aiConfigSaving || !aiConfigDirty} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{aiConfigSaving ? "Savingâ€¦" : "Save AI configuration"}</button>{aiConfigDirty && <span className="text-xs text-amber-700">Unsaved AI changes</span>}</div>
                  </>
                ) : <p className="text-sm text-slate-400">Select an AI agent to configure its language, model and voice.</p>}

                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Voice Operating Modes</p>
                      <p className="text-xs text-slate-500 mt-1">Choose one complete voice flow; provider routing updates automatically.</p>
                    </div>
                    {voiceModeApplying && <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {VOICE_MODES.map((mode) => {
                      const activeMode = mode.id === (aiConfigDraft?.voice_engine === "gemini_live" ? "gemini_s2s" : routingDraft?.phone_voice?.llm?.[0] === "groq" ? "classic" : "gemini_clone");
                      return (
                        <div key={mode.id} className={`flex h-full flex-col rounded-xl border p-3 transition-colors ${activeMode ? "border-emerald-400 bg-emerald-50/60 ring-1 ring-emerald-200" : "border-slate-200 bg-white"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900">{mode.title}</p>
                            {activeMode && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Selected</span>}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-600">{mode.description}</p>
                          <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700">{mode.flow}</p>
                          <button type="button" onClick={() => applyVoiceMode(mode)} disabled={voiceModeApplying || activeMode} className={`mt-auto pt-3 w-full rounded-lg px-3 py-2 text-xs font-bold ${activeMode ? "cursor-default bg-emerald-100 text-emerald-700" : "bg-slate-900 text-white hover:bg-slate-800"}`}>
                            {activeMode ? "Active profile" : "Use this profile"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {aiConfigMessage && <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">{aiConfigMessage}</p>}
              </div>
            </div>

            <div className="lg:contents">
              <div className="lg:col-span-2 lg:order-[30] h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
                    <Database className="w-4 h-4 mr-2 text-emerald-700" />{" "}
                    Knowledge & RAG
                  </h3>
                  <button type="button" onClick={() => router.push("/admin/knowledge")} className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 hover:text-indigo-900">Manage</button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Knowledge Base
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Primary company index
                      </p>
                    </div>
                    {agentsData[editForm.agent_id]?.knowledge_base_id ? (
                      <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Connected
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        Not Connected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        RAG Pipeline
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Semantic search and retrieval
                      </p>
                    </div>
                    {agentsData[editForm.agent_id]?.knowledge_base_id ? (
                      <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                        Enabled
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold tracking-wider uppercase text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 lg:order-[30] h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
                    <Settings className="w-4 h-4 mr-2 text-slate-500" /> Call
                    Behavior
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Barge-in / Interruption
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Callers can interrupt the AI
                      </p>
                    </div>
                    <button type="button" onClick={() => updateAiConfig("barge_in_enabled", !(aiConfigDraft?.barge_in_enabled ?? true))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiConfigDraft?.barge_in_enabled ?? true ? "bg-emerald-500" : "bg-slate-300"}`} aria-label="Toggle barge-in">
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiConfigDraft?.barge_in_enabled ?? true ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Call Recording
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Dual-channel stereo audio
                      </p>
                    </div>
                    <button type="button" onClick={() => updateForm("recording_enabled", !editForm.recording_enabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.recording_enabled ? "bg-emerald-500" : "bg-slate-300"}`} aria-label="Toggle call recording">
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.recording_enabled ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button type="button" onClick={saveAiConfiguration} disabled={aiConfigSaving || !aiConfigDirty} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Save AI behavior</button>
                    <button type="button" onClick={handleSaveConfig} disabled={isSaving || !hasChanges} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">Save recording</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 lg:order-[20] h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
                  <Activity className="w-4 h-4 mr-2 text-emerald-700" /> Channel
                  Status
                </h3>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Operating Status
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Enable or disable inbound calls
                    </p>
                  </div>
                  <button
                    onClick={() => updateForm("is_active", !editForm.is_active)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${editForm.is_active ? "bg-emerald-500" : "bg-slate-300"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.is_active ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                </div>
                {editForm.is_active ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-xs text-emerald-800">
                    <span className="font-bold flex items-center mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Channel
                      Active
                    </span>
                    This channel is live and will accept calls and messages
                    based on its telephony configuration.
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
                    <span className="font-bold flex items-center mb-1">
                      <PhoneMissed className="w-3.5 h-3.5 mr-1.5" /> Channel
                      Disabled
                    </span>
                    This channel is currently paused. It will reject inbound
                    connections and prevent scheduled outbound calls.
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="lg:col-span-2 lg:order-[40] h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-3">
              <h3 className="flex items-center text-sm font-bold uppercase tracking-wider text-slate-900">
                <History className="mr-2 h-4 w-4 text-slate-500" /> Recent Activity
              </h3>
              <button type="button" onClick={() => setActiveTab("history")} className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 hover:text-indigo-900">
                View all history
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {conversations.slice(0, 4).map((conv, idx) => (
                <button type="button" key={conv.id || idx} onClick={() => openCallDetails(conv)} className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50">
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold capitalize text-slate-900">
                      {conv.direction === "outbound" ? "Outbound" : "Inbound"} Â· {conv.status ? conv.status.replace("-", " ") : "Unknown"}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">
                      {conv.contact_name ? `${conv.contact_name} Â· ` : ""}{conv.to_phone || conv.caller_phone || "Unknown"}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">{formatSecs(conv.duration_seconds)}</span>
                  <span className="hidden text-[11px] font-medium text-slate-400 sm:block">
                    {conv.created_at ? format(new Date(conv.created_at), "dd MMM, hh:mm a") : "Unknown"}
                  </span>
                  {conv.recording_url ? <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">Recording</span> : <span className="text-[10px] font-semibold text-slate-400">No audio</span>}
                </button>
              ))}
              {conversations.length === 0 && <div className="px-5 py-5 text-center text-sm text-slate-500">No recent activity.</div>}
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULER TAB */}
      {activeTab === "scheduler" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
            <h3 className="text-lg font-bold text-slate-900 mb-2 border-b border-slate-100 pb-3 flex items-center">
              <PhoneCall className="w-5 h-5 mr-2 text-emerald-700" /> Trigger
              Outbound Call
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Initiate an immediate or scheduled outbound AI call from this
              channel.
            </p>

            <div className="space-y-5 flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    disabled={isDialing}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:opacity-60"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="E.g. Saurav"
                  />
                </div>
                <div className="relative" ref={phoneRef}>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Phone Number *
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-sm font-semibold">
                      +91
                    </span>
                    <input
                      type="text"
                      disabled={isDialing}
                      className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-r-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:opacity-60"
                      value={destNumber.replace("+91", "")}
                      onChange={(e) => {
                        let raw = e.target.value
                          .replace("+91", "")
                          .replace(/\D/g, "");
                        if (raw.startsWith("0")) raw = raw.substring(1);
                        setDestNumber("+91" + raw.substring(0, 10));
                      }}
                      onFocus={() => setShowPhoneDropdown(true)}
                      placeholder="10-digit number"
                    />
                  </div>
                  {showPhoneDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      <div className="px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100">
                        Select from History
                      </div>
                      {Array.from(
                        new Set(
                          conversations
                            .map((c) => c.caller_phone)
                            .filter((p) => p && p !== "Unknown" && p !== "â€”"),
                        ),
                      ).map((phone) => (
                        <div
                          key={phone}
                          className="px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer flex items-center transition-colors"
                          onClick={() => {
                            let raw = phone
                              .replace("+91", "")
                              .replace(/\D/g, "");
                            if (raw.startsWith("0")) raw = raw.substring(1);
                            setDestNumber("+91" + raw);
                            // Auto-fill name if known
                            const match = conversations.find(
                              (c) => c.caller_phone === phone,
                            );
                            if (match && match.contact_name)
                              setContactName(match.contact_name);
                            setShowPhoneDropdown(false);
                          }}
                        >
                          <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" />
                          <span className="font-medium">{phone}</span>
                          {conversations.find((c) => c.caller_phone === phone)
                            ?.contact_name && (
                              <span className="ml-2 text-xs text-slate-400">
                                (
                                {
                                  conversations.find(
                                    (c) => c.caller_phone === phone,
                                  )?.contact_name
                                }
                                )
                              </span>
                            )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Quick Dial Chips */}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.from(
                      new Set(
                        conversations
                          .filter(
                            (c) =>
                              c.status === "failed" &&
                              c.caller_phone &&
                              c.caller_phone !== "Unknown",
                          )
                          .map((c) => c.caller_phone),
                      ),
                    )
                      .slice(0, 2)
                      .map((phone) => (
                        <button
                          key={"retry-" + phone}
                          onClick={() => {
                            let raw = phone
                              .replace("+91", "")
                              .replace(/\D/g, "");
                            if (raw.startsWith("0")) raw = raw.substring(1);
                            setDestNumber("+91" + raw);
                            setShowPhoneDropdown(false);
                          }}
                          className="inline-flex items-center px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold tracking-wide hover:bg-rose-100 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Retry{" "}
                          {phone.replace("+91", "")}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              <div className="relative" ref={topicRef}>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Call Objective / Topic
                </label>
                <input
                  type="text"
                  disabled={isDialing}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:opacity-60"
                  value={callTopic}
                  onChange={(e) => setCallTopic(e.target.value)}
                  onFocus={() => setShowTopicDropdown(true)}
                  placeholder="e.g. Sales Pitch, Payment Reminder..."
                />
                {showTopicDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {DEFAULT_TOPICS.map((topic) => (
                      <div
                        key={topic}
                        className="px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer transition-colors"
                        onClick={() => {
                          setCallTopic(topic);
                          setShowTopicDropdown(false);
                        }}
                      >
                        {topic}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Custom AI Prompt (Optional)
                  </label>
                  <button
                    onClick={handleGeneratePrompt}
                    disabled={isGeneratingPrompt || isDialing}
                    className="inline-flex items-center text-[10px] font-bold tracking-wider uppercase px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-100 disabled:opacity-50"
                  >
                    {isGeneratingPrompt ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-1" />
                    )}
                    {customPrompt ? "Regenerate" : "Generate Prompt"}
                  </button>
                </div>
                <textarea
                  rows={3}
                  disabled={isDialing}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none disabled:opacity-60"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Write custom instructions or click Generate Prompt for AI magic..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="col-span-2 text-xs font-semibold text-slate-600 mb-1 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1.5" /> Scheduled Date &
                  Time
                </div>
                <div>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    disabled={isDialing}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none transition-all disabled:opacity-60"
                  />
                </div>
                <div>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    disabled={isDialing}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              {testCallStatus && (
                <div
                  className={`p-3 rounded-lg flex items-start text-sm border ${testCallStatus.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}
                >
                  {testCallStatus.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 mr-2 mt-0.5 shrink-0 text-red-500" />
                  )}
                  <span className="font-medium">{testCallStatus.message}</span>
                </div>
              )}

              <div className="pt-2 flex gap-3 mt-auto">
                <button
                  onClick={handleSaveContact}
                  disabled={isDialing}
                  className="flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-3 rounded-lg shadow-sm transition-all flex justify-center items-center text-xs border border-slate-200"
                >
                  <Save className="w-4 h-4 mr-1.5" /> Save
                </button>
                <button
                  onClick={handleDialImmediate}
                  disabled={isDialing || isMonitorOpen || !destNumber.trim()}
                  className="flex-1 bg-slate-900 disabled:opacity-60 hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow-sm transition-all flex justify-center items-center text-xs border border-slate-800"
                >
                  {isDialing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{" "}
                      Submitting...
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-4 h-4 mr-1.5" /> Dial Immediately
                    </>
                  )}
                </button>
                <button
                  onClick={handleScheduleCall}
                  disabled={
                    isDialing ||
                    !destNumber.trim() ||
                    !scheduledDate ||
                    !scheduledTime
                  }
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all flex justify-center items-center text-xs disabled:opacity-60 disabled:hover:bg-indigo-600 shadow-sm border border-indigo-700"
                >
                  <Calendar className="w-4 h-4 mr-1.5" /> Schedule for Later
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center">
                Scheduled Queue{" "}
                {scheduledJobs.length > 0 && (
                  <span className="ml-2 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                    {scheduledJobs.length}
                  </span>
                )}
              </h3>
              <button
                onClick={fetchScheduledJobs}
                className="text-slate-400 hover:text-indigo-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 bg-slate-50/30 overflow-y-auto">
              {scheduledJobs.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center mb-3 shadow-sm">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h4 className="text-slate-900 font-bold mb-1 text-sm">
                    Scheduling Active
                  </h4>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Use the form to schedule a call. The backend will
                    automatically trigger it at the specified time.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {scheduledJobs.map((job) => {
                    const runDate = new Date(job.scheduled_at);
                    const isPassed = runDate < new Date();
                    return (
                      <div
                        key={job.id}
                        className="p-4 hover:bg-white transition-colors group"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-bold text-sm text-slate-900 flex items-center">
                              {job.contact_name || "Unknown Contact"}
                              <span className="text-xs text-slate-500 font-normal ml-2">
                                {job.phone_number}
                              </span>
                            </div>
                            <div className="text-xs text-indigo-600 font-semibold mt-0.5">
                              {job.topic || "No topic"}
                            </div>
                          </div>
                          <button
                            onClick={() => handleCancelScheduledCall(job.id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                            title="Cancel Call"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="flex items-center text-xs text-slate-500 mt-3 bg-slate-100/50 p-2 rounded-lg border border-slate-100">
                          <Clock
                            className={`w-3.5 h-3.5 mr-1.5 ${isPassed ? "text-amber-500" : "text-emerald-500"}`}
                          />
                          <span
                            className={
                              isPassed
                                ? "text-amber-700 font-medium"
                                : "text-emerald-700 font-medium"
                            }
                          >
                            {format(runDate, "MMM d, yyyy â€¢ h:mm a")}
                          </span>
                          <span className="ml-auto text-[10px] uppercase tracking-wider font-bold">
                            <LiveCountdown
                              runDate={runDate}
                              isPassed={isPassed}
                            />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 flex flex-col gap-5">
            {/* Search and Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search phone numbers..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <FilterSelect
                  label="Date"
                  value={historyTimeFilter}
                  onChange={setHistoryTimeFilter}
                  options={[
                    { label: "Last 7 days", value: "7d" },
                    { label: "Today", value: "today" },
                    { label: "All time", value: "all" },
                  ]}
                />
                <FilterSelect
                  label="Status"
                  value={historyOutcomeFilter}
                  onChange={setHistoryOutcomeFilter}
                  options={[
                    { label: "All", value: "all" },
                    { label: "Completed", value: "completed" },
                    { label: "Failed", value: "failed" },
                    { label: "No answer", value: "no-answer" },
                    { label: "Busy", value: "busy" },
                  ]}
                />
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                      <th className="px-5 py-3">Direction & Contact</th>
                      <th className="px-5 py-3">Date & Time</th>
                      <th className="px-5 py-3">Duration</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 w-[160px] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {(() => {
                      const filtered = conversations.filter((conv: any) => {
                        if (historyTimeFilter === "today") {
                          const today = new Date().toDateString();
                          const convDate = new Date(
                            conv.created_at || conv.timestamp || Date.now(),
                          ).toDateString();
                          if (today !== convDate) return false;
                        } else if (historyTimeFilter === "7d") {
                          const sevenDaysAgo = new Date();
                          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                          const convDate = new Date(
                            conv.created_at || conv.timestamp || Date.now(),
                          );
                          if (convDate < sevenDaysAgo) return false;
                        }

                        if (
                          historyOutcomeFilter !== "all" &&
                          (historyOutcomeFilter === "failed"
                            ? !["failed", "hung-up", "no-answer", "busy", "cancelled"].includes(conv.status)
                            : conv.status !== historyOutcomeFilter)
                        )
                          return false;

                        return true;
                      });

                      const paginated = filtered.slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage,
                      );

                      const todayConvs: any[] = [];
                      const yesterdayConvs: any[] = [];
                      const olderConvs: any[] = [];

                      paginated.forEach((c) => {
                        const date = new Date(
                          c.created_at || c.timestamp || Date.now(),
                        );
                        if (isToday(date)) todayConvs.push(c);
                        else if (isYesterday(date)) yesterdayConvs.push(c);
                        else olderConvs.push(c);
                      });

                      const groups = [
                        {
                          label: "Today",
                          items: todayConvs,
                          icon: <Clock className="w-3.5 h-3.5" />,
                        },
                        {
                          label: "Yesterday",
                          items: yesterdayConvs,
                          icon: <Calendar className="w-3.5 h-3.5" />,
                        },
                        {
                          label: "Older",
                          items: olderConvs,
                          icon: <Archive className="w-3.5 h-3.5" />,
                        },
                      ].filter((g) => g.items.length > 0);

                      if (groups.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={5}
                              className="p-12 text-center text-slate-400 text-sm"
                            >
                              No calls found in this channel.
                            </td>
                          </tr>
                        );
                      }

                      return groups.map((g, gIdx) => (
                        <Fragment key={gIdx}>
                          <tr className="bg-slate-50/50">
                            <td
                              colSpan={5}
                              className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-y border-slate-100"
                            >
                              <div className="flex items-center gap-1.5">
                                {g.icon} {g.label}
                              </div>
                            </td>
                          </tr>
                          {g.items.map((conv, idx) => (
                            <tr
                              key={conv.id || conv._id || idx}
                              className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                              onClick={() => openCallDetails(conv)}
                            >
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2 mb-1.5">
                                  {String(conv.direction || "inbound").toLowerCase() === "outbound" ? (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold tracking-wide">
                                      <PhoneOutgoing className="w-3.5 h-3.5" />
                                      OUTBOUND
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-green-50 border border-green-100 text-emerald-700 text-xs font-semibold tracking-wide">
                                      <PhoneIncoming className="w-3.5 h-3.5" />
                                      INBOUND
                                    </div>
                                  )}
                                </div>
                                <div className="font-medium text-slate-900 text-sm mb-1.5 flex items-center gap-1.5">
                                  <span className="text-slate-500 font-normal">
                                    {String(conv.direction || "inbound").toLowerCase() === "outbound"
                                      ? "To:"
                                      : "From:"}
                                  </span>
                                  <span className="font-mono font-semibold tracking-tight">
                                    {conv.direction === "outbound"
                                      ? conv.to_phone ||
                                      conv.destination_phone ||
                                      conv.caller_phone ||
                                      conv.caller_to ||
                                      "Unknown"
                                      : conv.caller_phone || "Unknown"}
                                  </span>
                                  {conv.contact_name &&
                                    conv.contact_name !== conv.caller_phone && (
                                      <span className="text-xs text-slate-400 font-normal font-sans">
                                        ({conv.contact_name})
                                      </span>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium tracking-wider flex items-center gap-2">
                                  <span>
                                    Channel:{" "}
                                    <span className="font-mono text-slate-400">
                                      {channel.phone_number || "N/A"}
                                    </span>
                                  </span>
                                  {conv.recording_url ? (
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                                      Audio
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="text-sm text-slate-700">
                                  {conv.created_at
                                    ? format(
                                      new Date(conv.created_at),
                                      "dd MMM yyyy",
                                    )
                                    : "Unknown"}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {conv.created_at
                                    ? format(
                                      new Date(conv.created_at),
                                      "hh:mm:ss a",
                                    )
                                    : ""}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="text-sm text-slate-700 font-medium">
                                  {formatSecs(conv.duration_seconds)}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex flex-col items-start gap-1.5">
                                  {conv.status === "completed" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                                      Completed
                                    </span>
                                  ) : conv.status === "failed" ||
                                    conv.status === "hung-up" ||
                                    conv.status === "busy" ||
                                    conv.status === "no-answer" ||
                                    conv.status === "cancelled" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-[11px] font-semibold text-amber-700 border border-amber-200 capitalize">
                                      {conv.status.replace("-", " ")}
                                    </span>
                                  ) : conv.status === "calling" ||
                                    conv.status === "ringing" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-[11px] font-semibold text-blue-700 border border-blue-200 capitalize animate-pulse">
                                      {conv.status}
                                    </span>
                                  ) : conv.status === "active" ||
                                    conv.status === "connected" ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-[11px] font-semibold text-indigo-700 border border-indigo-200 animate-pulse capitalize">
                                      {conv.status}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 text-[11px] font-semibold text-gray-700 border border-gray-200 capitalize">
                                      {conv.status || "Unknown"}
                                    </span>
                                  )}

                                  {[
                                    "calling",
                                    "ringing",
                                    "active",
                                    "in-progress",
                                  ].includes(conv.status) && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-28 [&>div>button]:h-7 [&>div>button]:rounded [&>div>button]:px-1.5 [&>div>button]:text-[10px]"
                                      >
                                        <SmartSelect
                                          value=""
                                          placeholder="Update Status"
                                          searchable={false}
                                          onChange={async (value) => {
                                            if (value === "force_fail") {
                                              try {
                                                await fetchApi(
                                                  `/admin/conversations/${channel.company_id}/${conv.id || conv._id}/status`,
                                                  { method: "POST", body: JSON.stringify({ status: value }) },
                                                );
                                                setConversations((prev) =>
                                                  prev.map((c) =>
                                                    c.id === conv.id ||
                                                      c._id === conv._id
                                                      ? { ...c, status: "failed" }
                                                      : c,
                                                  ),
                                                );
                                              } catch (err) {
                                                console.error(
                                                  "Failed to update status",
                                                  err,
                                                );
                                              }
                                            } else {
                                              try {
                                                await fetchApi(
                                                  `/admin/conversations/${channel.company_id}/${conv.id || conv._id}/status`,
                                                  { method: "POST", body: JSON.stringify({ status: value }) },
                                                );
                                                setConversations((prev) =>
                                                  prev.map((c) =>
                                                    c.id === conv.id || c._id === conv._id
                                                      ? { ...c, status: value }
                                                      : c,
                                                  ),
                                                );
                                              } catch (err) {
                                                console.error("Failed to update status", err);
                                              }
                                            }
                                          }}
                                          options={[
                                            {
                                              value: "completed",
                                              label: "Mark as Completed",
                                              badge: "Status",
                                              icon: <Check className="h-4 w-4" />,
                                            },
                                            {
                                              value: "failed",
                                              label: "Mark as Failed",
                                              badge: "Status",
                                              icon: (
                                                <CircleX className="h-4 w-4" />
                                              ),
                                            },
                                            {
                                              value: "cancelled",
                                              label: "Mark as Cancelled",
                                              badge: "Status",
                                              icon: <X className="h-4 w-4" />,
                                            },
                                            {
                                              value: "busy",
                                              label: "Mark as Busy",
                                              badge: "Status",
                                              icon: <PhoneMissed className="h-4 w-4" />,
                                            },
                                            {
                                              value: "no-answer",
                                              label: "Mark as No Answer",
                                              badge: "Status",
                                              icon: <PhoneMissed className="h-4 w-4" />,
                                            },
                                            {
                                              value: "hung-up",
                                              label: "Mark as Hung Up",
                                              badge: "Status",
                                              icon: <PhoneOff className="h-4 w-4" />,
                                            },
                                          ]}
                                        />
                                      </div>
                                    )}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right w-[160px]">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation(); /* Add pin logic here */
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                    title="Pin Call"
                                  >
                                    <Pin className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation(); /* Add archive logic here */
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                                    title="Archive Call"
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation(); /* Add delete logic here */
                                    }}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                    title="Delete Call"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ));
                    })()}
                  </tbody>
                </table>

                {/* Pagination Controls */}
                {conversations.length > 0 && (
                  <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <p className="text-xs text-slate-500 font-medium">
                      Showing{" "}
                      <span className="font-bold text-slate-700">
                        {(currentPage - 1) * itemsPerPage + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-bold text-slate-700">
                        {Math.min(
                          currentPage * itemsPerPage,
                          conversations.length,
                        )}
                      </span>{" "}
                      of{" "}
                      <span className="font-bold text-slate-700">
                        {conversations.length}
                      </span>{" "}
                      calls
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1 mx-2">
                        {renderPageNumbers()}
                      </div>
                      <button
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(
                              Math.ceil(conversations.length / itemsPerPage),
                              p + 1,
                            ),
                          )
                        }
                        disabled={
                          currentPage >=
                          Math.ceil(conversations.length / itemsPerPage)
                        }
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Insights Sidebar (Right Column) */}
          <div className="xl:col-span-1 xl:sticky xl:top-24 self-start">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 mb-2">
                <BarChart2 className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-slate-900 text-base tracking-tight">
                  Channel Insights
                </h3>
              </div>
              <p className="text-sm text-slate-500 mb-6">
                Internal channel conversational intelligence over the selected
                period.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Total Convs
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {analytics.total_calls || 0}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Success Rate
                  </p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {analytics.answer_rate || 0}
                    %
                  </p>
                  <p className="text-[9px] font-medium text-emerald-700/70 uppercase tracking-wider mt-0.5">
                    {analytics.completed_calls || 0} / {analytics.total_calls || 0} COMPLETED
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Avg Duration
                  </p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatSecs(analytics.average_duration || 0)}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Total Talk Time
                  </p>
                  <p className="text-xl font-bold text-indigo-600">
                    {Math.round((analytics.total_duration || 0) / 60)}{" "}
                    <span className="text-sm">min</span>
                  </p>
                </div>
              </div>

              {/* Activity Trend */}
              <div className="mt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-4">
                  Activity Trend (Last 7 Days)
                </p>
                {(() => {
                  const days = 7;
                  const data = Array(days).fill(0);
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  conversations.forEach((c: any) => {
                    const d = new Date(
                      c.created_at || c.timestamp || Date.now(),
                    );
                    d.setHours(0, 0, 0, 0);
                    const diffDays = Math.floor(
                      (now.getTime() - d.getTime()) / (1000 * 3600 * 24),
                    );
                    if (diffDays >= 0 && diffDays < days) {
                      data[days - 1 - diffDays]++;
                    }
                  });
                  const max = Math.max(...data, 1);
                  return (
                    <>
                      <div className="flex items-end gap-1.5 h-20 mt-2 mb-2">
                        {data.map((count, i) => {
                          const heightPct = Math.round((count / max) * 100);
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-indigo-100 rounded-t-sm hover:bg-indigo-400 transition-colors cursor-pointer group relative"
                              style={{ height: `${heightPct || 5}%` }}
                            >
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                {count} calls
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400 border-t border-slate-100 pt-2">
                        <span>7 Days Ago</span>
                        <span>Today</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Top Questions */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Top Questions / Intents
                </p>
                <div className="flex flex-col items-center justify-center py-5 bg-slate-50 border border-slate-100 rounded-lg border-dashed">
                  <Bot className="w-5 h-5 text-slate-300 mb-1.5" />
                  <span className="text-xs font-semibold text-slate-500">
                    AI Intent Analysis
                  </span>
                  <span className="text-[10px] text-slate-400 text-center px-4 mt-0.5">
                    Collecting conversational data to identify top intents.
                  </span>
                </div>
              </div>

              {/* Agent Activity */}
              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Agent Activity
                </p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">
                      Successfully Handled
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      {analytics.total_calls > 0
                        ? Math.round(
                          (analytics.completed_calls /
                            analytics.total_calls) *
                          100,
                        )
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">
                      Active / Processing
                    </span>
                    <span className="text-xs font-bold text-amber-600">
                      {analytics.total_calls > 0
                        ? Math.round(
                          (analytics.active_calls / analytics.total_calls) *
                          100,
                        )
                        : 0}
                      %
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">
                      Dropped / Hung-up
                    </span>
                    <span className="text-xs font-bold text-rose-600">
                      {analytics.total_calls > 0
                        ? Math.round(
                          (analytics.failed_calls / analytics.total_calls) *
                          100,
                        )
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* View Analytics Button */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setActiveTab("analytics")}
                  className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[13px] rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  View Detailed Analytics{" "}
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {!analytics ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center min-h-[300px]">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin mb-4" />
              <p className="text-sm font-medium text-slate-500">
                Loading analytics...
              </p>
            </div>
          ) : analytics.total_calls === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center min-h-[300px] text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <BarChart className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">
                No call data yet
              </h3>
              <p className="text-slate-500 max-w-sm mb-6 text-sm">
                There are no conversation records available for this channel
                yet.
              </p>
              <button
                onClick={() => setActiveTab("overview")}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                Return to Overview
              </button>
            </div>
          ) : (
            <>
              {/* SECTION 1: Usage & Plan Metrics (no duplicate KPIs) */}
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
                        ? ` &mdash; ${analytics.subscription.usage_month}`
                        : ""}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl font-bold text-slate-900 capitalize">
                        {analytics.subscription.plan}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${analytics.subscription.status === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}
                      >
                        {analytics.subscription.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Company-wide:{" "}
                      {analytics.subscription.company_call_count?.toLocaleString() ??
                        "&mdash;"}{" "}
                      calls &middot;{" "}
                      {analytics.subscription.company_call_minutes_used?.toFixed(
                        1,
                      ) ?? "&mdash;"}{" "}
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
                  <p className="text-sm font-medium text-slate-600">
                    Not configured
                  </p>
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
                            analytics.call_trend[
                              analytics.call_trend.length - 1
                            ]?.date;
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
                          const ticks = [
                            yMax,
                            yMax * 0.75,
                            yMax * 0.5,
                            yMax * 0.25,
                            0,
                          ];
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
                                  {analytics.call_trend.map(
                                    (t: any, idx: number) => {
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
                                              minHeight:
                                                t.calls > 0 ? "4px" : "0",
                                            }}
                                          ></div>
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                              {/* X-axis Labels */}
                              <div className="flex items-center ml-8 gap-2 mt-3">
                                {analytics.call_trend.map(
                                  (t: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex-1 text-[10px] font-medium text-slate-400 text-center truncate"
                                    >
                                      {formatDateStr(t.date)}
                                    </div>
                                  ),
                                )}
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
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
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
                                      <span className="font-sans text-slate-900">{call.contact_name}</span>{" "}
                                      <span className="text-xs font-normal text-slate-500 font-mono">({call.caller_phone || call.caller_to || "Not available"})</span>
                                    </span>
                                  ) : (
                                    call.caller_phone || call.caller_to || "Not available"
                                  )}
                                </p>
                                <p className="text-xs text-slate-500 flex items-center gap-2">
                                  <span
                                    className={`uppercase text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded ${call.direction === "outbound" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}
                                  >
                                    {call.direction}
                                  </span>
                                  <span>
                                    {call.created_at
                                      ? formatDistanceToNow(
                                        new Date(call.created_at),
                                        { addSuffix: true },
                                      )
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
                                className={`w-2 h-2 rounded-full ${o.status === "Completed" ? "bg-emerald-500" : o.status === "Active" ? "bg-sky-400" : o.status === "Failed" ? "bg-rose-400" : "bg-slate-300"}`}
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
                              className={`h-full rounded-full ${o.status === "Completed" ? "bg-emerald-400" : o.status === "Active" ? "bg-sky-400" : o.status === "Failed" ? "bg-rose-400" : "bg-slate-300"}`}
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
                          Collecting conversational data to automatically
                          generate top intents and queries.
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
                              (analytics.completed_calls /
                                analytics.total_calls) *
                              100,
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
                              (analytics.active_calls /
                                analytics.total_calls) *
                              100,
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
                              (analytics.failed_calls /
                                analytics.total_calls) *
                              100,
                            )
                            : 0}
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* LIVE CALLS TAB */}
      {activeTab === "live_calls" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
          <LiveCallsPage />
        </div>
      )}

      {/* CALL DETAIL DRAWER */}
      {selectedCall && (
        <Drawer
          open={Boolean(selectedCall)}
          onClose={() => setSelectedCall(null)}
          title="Call details"
          description={`${selectedCall.direction === "outbound" ? "Outbound" : "Inbound"} Â· ${selectedCall.status || "Active"}`}
          className="max-w-xl bg-[#FCFDFB]"
        >
          <div className="flex flex-col">
            <div className="p-6 border-b border-[#E7EEE9] shrink-0">
              <div className="flex justify-between items-start gap-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-baseline gap-2">
                      {selectedCall.contact_name ? (
                        <>
                          <span className="text-slate-900">{selectedCall.contact_name}</span>
                          <span className="text-xs font-normal text-slate-500 font-mono">
                            ({getCallContactPhone(selectedCall) || "Unknown"})
                          </span>
                        </>
                      ) : (
                        <span className="font-mono">
                          {getCallContactPhone(selectedCall) || "Unknown"}
                        </span>
                      )}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setContactEditName(selectedCall.contact_name || "");
                        setContactEditOpen(true);
                      }}
                      className="mb-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                      title="Rename caller permanently"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit name
                    </button>
                  </div>
                  <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
                    <span
                      className={`uppercase text-[10px] tracking-wider font-bold border px-2 py-1 rounded-full ${selectedCall.direction === "outbound" ? "text-blue-700 border-blue-200 bg-blue-50" : "text-emerald-700 border-emerald-200 bg-emerald-50"}`}
                    >
                      {selectedCall.direction === "outbound"
                        ? "Outbound"
                        : "Inbound"}
                    </span>
                    <span>&bull;</span>
                    <span className="capitalize">
                      {selectedCall.status === "completed"
                        ? "Completed"
                        : (selectedCall.status || "Active").replace("-", " ")}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">
                    {selectedCall.created_at
                      ? format(new Date(selectedCall.created_at), "dd MMM yyyy")
                      : selectedCall.started_at
                        ? format(
                          new Date(selectedCall.started_at),
                          "dd MMM yyyy",
                        )
                        : "-"}
                  </p>
                  <p className="text-sm text-slate-500 font-medium">
                    {selectedCall.created_at
                      ? format(new Date(selectedCall.created_at), "hh:mm:ss a")
                      : selectedCall.started_at
                        ? format(
                          new Date(selectedCall.started_at),
                          "hh:mm:ss a",
                        )
                        : "-"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Duration
                  </p>
                  <p className="text-sm font-semibold mt-1 text-slate-700">
                    {formatSecs(selectedCall.duration_seconds)}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Channel
                  </p>
                  <p className="text-xs font-semibold mt-1 text-slate-700 font-mono truncate">
                    {channel.phone_number || channel.name || "N/A"}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    From (Caller)
                  </p>
                  <p className="text-xs font-semibold mt-1 text-slate-700 font-mono truncate" title={selectedCall.contact_name && selectedCall.direction !== "outbound" ? `${selectedCall.contact_name} (${selectedCall.from_phone || selectedCall.caller_phone || "N/A"})` : undefined}>
                    {selectedCall.contact_name && selectedCall.direction !== "outbound" ? (
                      <span>
                        <span className="font-sans font-bold text-slate-900">{selectedCall.contact_name}</span>{" "}
                        <span className="text-slate-500 text-[11px]">({selectedCall.from_phone || selectedCall.caller_phone || "N/A"})</span>
                      </span>
                    ) : (
                      selectedCall.from_phone || selectedCall.caller_phone || "N/A"
                    )}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    To (Recipient)
                  </p>
                  <p className="text-xs font-semibold mt-1 text-slate-700 font-mono truncate" title={selectedCall.contact_name && selectedCall.direction === "outbound" ? `${selectedCall.contact_name} (${selectedCall.to_phone || selectedCall.destination_phone || selectedCall.caller_to || "N/A"})` : undefined}>
                    {selectedCall.contact_name && selectedCall.direction === "outbound" ? (
                      <span>
                        <span className="font-sans font-bold text-slate-900">{selectedCall.contact_name}</span>{" "}
                        <span className="text-slate-500 text-[11px]">({selectedCall.to_phone || selectedCall.destination_phone || selectedCall.caller_to || "N/A"})</span>
                      </span>
                    ) : (
                      selectedCall.to_phone || selectedCall.destination_phone || selectedCall.caller_to || "N/A"
                    )}
                  </p>
                </div>
                {selectedCall.ended_at && (
                  <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      Ended At
                    </p>
                    <p className="text-xs font-semibold mt-1 text-slate-700">
                      {format(new Date(selectedCall.ended_at), "hh:mm:ss a")}
                    </p>
                  </div>
                )}
                {selectedCall.failure_reason && (
                  <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 col-span-2">
                    <p className="text-[10px] text-rose-500 uppercase font-bold tracking-wider">
                      Provider result
                    </p>
                    <p className="text-xs font-semibold mt-1 text-rose-700">
                      {selectedCall.failure_reason}
                    </p>
                  </div>
                )}
                <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Turns
                  </p>
                  <p className="text-xs font-semibold mt-1 text-slate-700">
                    {selectedCall.turn_count || 0}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#E4ECE6] col-span-2">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Media Availability
                  </p>
                  <p className="text-xs font-semibold mt-1 flex gap-2">
                    {selectedCall.recording_url ? (
                      <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                        Recording Available
                      </span>
                    ) : (
                      <span className="text-slate-400 border border-slate-100 px-2 py-0.5 rounded bg-white">
                        No Recording
                      </span>
                    )}
                    {callMessages?.length > 0 ? (
                      <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                        Transcript Available
                      </span>
                    ) : (
                      <span className="text-slate-400 border border-slate-100 px-2 py-0.5 rounded bg-white">
                        No Transcript
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {selectedCall.recording_url ? (
              <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center">
                  <Voicemail className="w-4 h-4 mr-1.5 text-blue-600" /> Call
                  Recording
                </h4>
                {recordingToken ? (
                  <CustomAudioPlayer
                    src={`${API_BASE_URL}/admin/conversations/${companyId}/${selectedCall.id || selectedCall._id}/recording?token=${recordingToken}`}
                  />
                ) : (
                  <div className="animate-pulse bg-slate-200 h-10 w-full rounded-md"></div>
                )}
              </div>
            ) : (
              <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50 shrink-0">
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                  <Voicemail className="w-4 h-4 mr-1.5 text-slate-400" /> Call
                  Recording
                </h4>
                <p className="text-xs text-slate-400">
                  Recording unavailable for this call.
                </p>
              </div>
            )}

            <div className="p-6 md:p-8 flex-1 bg-slate-50/30 flex flex-col">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center justify-center border-b border-slate-100 pb-4 shrink-0">
                <MessageSquare className="w-4 h-4 mr-1.5" /> Full Transcript
              </h4>
              <div className="w-full max-w-[720px] mx-auto px-4 md:px-6 space-y-6 pb-12 flex-1">
                {callMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 opacity-70">
                    <MessageSquare className="w-8 h-8 text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500 italic text-center">
                      No transcript available for this call.
                    </p>
                  </div>
                ) : (
                  callMessages.map((msg, i) => {
                    const timeStr =
                      msg.timestamp || msg.created_at
                        ? format(
                          new Date(msg.timestamp || msg.created_at),
                          "hh:mm:ss a",
                        )
                        : "";
                    return (
                      <div
                        key={i}
                        className={`flex flex-col ${msg.role === "assistant" ? "items-start" : "items-end"}`}
                      >
                        <p
                          className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1 ${msg.role === "assistant" ? "text-indigo-600" : "text-slate-500"}`}
                        >
                          {msg.role === "assistant"
                            ? selectedCall?.agent_id
                              ? agentsMap[selectedCall.agent_id] ||
                              agentName ||
                              "AI AGENT"
                              : agentName || "AI AGENT"
                            : "CUSTOMER"}
                        </p>
                        <div
                          className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm text-sm border overflow-hidden break-words ${msg.role === "assistant" ? "bg-white border-slate-200 text-slate-800 rounded-tl-sm" : "bg-slate-900 border-slate-800 text-white rounded-tr-sm"}`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content || msg.text}
                          </p>
                        </div>
                        {timeStr && (
                          <span className="text-[9px] font-medium text-slate-400 mt-1.5 px-1">
                            {timeStr}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* PERMANENT CALLER NAME EDITOR */}
      <Modal
        open={contactEditOpen}
        onClose={() => setContactEditOpen(false)}
        title="Rename caller"
        description={`Ye naam is number ki live calls, history aur future calls me dikhega: ${getCallContactPhone(selectedCall) || "Unknown number"}`}
      >
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Caller name</label>
            <input
              autoFocus
              value={contactEditName}
              onChange={(event) => setContactEditName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveSelectedCallerName();
              }}
              placeholder="e.g. Farhan Kureshi"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setContactEditOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={contactEditSaving || !contactEditName.trim()}
              onClick={() => void saveSelectedCallerName()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {contactEditSaving ? "Saving…" : "Save name"}
            </button>
          </div>
        </div>
      </Modal>

      {/* LIVE CALL MONITOR */}
      {isMonitorOpen && activeCallId && (
        <LiveCallMonitor
          callSid={activeCallId}
          contactName={contactName || destNumber}
          onClose={() => {
            setIsMonitorOpen(false);
            setActiveCallId(null);
          }}
        />
      )}

      {/* QUICK EDIT CHANNEL MODAL */}
      <Modal
        open={isEditChannelModalOpen}
        onClose={() => setIsEditChannelModalOpen(false)}
        title="Edit Channel Configuration"
        description="Update channel name, assigned phone number, agent persona, and operational status."
      >
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Channel Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => updateForm("name", e.target.value)}
              placeholder="e.g. Exotel Voice - ZeniaOne2"
              className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Phone Number</label>
            <input
              type="text"
              value={editForm.phone_number}
              onChange={(e) => updateForm("phone_number", e.target.value)}
              placeholder="e.g. 919513886363"
              className="w-full px-3 py-2 text-sm font-mono font-semibold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">Assigned Agent</label>
            <select
              value={editForm.agent_id}
              onChange={(e) => updateForm("agent_id", e.target.value)}
              className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              {Object.keys(agentsData).map((id) => (
                <option key={id} value={id}>
                  {agentsData[id]?.name || id}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-bold text-slate-700">Channel Status</span>
            <button
              type="button"
              onClick={() => updateForm("is_active", !editForm.is_active)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition ${editForm.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
            >
              {editForm.is_active ? "Active" : "Inactive"}
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEditChannelModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-xl border border-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || !editForm.name.trim()}
              onClick={async () => {
                await handleSaveConfig();
                setIsEditChannelModalOpen(false);
              }}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? "Savingâ€¦" : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
