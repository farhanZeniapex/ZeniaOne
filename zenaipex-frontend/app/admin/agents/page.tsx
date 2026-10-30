"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { API_BASE_URL, fetchApi, getCompanyLogoUrl } from "@/lib/api/client";
import {
  VOICES,
  Voice,
  getVoiceById,
  getVoiceAcoustics,
  findBrowserVoice,
} from "@/lib/data/voices";
import { formatSystemDateTime } from "@/lib/utils";
import {
  Phone,
  Search,
  Filter,
  Play,
  Square,
  Loader2,
  Check,
  ChevronDown,
  ChevronRight,
  Users,
  Building2,
  Sparkles,
  CheckCircle2,
  Bot,
  Layers,
  Mic,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Sliders,
  Cpu,
  Activity,
  Settings2,
  X,
  Globe,
  Radio,
  ExternalLink,
  HelpCircle,
  StopCircle,
  Calendar,
  Download,
  AlertTriangle,
  Pause,
  MoreVertical,
  Edit3,
  Pin,
  Trash2,
  Archive,
  LayoutGrid,
  List,
  Plus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoiceCloningStudio } from "@/components/VoiceCloningStudio";
import { SmartSelect } from "@/components/ui/smart-select";
import { Toast } from "@/components/ui/toast";
import org from "../organization.module.css";

function assignedAgentsForVoice<T extends { tts_voice?: string }>(
  agents: T[],
  voice: { id?: string; voice_id?: string; name?: string },
): T[] {
  const voiceKeys = (
    [voice.id, voice.voice_id, voice.name].filter(Boolean) as string[]
  ).map((value: string) => value.toLowerCase());
  return agents.filter((agent) =>
    voiceKeys.includes((agent.tts_voice || "").toLowerCase()),
  );
}

const VOICE_RUNTIME_MODES = [
  {
    value: "gemini_clone",
    shortLabel: "Gemini + Clone",
    label: "Gemini Live STT + Gemini Brain + Clone Voice",
    detail:
      "Gemini interprets the request, Google Gemini generates the answer, and the selected cloned voice speaks it.",
    badge: "Recommended",
    tone: "blue",
  },
  {
    value: "pipeline",
    shortLabel: "Classic Pipeline",
    label: "Deepgram STT + Groq + Selected Voice",
    detail:
      "The stable voice flow uses the configured provider-routing fallbacks.",
    badge: "Stable fallback",
    tone: "emerald",
  },
  {
    value: "gemini_live",
    shortLabel: "Gemini Live S2S",
    label: "Gemini Native Voice-to-Voice",
    detail:
      "The fastest native Gemini audio mode; the selected cloned voice is not used here.",
    badge: "Fast demo",
    tone: "violet",
  },
] as const;

const GEMINI_VOICES = [
  ["Zephyr", "Bright"],
  ["Puck", "Upbeat"],
  ["Charon", "Informative"],
  ["Kore", "Firm"],
  ["Fenrir", "Excitable"],
  ["Leda", "Youthful"],
  ["Orus", "Firm"],
  ["Aoede", "Breezy"],
  ["Callirrhoe", "Easy-going"],
  ["Autonoe", "Bright"],
  ["Enceladus", "Breathy"],
  ["Iapetus", "Clear"],
  ["Umbriel", "Easy-going"],
  ["Algieba", "Smooth"],
  ["Despina", "Smooth"],
  ["Erinome", "Clear"],
  ["Algenib", "Gravelly"],
  ["Rasalgethi", "Informative"],
  ["Laomedeia", "Upbeat"],
  ["Achernar", "Soft"],
  ["Alnilam", "Firm"],
  ["Schedar", "Even"],
  ["Gacrux", "Mature"],
  ["Pulcherrima", "Forward"],
  ["Achird", "Friendly"],
  ["Zubenelgenubi", "Casual"],
  ["Vindemiatrix", "Gentle"],
  ["Sadachbia", "Lively"],
  ["Sadaltager", "Knowledgeable"],
  ["Sulafat", "Warm"],
].map(([name, tone]) => ({
  id: name.toLowerCase(),
  name,
  tone,
  description: `Gemini Live native voice with a ${tone.toLowerCase()} delivery.`,
}));

function CompanyLogo({
  companyId,
  companyName,
  logoReference,
}: {
  companyId: string;
  companyName: string;
  logoReference?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [logoReference]);
  // Do not request a placeholder logo for companies that have no logo. The
  // old "current" fallback generated repeated 404s while the admin list was
  // loading and for companies that legitimately have no uploaded logo.
  const logoUrl = logoReference
    ? getCompanyLogoUrl(companyId, logoReference)
    : undefined;

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="h-5 w-5 rounded-md object-contain"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="text-[11px] font-extrabold uppercase tracking-tight">
      {companyName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")}
    </span>
  );
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [companyLogoById, setCompanyLogoById] = useState<
    Record<string, string | undefined>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "workforce" | "voices" | "gemini_voices" | "custom_voices"
  >("workforce");
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [voiceFilter, setVoiceFilter] = useState("active");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "Male" | "Female">(
    "all",
  );
  const [compareVoices, setCompareVoices] = useState<[string, string]>([
    VOICES[0].id,
    VOICES[1].id,
  ]);
  const [quickFilter, setQuickFilter] = useState<
    "all" | "male" | "female" | "internal"
  >("all");

  // Voice Preview State
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(
    null,
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Custom Voice Testing State
  const [testingCustomVoiceId, setTestingCustomVoiceId] = useState<
    string | null
  >(null);
  const [isGeneratingVoiceId, setIsGeneratingVoiceId] = useState<string | null>(
    null,
  );
  const [testLanguage, setTestLanguage] = useState<Record<string, string>>({});
  const [testText, setTestText] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});
  const [playbackRate, setPlaybackRate] = useState<Record<string, number>>({});
  const [fallbackProgress, setFallbackProgress] = useState<
    Record<string, number>
  >({});
  const [testAudioSrc, setTestAudioSrc] = useState<Record<string, string>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<
    Record<
      string,
      { speed?: number; volume?: number; clarity?: number; stability?: number }
    >
  >({});
  const [sliderSaveStatus, setSliderSaveStatus] = useState<
    Record<string, boolean>
  >({});
  // Live Real-Time Web Audio Context and Gain Nodes for Instant Feedback
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodesRef = useRef<Record<string, GainNode>>({});
  const audioSourcesRef = useRef<Record<string, MediaElementAudioSourceNode>>(
    {},
  );
  const previewAudioCacheRef = useRef<Record<string, string>>({});
  const previewGainNodeRef = useRef<GainNode | null>(null);
  const previewSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [isLivePlaying, setIsLivePlaying] = useState<Record<string, boolean>>(
    {},
  );
  const [isAudioLiveTuned, setIsAudioLiveTuned] = useState<
    Record<string, boolean>
  >({});

  // Updating voice state
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Slide-over Drawer for Editing Agent
  const [selectedAgentForEdit, setSelectedAgentForEdit] = useState<any | null>(
    null,
  );
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    tts_voice: "",
    llm_model: "sarvam-105b",
    voice_engine: "pipeline",
    status: "active",
    default_language: "en-IN",
  });

  // Fallback player smooth progress simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setFallbackProgress((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.keys(isPlaying).forEach((id) => {
          if (isPlaying[id]) {
            // Assume 6 seconds total (6000ms). Add 100ms each tick (1.66% per tick)
            const current = next[id] || 0;
            if (current < 100) {
              next[id] = Math.min(100, current + 1.66);
              changed = true;
            }
          } else if (next[id] > 0) {
            // Snap to 0 when not playing
            next[id] = 0;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Load Agents
  async function loadAgents() {
    setIsLoading(true);
    try {
      const data = await fetchApi<any>("/admin/agents");
      setAgents(data.agents || []);
      try {
        const companyData = await fetchApi<any>("/admin/companies");
        setCompanyLogoById(
          Object.fromEntries(
            (companyData.companies || []).map((company: any) => [
              company.id,
              company.logo_url,
            ]),
          ),
        );
      } catch {
        setCompanyLogoById({});
      }
    } catch (err) {
      console.error("Failed to load platform agents", err);
    } finally {
      setIsLoading(false);
    }
  }

  const [customVoices, setCustomVoices] = useState<any[]>([]);

  const platformVoices = useMemo(() => {
    return [
      ...VOICES,
      ...customVoices.map((cv) => ({
        id: cv.voice_id || cv.id,
        name: cv.name,
        gender: cv.gender || "Female",
        provider: "Sarvam Cloned",
        enabled: true,
        sampleText:
          cv.sample_text || "Hello! This is a sample of my cloned voice.",
        isCustom: true,
        tone: "Cloned Voice",
        description: cv.description || "Custom cloned voice",
      })),
      ...GEMINI_VOICES.map((voice) => ({
        id: voice.id,
        name: voice.name,
        gender: "Female" as const,
        provider: "Google Gemini Live",
        enabled: true,
        sampleText: `Hello, this is ${voice.name}, a ${voice.tone.toLowerCase()} Gemini Live voice.`,
        tone: voice.tone,
        description: voice.description,
        isGemini: true,
      })),
    ];
  }, [customVoices]);

  async function loadCustomVoices() {
    try {
      // In the admin dashboard, we can just query all or a specific company.
      // Assuming 'admin_workspace' is the company for platform admins, or using fetchApi directly.
      let compId =
        localStorage.getItem("zenaipex_active_company_id") || "admin_workspace";
      if (compId === "default") compId = "admin_workspace";
      const data = await fetchApi(`/companies/${compId}/voices`);
      if (data.voices) {
        const sorted = data.voices.sort((a: any, b: any) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return (
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime()
          );
        });
        setCustomVoices(sorted);
        // Hydrate slider calibration settings directly from MongoDB database
        setVoiceSettings((prev) => {
          const loaded: Record<
            string,
            {
              speed?: number;
              volume?: number;
              clarity?: number;
              stability?: number;
            }
          > = { ...prev };
          sorted.forEach((v: any) => {
            loaded[v.id] = {
              speed:
                typeof v.speed === "number"
                  ? v.speed
                  : (loaded[v.id]?.speed ?? 1.15),
              volume:
                typeof v.volume === "number"
                  ? v.volume
                  : (loaded[v.id]?.volume ?? 1.35),
              clarity:
                typeof v.clarity === "number"
                  ? v.clarity
                  : (loaded[v.id]?.clarity ?? 94),
              stability:
                typeof v.stability === "number"
                  ? v.stability
                  : (loaded[v.id]?.stability ?? 85),
            };
            if (v.voice_id && v.voice_id !== v.id) {
              loaded[v.voice_id] = loaded[v.id];
            }
          });
          try {
            localStorage.setItem(
              "zenaipex_voice_settings",
              JSON.stringify(loaded),
            );
          } catch (e) {}
          return loaded;
        });

        // Cross-link previews from localStorage into previewAudioCacheRef for instant Agent Listen Voice playback
        try {
          const previewsRaw = localStorage.getItem("zenaipex_voice_previews");
          if (previewsRaw) {
            const previews = JSON.parse(previewsRaw);
            sorted.forEach((v: any) => {
              const b64 =
                previews[v.id] ||
                previews[v.voice_id] ||
                (v.name ? previews[v.name.toLowerCase()] : "");
              if (b64) {
                previewAudioCacheRef.current[v.id] = b64;
                if (v.voice_id) previewAudioCacheRef.current[v.voice_id] = b64;
                if (v.name)
                  previewAudioCacheRef.current[v.name.toLowerCase()] = b64;
              }
            });
          }
        } catch (e) {}
        if (sorted.length > 0) {
          const savedId = localStorage.getItem("zenaipex_selected_voice_id");
          if (savedId && sorted.find((v: any) => v.id === savedId)) {
            setSelectedVoiceId(savedId);
          } else {
            setSelectedVoiceId(sorted[0].id);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (selectedVoiceId) {
      localStorage.setItem("zenaipex_selected_voice_id", selectedVoiceId);
    }
  }, [selectedVoiceId]);

  useEffect(() => {
    loadAgents();
    loadCustomVoices();
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

  const filteredVoices = useMemo(() => {
    let result = customVoices
      .filter((v) => {
        if (voiceFilter === "active") return !v.is_archived;
        if (voiceFilter === "archived") return !!v.is_archived;
        return true;
      })
      .filter(
        (v) =>
          search === "" || v.name?.toLowerCase().includes(search.toLowerCase()),
      );

    if (sortBy === "newest") {
      result = result.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
    } else if (sortBy === "oldest") {
      result = result.sort(
        (a, b) =>
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime(),
      );
    } else if (sortBy === "az") {
      result = result.sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      );
    }

    return result;
  }, [customVoices, voiceFilter, search, sortBy]);

  // Voice Preview Play / Stop Handler with Calibrated Speed, Volume Boost & Instant Zero-Lag Playback
  const handlePlayVoicePreview = async (voice: Voice, agentObj?: any) => {
    if (previewingVoiceId === voice.id) {
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

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setPreviewingVoiceId(voice.id);

    // Resolve accurate calibrated speed and volume across voice doc, agents, and live slider settings
    const relatedVoice = customVoices.find(
      (v) =>
        v.id === voice.id ||
        v.voice_id === voice.id ||
        (v.name &&
          voice.name &&
          v.name.toLowerCase() === voice.name.toLowerCase()) ||
        (agentObj?.tts_voice &&
          (v.id === agentObj.tts_voice ||
            v.voice_id === agentObj.tts_voice ||
            (v.name &&
              v.name.toLowerCase() === agentObj.tts_voice.toLowerCase()))),
    );

    const voiceSetting =
      voiceSettings[voice.id] ||
      (relatedVoice?.id ? voiceSettings[relatedVoice.id] : undefined) ||
      (relatedVoice?.voice_id
        ? voiceSettings[relatedVoice.voice_id]
        : undefined) ||
      (agentObj?.tts_voice ? voiceSettings[agentObj.tts_voice] : undefined) ||
      {};

    // Priority to latest slider tuning from voiceSetting!
    const targetSpeed =
      voiceSetting.speed ??
      agentObj?.voice_speed ??
      relatedVoice?.speed ??
      1.15;
    const targetVolume =
      voiceSetting.volume ??
      agentObj?.voice_volume ??
      relatedVoice?.volume ??
      1.35;

    const playAudioElement = (audioDataB64: string) => {
      const isWav = audioDataB64.startsWith("UklG");
      const mimeType = isWav ? "audio/wav" : "audio/mp3";
      const audio = new Audio(`data:${mimeType};base64,${audioDataB64}`);

      const enforceSpeed = () => {
        try {
          audio.playbackRate = targetSpeed;
        } catch (e) {}
      };
      enforceSpeed();
      audio.onloadedmetadata = enforceSpeed;
      audio.onplay = enforceSpeed;
      audio.oncanplay = enforceSpeed;

      try {
        const AudioCtx =
          window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!audioContextRef.current) {
            audioContextRef.current = new AudioCtx();
          }
          const ctx = audioContextRef.current;
          if (ctx.state === "suspended") {
            ctx.resume();
          }
          const source = ctx.createMediaElementSource(audio);
          const gainNode = ctx.createGain();
          gainNode.gain.value = targetVolume;
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          previewGainNodeRef.current = gainNode;
          previewSourceRef.current = source;
        } else {
          audio.volume = Math.min(1.0, targetVolume / 2.0);
        }
      } catch (gainErr) {
        audio.volume = Math.min(1.0, targetVolume / 2.0);
      }

      previewAudioRef.current = audio;
      audio.onended = () => {
        setPreviewingVoiceId(null);
        previewAudioRef.current = null;
      };
      audio.onerror = () => fallbackBrowser();
      audio.play().catch((e) => {
        console.warn("Audio play blocked or error", e);
        fallbackBrowser();
      });
      setIsPreviewLoading(false);
    };

    const fallbackBrowser = () => {
      setIsPreviewLoading(false);
      // Browser speech synthesis never represents a cloned voice.  Showing it
      // as a fallback here would make the selected clone sound successful even
      // when its provider preview failed.
      const isCustomClone = customVoices.some((customVoice) =>
        [customVoice.id, customVoice.voice_id]
          .filter(Boolean)
          .includes(voice.id),
      );
      if (isCustomClone) {
        setPreviewingVoiceId(null);
        setPreviewError(
          "Clone preview is unavailable. The selected clone was not played.",
        );
        window.setTimeout(() => setPreviewError(null), 5000);
        return;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const acoustics = getVoiceAcoustics(voice.id);
        const utterance = new SpeechSynthesisUtterance(voice.sampleText);
        utterance.lang = "en-IN";
        utterance.rate = Math.max(0.7, Math.min(2.0, targetSpeed));
        utterance.volume = Math.min(1.0, Math.max(0.1, targetVolume / 2.0));
        utterance.pitch = acoustics.pitch;

        const synthVoices = window.speechSynthesis.getVoices();
        const match = findBrowserVoice(
          synthVoices,
          acoustics.isMale,
          "en-IN",
          voice.sampleText,
          voice.id,
        );
        if (match) utterance.voice = match;

        utterance.onend = () => setPreviewingVoiceId(null);
        utterance.onerror = () => setPreviewingVoiceId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setPreviewingVoiceId(null);
      }
    };

    // INSTANT ZERO-LAG PLAYBACK: Check if audio is already available in cache, testAudioSrc, or localStorage
    let cachedB64 =
      previewAudioCacheRef.current[voice.id] ||
      (relatedVoice?.id ? previewAudioCacheRef.current[relatedVoice.id] : "") ||
      (relatedVoice?.voice_id
        ? previewAudioCacheRef.current[relatedVoice.voice_id]
        : "") ||
      (agentObj?.tts_voice
        ? previewAudioCacheRef.current[agentObj.tts_voice]
        : "") ||
      testAudioSrc[voice.id] ||
      (relatedVoice?.id ? testAudioSrc[relatedVoice.id] : "") ||
      (relatedVoice?.voice_id ? testAudioSrc[relatedVoice.voice_id] : "") ||
      (agentObj?.tts_voice ? testAudioSrc[agentObj.tts_voice] : "");

    if (!cachedB64) {
      try {
        const savedPreviews = JSON.parse(
          localStorage.getItem("zenaipex_voice_previews") || "{}",
        );
        cachedB64 =
          savedPreviews[voice.id] ||
          (relatedVoice?.id ? savedPreviews[relatedVoice.id] : "") ||
          (relatedVoice?.voice_id
            ? savedPreviews[relatedVoice.voice_id]
            : "") ||
          (agentObj?.tts_voice ? savedPreviews[agentObj.tts_voice] : "");
        if (cachedB64) {
          previewAudioCacheRef.current[voice.id] = cachedB64;
          if (relatedVoice?.id)
            previewAudioCacheRef.current[relatedVoice.id] = cachedB64;
          if (relatedVoice?.voice_id)
            previewAudioCacheRef.current[relatedVoice.voice_id] = cachedB64;
          if (agentObj?.tts_voice)
            previewAudioCacheRef.current[agentObj.tts_voice] = cachedB64;
        }
      } catch (e) {}
    }

    if (cachedB64) {
      console.log(
        `[VOICE_PREVIEW] Instant zero-lag playback for ${voice.name || voice.id} at ${targetSpeed}x, ${targetVolume * 100}% vol`,
      );
      playAudioElement(cachedB64);
      return;
    }

    setIsPreviewLoading(true);
    try {
      const res = await fetchApi<any>("/admin/agents/preview-voice", {
        method: "POST",
        body: JSON.stringify({
          voice: voice.id,
          text: voice.sampleText,
          language: "en-IN",
          speed: targetSpeed,
          volume: targetVolume,
          agent_id: agentObj?.id,
        }),
      });

      if (res && res.audio_base64 && !res.fallback_tts) {
        previewAudioCacheRef.current[voice.id] = res.audio_base64;
        if (relatedVoice?.id)
          previewAudioCacheRef.current[relatedVoice.id] = res.audio_base64;
        if (relatedVoice?.voice_id)
          previewAudioCacheRef.current[relatedVoice.voice_id] =
            res.audio_base64;
        if (agentObj?.tts_voice)
          previewAudioCacheRef.current[agentObj.tts_voice] = res.audio_base64;
        updateTestAudioSrc(
          voice.id,
          res.audio_base64,
          [
            relatedVoice?.id,
            relatedVoice?.voice_id,
            agentObj?.tts_voice,
          ].filter(Boolean) as string[],
        );
        playAudioElement(res.audio_base64);
      } else {
        fallbackBrowser();
      }
    } catch (err) {
      console.warn(
        "Backend voice preview error, using browser synthesis fallback",
        err,
      );
      fallbackBrowser();
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("zenaipex_voice_previews");
      if (saved) {
        const parsed = JSON.parse(saved);
        setTestAudioSrc(parsed);
        Object.entries(parsed).forEach(([k, v]) => {
          if (typeof v === "string") {
            previewAudioCacheRef.current[k] = v;
          }
        });
      }
      const savedSettings = localStorage.getItem("zenaipex_voice_settings");
      if (savedSettings) {
        setVoiceSettings(JSON.parse(savedSettings));
      }
    } catch (e) {
      console.warn("Could not load cached previews or settings", e);
    }
  }, []);

  const updateTestAudioSrc = (
    id: string,
    b64: string,
    extraKeys: string[] = [],
  ) => {
    previewAudioCacheRef.current[id] = b64;
    extraKeys.forEach((k) => {
      if (k) previewAudioCacheRef.current[k] = b64;
    });
    setTestAudioSrc((prev) => {
      const next = { ...prev, [id]: b64 };
      extraKeys.forEach((k) => {
        if (k) next[k] = b64;
      });
      try {
        localStorage.setItem("zenaipex_voice_previews", JSON.stringify(next));
      } catch (e) {
        console.warn("Could not save preview to cache", e);
      }
      return next;
    });
  };

  // Instant Audible Feedback Trigger on Slider Release
  const triggerInstantAudioPreview = (voiceId: string) => {
    const audioEl = document.getElementById(
      `audio-panel-${voiceId}`,
    ) as HTMLAudioElement;
    const curSettings = voiceSettings[voiceId] || {};
    const spd = curSettings.speed ?? 1.15;
    const vol = curSettings.volume ?? 1.35;

    if (audioEl) {
      audioEl.playbackRate = spd;
      if (gainNodesRef.current[voiceId]) {
        gainNodesRef.current[voiceId].gain.value = vol;
      }
      audioEl.currentTime = 0;
      audioEl
        .play()
        .catch((e) => console.warn("Instant preview play error", e));
      setIsLivePlaying((p) => ({ ...p, [voiceId]: true }));
    }
  };

  const handleTestCustomVoice = async (
    voice: any,
    languageOverride?: string,
    forceRegenerate?: boolean,
  ) => {
    const voiceId = voice.id;
    const apiVoiceId = voice.voice_id || voice.id;
    setTestingCustomVoiceId(voiceId);

    const lang = languageOverride || testLanguage[voiceId] || "en-IN";
    const sampleTexts: Record<string, string> = {
      "en-IN":
        "Hello! I am your AI assistant. This is how my voice sounds in English.",
      "hi-IN":
        "नमस्ते! मैं आपका एआई असिस्टेंट हूँ। हिंदी में मेरी आवाज़ ऐसी लगती है।",
      "gu-IN":
        "નમસ્તે! હું તમારો એઆઈ આસિસ્ટન્ટ છું. ગુજરાતીમાં મારો અવાજ આવો સંભળાય છે.",
    };
    const textToSpeak =
      testText[voiceId] && testText[voiceId].trim() !== ""
        ? testText[voiceId]
        : sampleTexts[lang] || sampleTexts["en-IN"];

    const currentVoiceSettings = voiceSettings[voiceId] || {
      speed: 1.15,
      volume: 1.35,
      clarity: 94,
      stability: 85,
    };
    const curSpd = currentVoiceSettings.speed || 1.15;
    const curVol = currentVoiceSettings.volume || 1.35;

    // INSTANT ZERO-LAG PLAYBACK: If audio already exists and not forced to regenerate, play immediately at calibrated speed and volume!
    const audioEl = document.getElementById(
      `audio-panel-${voiceId}`,
    ) as HTMLAudioElement;
    if (!forceRegenerate && testAudioSrc[voiceId] && audioEl) {
      console.log(
        `[VOICE_STUDIO] Instant zero-lag play for ${voice.name || voiceId} at ${curSpd}x, ${curVol * 100}% vol`,
      );
      audioEl.playbackRate = curSpd;
      if (gainNodesRef.current[voiceId]) {
        gainNodesRef.current[voiceId].gain.value = curVol;
      }
      audioEl.currentTime = 0;
      audioEl.onended = () => {
        setTestingCustomVoiceId(null);
        setIsGeneratingVoiceId(null);
      };
      setTestingCustomVoiceId(voiceId);
      setIsGeneratingVoiceId(null);
      audioEl.play().catch((e) => {
        console.warn("Instant play failed", e);
        setTestingCustomVoiceId(null);
      });
      return;
    }

    setIsGeneratingVoiceId(voiceId);

    try {
      const companyId = "admin_workspace";
      const token = localStorage.getItem("zenaipex_token");
      const formData = new FormData();
      formData.append("voice_id", apiVoiceId);
      formData.append("text", textToSpeak);

      formData.append("speed", (curSpd || 1.0).toString());
      formData.append("volume", (curVol || 1.0).toString());

      const res = await fetch(
        `${API_BASE_URL}/companies/${companyId}/voices/test`,
        {
          method: "POST",
          body: formData,
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const data = await res.json();
      setIsGeneratingVoiceId(null);

      // Play real synthesized & tuned audio
      if (data.audio_b64) {
        updateTestAudioSrc(voiceId, data.audio_b64);
        // Also populate preview audio cache for instant agent Listen Voice clicks
        previewAudioCacheRef.current[voiceId] = data.audio_b64;
        if (apiVoiceId)
          previewAudioCacheRef.current[apiVoiceId] = data.audio_b64;

        setTimeout(() => {
          const el = document.getElementById(
            `audio-panel-${voiceId}`,
          ) as HTMLAudioElement;
          if (el) {
            el.playbackRate = curSpd;
            el.onended = () => setTestingCustomVoiceId(null);
            el.play().catch((e) => {
              console.error("Auto-play failed", e);
              setTestingCustomVoiceId(null);
            });
          } else {
            setTestingCustomVoiceId(null);
          }
        }, 100);
      } else if (!res.ok) {
        throw new Error("API failed");
      } else {
        setTestingCustomVoiceId(null);
        setIsGeneratingVoiceId(null);
      }
    } catch (e) {
      console.error("Test voice API error:", e);
      setTestingCustomVoiceId(null);
      setIsGeneratingVoiceId(null);
      setPreviewError("Error generating test audio.");
    }
  };

  // Synchronized Multi-Parameter Slider Handler (Saves to MongoDB Backend & LocalStorage & Syncs All Assigned Agents)
  const handleVoiceParamChange = async (
    voiceId: string,
    param: "speed" | "volume" | "clarity" | "stability",
    value: number,
  ) => {
    // 1. Immediately update React state for ultra-responsive feel
    const relatedVoice = customVoices.find(
      (v) =>
        v.id === voiceId ||
        v.voice_id === voiceId ||
        (v.name && v.name.toLowerCase() === voiceId.toLowerCase()),
    );
    setVoiceSettings((prev) => {
      const cur = prev[voiceId] || {
        speed: 1.15,
        volume: 1.35,
        clarity: 94,
        stability: 85,
      };
      const nextSettings = { ...prev, [voiceId]: { ...cur, [param]: value } };
      if (relatedVoice) {
        if (relatedVoice.id)
          nextSettings[relatedVoice.id] = {
            ...(prev[relatedVoice.id] || cur),
            [param]: value,
          };
        if (relatedVoice.voice_id)
          nextSettings[relatedVoice.voice_id] = {
            ...(prev[relatedVoice.voice_id] || cur),
            [param]: value,
          };
      }
      try {
        localStorage.setItem(
          "zenaipex_voice_settings",
          JSON.stringify(nextSettings),
        );
      } catch (e) {}
      return nextSettings;
    });

    // 2. Update customVoices state in memory
    setCustomVoices((prev) =>
      prev.map((v) =>
        v.id === voiceId || v.voice_id === voiceId
          ? { ...v, [param]: value }
          : v,
      ),
    );

    // 3. LIVE REAL-TIME AUDIO FEEDBACK: Immediately alter active audio playback & volume
    try {
      // 3a. If Agent "Listen Voice" preview is currently playing, update in real-time!
      if (previewAudioRef.current) {
        if (param === "speed") {
          previewAudioRef.current.playbackRate = value;
          console.log(
            `[VOICE_LIVE] Instant speed shift for Listen Voice: ${value}x`,
          );
        } else if (param === "volume") {
          if (previewGainNodeRef.current) {
            previewGainNodeRef.current.gain.value = value;
          } else {
            previewAudioRef.current.volume = Math.min(1.0, value / 2.0);
          }
          console.log(
            `[VOICE_LIVE] Instant volume shift for Listen Voice: ${value * 100}%`,
          );
        }
      }

      // 3b. If Voice Studio audio element is present, update in real-time!
      const audioEl = document.getElementById(
        `audio-panel-${voiceId}`,
      ) as HTMLAudioElement;
      if (audioEl) {
        if (param === "speed") {
          audioEl.playbackRate = value;
          setPlaybackRate((p) => ({ ...p, [voiceId]: value }));
          setIsAudioLiveTuned((p) => ({ ...p, [voiceId]: true }));
        } else if (param === "volume") {
          if (!gainNodesRef.current[voiceId]) {
            try {
              const AudioCtx =
                window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                if (!audioContextRef.current) {
                  audioContextRef.current = new AudioCtx();
                }
                const ctx = audioContextRef.current;
                if (ctx.state === "suspended") {
                  ctx.resume();
                }
                const source = ctx.createMediaElementSource(audioEl);
                const gainNode = ctx.createGain();
                gainNode.gain.value = value;
                source.connect(gainNode);
                gainNode.connect(ctx.destination);
                gainNodesRef.current[voiceId] = gainNode;
                audioSourcesRef.current[voiceId] = source;
              }
            } catch (webAudioErr) {
              audioEl.volume = Math.min(1.0, value / 2.0);
            }
          } else {
            gainNodesRef.current[voiceId].gain.value = value;
          }
          setIsAudioLiveTuned((p) => ({ ...p, [voiceId]: true }));
        }
      }
    } catch (liveErr) {
      console.warn("Live audio tuning feedback error:", liveErr);
    }

    // 4. Update ALL assigned agents across the platform in memory and database!
    const matchingVoiceIds = new Set<string>();
    matchingVoiceIds.add(voiceId.toLowerCase());
    if (relatedVoice) {
      if (relatedVoice.id) matchingVoiceIds.add(relatedVoice.id.toLowerCase());
      if (relatedVoice.voice_id)
        matchingVoiceIds.add(relatedVoice.voice_id.toLowerCase());
      if (relatedVoice.name)
        matchingVoiceIds.add(relatedVoice.name.toLowerCase());
    }

    const assignedAgents = agents.filter(
      (a) => a.tts_voice && matchingVoiceIds.has(a.tts_voice.toLowerCase()),
    );

    const agentFieldMap: Record<string, string> = {
      speed: "voice_speed",
      volume: "voice_volume",
      clarity: "voice_clarity",
      stability: "voice_stability",
    };
    const agentField = agentFieldMap[param];

    if (assignedAgents.length > 0 && agentField) {
      console.log(
        `[VOICE_SYNC] Instantly updating ${assignedAgents.length} assigned agents (${assignedAgents.map((a) => a.name).join(", ")}) with ${agentField}=${value}`,
      );

      // Update React state immediately so Agent cards reflect new tuning without refresh!
      setAgents((prev) =>
        prev.map((a) =>
          assignedAgents.some((ag) => ag.id === a.id)
            ? { ...a, [agentField]: value }
            : a,
        ),
      );

      // Persist to backend
      for (const ag of assignedAgents) {
        fetchApi(`/admin/agents/${ag.id}`, {
          method: "PATCH",
          body: JSON.stringify({ [agentField]: value }),
        }).catch((err) =>
          console.error(`Failed to sync agent ${ag.name}:`, err),
        );
      }
    }

    // 5. Briefly pulse save confirmation badge
    setSliderSaveStatus((prev) => ({ ...prev, [voiceId]: true }));
    setTimeout(() => {
      setSliderSaveStatus((prev) => ({ ...prev, [voiceId]: false }));
    }, 1800);

    // 6. Persist to MongoDB backend custom_voices collection
    try {
      let compId =
        localStorage.getItem("zenaipex_active_company_id") || "admin_workspace";
      if (compId === "default") compId = "admin_workspace";

      await fetchApi(`/companies/${compId}/voices/${voiceId}`, {
        method: "PATCH",
        body: JSON.stringify({ [param]: value }),
      });
    } catch (err) {
      console.error("Failed to persist slider change to backend:", err);
    }
  };

  // Change Agent Voice Platform-Wide & Sync Calibration
  const handleUpdateVoice = async (agentId: string, newVoiceId: string) => {
    setUpdatingAgentId(agentId);
    try {
      const curVoiceSetting = voiceSettings[newVoiceId] || {};
      const speedVal = curVoiceSetting.speed ?? 1.15;
      const volumeVal = curVoiceSetting.volume ?? 1.35;
      const clarityVal = curVoiceSetting.clarity ?? 94;
      const stabilityVal = curVoiceSetting.stability ?? 85;

      await fetchApi(`/admin/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          tts_voice: newVoiceId.toLowerCase(),
          voice_speed: speedVal,
          voice_volume: volumeVal,
          voice_clarity: clarityVal,
          voice_stability: stabilityVal,
        }),
      });
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...a,
                tts_voice: newVoiceId,
                voice_speed: speedVal,
                voice_volume: volumeVal,
                voice_clarity: clarityVal,
                voice_stability: stabilityVal,
              }
            : a,
        ),
      );
      const voiceObj =
        platformVoices.find(
          (v) => v.id.toLowerCase() === newVoiceId.toLowerCase(),
        ) || getVoiceById(newVoiceId);
      const agentObj = agents.find((a) => a.id === agentId);
      setSuccessToast(
        `Assigned ${voiceObj?.name || "Voice"} to ${agentObj?.name || "Agent"}`,
      );
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setPreviewError(
        "Failed to update voice: " + (err.message || "Unknown error"),
      );
    } finally {
      setUpdatingAgentId(null);
    }
  };

  // Open Edit Drawer
  const openEditDrawer = (agent: any) => {
    setSelectedAgentForEdit(agent);
    setEditFormData({
      name: agent.name || "",
      description: agent.description || "",
      tts_voice: agent.tts_voice || "ritu",
      llm_model: agent.llm_model || "sarvam-105b",
      voice_engine: agent.voice_engine || "pipeline",
      status: agent.status || "active",
      default_language: agent.default_language || "en-IN",
    });
  };

  // Save Agent Details via Admin API
  const handleSaveAgentDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForEdit) return;

    setIsSavingAgent(true);
    try {
      await fetchApi(`/admin/agents/${selectedAgentForEdit.id}`, {
        method: "PATCH",
        body: JSON.stringify(editFormData),
      });
      setAgents((prev) =>
        prev.map((a) =>
          a.id === selectedAgentForEdit.id ? { ...a, ...editFormData } : a,
        ),
      );
      setSuccessToast(`Successfully updated agent "${editFormData.name}"`);
      setTimeout(() => setSuccessToast(null), 3500);
      setSelectedAgentForEdit(null);
    } catch (err: any) {
      setPreviewError(
        "Failed to save agent changes: " + (err.message || "Unknown error"),
      );
    } finally {
      setIsSavingAgent(false);
    }
  };

  // Computed Metrics
  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((a) => {
      if (a.company_id) map.set(a.company_id, a.company_name || a.company_id);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [agents]);

  const attentionCount = useMemo(
    () =>
      agents.filter((agent) => agent.status && agent.status !== "active")
        .length,
    [agents],
  );

  // Filtered Agents
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch =
        agent.name?.toLowerCase().includes(search.toLowerCase()) ||
        agent.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        agent.company_id?.toLowerCase().includes(search.toLowerCase()) ||
        agent.tts_voice?.toLowerCase().includes(search.toLowerCase());

      const matchesCompany =
        companyFilter === "all" || agent.company_id === companyFilter;

      const voiceObj =
        platformVoices.find(
          (v) => v.id.toLowerCase() === (agent.tts_voice || "").toLowerCase(),
        ) || getVoiceById(agent.tts_voice);
      const matchesGender =
        genderFilter === "all" || voiceObj.gender === genderFilter;

      let matchesQuick = true;
      if (quickFilter === "male") matchesQuick = voiceObj.gender === "Male";
      else if (quickFilter === "female")
        matchesQuick = voiceObj.gender === "Female";
      else if (quickFilter === "internal")
        matchesQuick = agent.company_name?.toLowerCase().includes("internal");

      return matchesSearch && matchesCompany && matchesGender && matchesQuick;
    });
  }, [agents, search, companyFilter, genderFilter, quickFilter]);

  const voicePickerOptions = useMemo(
    () => [
      ...VOICES.map((voice) => ({
        value: voice.id,
        label: voice.name,
        description: voice.tone,
        badge: voice.gender,
        group: "Platform voices",
      })),
      ...customVoices.map((voice) => ({
        value: voice.voice_id || voice.id,
        label: voice.name,
        description: voice.description || "Custom cloned voice",
        badge: "Cloned",
        group: "My cloned voices",
      })),
      ...GEMINI_VOICES.map((voice) => ({
        value: voice.id,
        label: voice.name,
        description: voice.tone,
        badge: "Gemini",
        group: "Gemini Live voices",
      })),
    ],
    [customVoices],
  );

  const getVoiceForPicker = (voiceId: string): Voice => {
    const platformVoice = VOICES.find((voice) => voice.id === voiceId);
    if (platformVoice) return platformVoice;

    const customVoice = customVoices.find(
      (voice) => (voice.voice_id || voice.id) === voiceId,
    );
    if (customVoice) {
      return {
        id: customVoice.voice_id || customVoice.id,
        name: customVoice.name,
        gender: customVoice.gender === "Male" ? "Male" : "Female",
        provider: "Sarvam Cloned",
        enabled: true,
        description: customVoice.description || "Custom cloned voice",
        tone: "Cloned Voice",
        sampleText:
          customVoice.sample_text || "Hello! This is a sample of my cloned voice.",
      };
    }

    const geminiVoice = GEMINI_VOICES.find((voice) => voice.id === voiceId);
    if (geminiVoice) {
      return {
        id: geminiVoice.id,
        name: geminiVoice.name,
        gender: "Female",
        provider: "Google Gemini Live",
        enabled: true,
        description: geminiVoice.description,
        tone: geminiVoice.tone,
        sampleText: `Hello, this is ${geminiVoice.name}, a ${geminiVoice.tone.toLowerCase()} Gemini Live voice.`,
      };
    }

    return VOICES[0];
  };

  const totalVoiceCount = VOICES.length + GEMINI_VOICES.length + customVoices.length;

  return (
    <div className={org.page}>
      {/* Toast Notification */}
      {successToast && (
        <Toast message={successToast} onClose={() => setSuccessToast(null)} />
      )}
      {previewError && (
        <Toast
          message={previewError}
          tone="error"
          onClose={() => setPreviewError(null)}
        />
      )}

      <div className={org.pageHeader}>
        <div>
          <span className={org.eyebrow}>
            <ShieldCheck size={14} /> AI WORKFORCE
          </span>
          <h1 className={org.title}>AI agents & voice studio</h1>
          <p className={org.subtitle}>
            Manage customer agents, voice personas and model configuration
            across tenants.
          </p>
        </div>
        <div className={org.toolbar}>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAgents}
            disabled={isLoading}
            className="gap-2 border-slate-200 bg-white text-slate-700"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />{" "}
            Refresh Registry
          </Button>
        </div>
      </div>

      <details className={`${org.architecture} group`}>
        <summary>
          <Radio size={16} /> Advanced signal flow{" "}
          <ChevronDown className="ml-auto h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className={org.architectureBody}>
          {/* Voice Generation Card */}
          <div className={org.architectureItem}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5" /> Voice Audio Output (TTS)
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Sarvam AI · Bulbul:v3</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {totalVoiceCount} voices available: {VOICES.length} platform, {GEMINI_VOICES.length} Gemini Live, and {customVoices.length} cloned.
            </p>
          </div>

          {/* Intelligence / Brain Card */}
          <div className={org.architectureItem}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" /> Intelligence & Reasoning (LLM)
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Multi-Model
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Sarvam-105b</span>
              <span className="text-xs font-normal text-slate-500">
                · Fallback: Gemini / Groq
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Orchestrated multi-turn conversational intelligence with dynamic
              persona grammar enforcement.
            </p>
          </div>

          {/* Speech-to-Text Recognition */}
          <div className={org.architectureItem}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5" /> Audio Hearing & STT
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Dual-Stream
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Sarvam Saarika v2.5</span>
              <span className="text-xs font-normal text-slate-500">
                + Web Speech (en-IN)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Acoustic echo cancellation with instant sub-second user barge-in
              interruption.
            </p>
          </div>
        </div>
      </details>

      {/* ─────────────────── STATS SUMMARY TILES ─────────────────── */}
      <div className={org.metrics}>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Bot size={17} />
          </span>
          <span className={org.metricLabel}>Platform workforce</span>
          <strong className={org.metricValue}>{agents.length}</strong>
          <span className={org.metricSub}>
            {agents.filter((a) => a.status === "active").length} active voice
            agents deployed
          </span>
        </div>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Building2 size={17} />
          </span>
          <span className={org.metricLabel}>Client workspaces</span>
          <strong className={org.metricValue}>{uniqueCompanies.length}</strong>
          <span className={org.metricSub}>Distinct enterprise workspaces</span>
        </div>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Mic size={17} />
          </span>
          <span className={org.metricLabel}>Voice catalog</span>
          <strong className={org.metricValue}>{totalVoiceCount} voices</strong>
          <span className={org.metricSub}>
            {VOICES.length} platform · {GEMINI_VOICES.length} Gemini · {customVoices.length} cloned
          </span>
        </div>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <CheckCircle2 size={17} />
          </span>
          <span className={org.metricLabel}>System health</span>
          <strong className={org.metricValue}>
            {attentionCount ? `${attentionCount} review` : "Healthy"}
          </strong>
          <span className={org.metricSub}>
            {attentionCount
              ? "Agents need attention"
              : `${agents.filter((a) => a.status === "active").length} active agents`}
          </span>
        </div>
      </div>

      {/* ─────────────────── TAB CONTROLS & MASTER NAVIGATION ─────────────────── */}
      <div className={org.surface}>
        <div className={org.directoryToolbar}>
          <div
            className={org.sectionTabs}
            role="group"
            aria-label="Agent views"
          >
            <button
              onClick={() => setActiveTab("workforce")}
              aria-pressed={activeTab === "workforce"}
              className={org.sectionTab}
            >
              <Users className="h-4 w-4" />
              Platform Directory
              <span className={org.tabCount}>{agents.length}</span>
            </button>

            <button
              onClick={() => setActiveTab("voices")}
              aria-pressed={activeTab === "voices"}
              className={org.sectionTab}
            >
              <Sparkles className="h-4 w-4" />
              Voice Selection
              <span className={org.tabCount}>11</span>
            </button>

            <button
              onClick={() => setActiveTab("gemini_voices")}
              aria-pressed={activeTab === "gemini_voices"}
              className={org.sectionTab}
            >
              <Sparkles className="h-4 w-4" />
              Gemini Voices
              <span className={org.tabCount}>{GEMINI_VOICES.length}</span>
            </button>

            <button
              onClick={() => setActiveTab("custom_voices")}
              aria-pressed={activeTab === "custom_voices"}
              className={org.sectionTab}
            >
              <Mic className="h-4 w-4" />
              My Voice Studio
              <span className={org.tabCount}>{customVoices.length}</span>
            </button>
          </div>

          {/* Quick Search inside nav bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search agents, companies, voices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear agent search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─────────────────── TAB 1: ENTERPRISE WORKFORCE DIRECTORY ─────────────────── */}
      {activeTab === "workforce" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-0">
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-500">
                Quick Filters:
              </span>
              <button
                onClick={() => setQuickFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  quickFilter === "all"
                    ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                All ({agents.length})
              </button>
              <button
                onClick={() => setQuickFilter("male")}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  quickFilter === "male"
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-emerald-50"
                }`}
              >
                Male Voices (
                {
                  agents.filter(
                    (a) =>
                      (
                        platformVoices.find(
                          (v) =>
                            v.id.toLowerCase() ===
                            (a.tts_voice || "").toLowerCase(),
                        ) || getVoiceById(a.tts_voice)
                      ).gender === "Male",
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setQuickFilter("female")}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  quickFilter === "female"
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-emerald-50"
                }`}
              >
                Female Voices (
                {
                  agents.filter(
                    (a) =>
                      (
                        platformVoices.find(
                          (v) =>
                            v.id.toLowerCase() ===
                            (a.tts_voice || "").toLowerCase(),
                        ) || getVoiceById(a.tts_voice)
                      ).gender === "Female",
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setQuickFilter("internal")}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                  quickFilter === "internal"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-emerald-700 border-slate-200 hover:bg-emerald-50"
                }`}
              >
                Internal Platform
              </button>
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2">
              <SmartSelect
                value={companyFilter}
                onChange={setCompanyFilter}
                searchPlaceholder="Search companies…"
                menuWidth={280}
                className="w-[220px] [&>button]:h-10 [&>button]:rounded-lg [&>button]:px-3 [&>button]:text-xs"
                options={[
                  {
                    value: "all",
                    label: `All Companies (${uniqueCompanies.length})`,
                    icon: (
                      <img
                        src={`${API_BASE_URL}/admin/settings/logo`}
                        alt=""
                        className="h-5 w-5 object-contain"
                      />
                    ),
                  },
                  ...uniqueCompanies.map((c) => ({
                    value: c.id,
                    label: c.name,
                    icon: (
                      <CompanyLogo
                        companyId={c.id}
                        companyName={c.name}
                        logoReference={companyLogoById[c.id]}
                      />
                    ),
                  })),
                ]}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[11px] text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-bold">Agent</th>
                  <th className="px-6 py-4 font-bold">Company / Workspace</th>
                  <th className="px-6 py-4 font-bold">Voice</th>
                  <th className="px-6 py-4 font-bold">AI Model</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-16 text-center text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                        <span className="text-sm font-semibold text-slate-700">
                          Loading Platform AI Registry...
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAgents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-16 text-center text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Bot className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                        <span className="text-base font-bold text-slate-800">
                          No agents match criteria
                        </span>
                        <p className="text-xs text-slate-500">
                          Try clearing filters or search query.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => {
                    const voiceObj =
                      platformVoices.find(
                        (v) =>
                          v.id.toLowerCase() ===
                          (agent.tts_voice || "").toLowerCase(),
                      ) || getVoiceById(agent.tts_voice);
                    const isPreviewingThis = previewingVoiceId === voiceObj.id;
                    const isInternalWorkspace = agent.company_name
                      ?.toLowerCase()
                      .includes("internal");

                    return (
                      <tr
                        key={agent.id}
                        className="hover:bg-slate-50/90 transition-colors group"
                      >
                        {/* Agent Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3.5">
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border bg-emerald-50 border-emerald-100 text-emerald-700">
                              {agent.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors flex items-center gap-2">
                                <span>{agent.name}</span>
                                {agent.status === "active" && (
                                  <span
                                    className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                                    title="Active"
                                  />
                                )}
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-1 max-w-[240px] mt-0.5">
                                {agent.description ||
                                  `Configured for ${agent.company_name}`}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Company / Workspace */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {isInternalWorkspace ? (
                              <Badge className="bg-emerald-100/90 text-emerald-800 border-emerald-300 gap-1 text-[11px] font-bold">
                                <ShieldCheck className="h-3 w-3" /> INTERNAL
                                PLATFORM
                              </Badge>
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                                  <CompanyLogo
                                    companyId={agent.company_id}
                                    companyName={agent.company_name}
                                    logoReference={
                                      (agent as any).company_logo_url ||
                                      companyLogoById[agent.company_id]
                                    }
                                  />
                                  {agent.company_name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  ID: {agent.company_id.slice(0, 10)}...
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Assigned Voice Persona with Instant Dropdown Changer */}
                        <td className="px-6 py-4 min-w-[300px]">
                          <div className="flex flex-col items-start gap-2">
                            <div className="flex w-full items-center gap-2.5">
                              <div className="min-w-0 flex-1">
                                <SmartSelect
                                  value={agent.tts_voice || voiceObj.id}
                                  disabled={updatingAgentId === agent.id}
                                  searchable
                                  searchPlaceholder="Search voice…"
                                  showSelectedDescription
                                  onChange={(value) =>
                                    handleUpdateVoice(agent.id, value)
                                  }
                                  options={[
                                    ...customVoices.map((v) => ({
                                      value: v.voice_id || v.id,
                                      label: v.name,
                                      group: `My Cloned Voices (${customVoices.length})`,
                                      badge: "Cloned",
                                    })),
                                    ...VOICES.map((v) => ({
                                      value: v.id,
                                      label: v.name,
                                      group: `${v.gender} Voice Personas`,
                                      description: v.tone,
                                      badge: v.gender,
                                    })),
                                    ...GEMINI_VOICES.map((v) => ({
                                      value: v.id,
                                      label: v.name,
                                      group: `Gemini Live Voices (${GEMINI_VOICES.length})`,
                                      description: v.tone,
                                      badge: "Gemini",
                                    })),
                                  ]}
                                  menuWidth={320}
                                  className="w-full [&>button]:h-auto [&>button]:min-h-11"
                                />
                              </div>

                              <button
                                onClick={() => setIsVoiceStudioOpen(true)}
                                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                                title="Clone Custom Voice"
                              >
                                <Mic className="h-4 w-4" />
                              </button>

                              {updatingAgentId === agent.id && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                              )}
                            </div>

                            <button
                              onClick={() =>
                                handlePlayVoicePreview(voiceObj, agent)
                              }
                              disabled={
                                isPreviewLoading &&
                                previewingVoiceId === voiceObj.id
                              }
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                                isPreviewingThis
                                  ? "border-red-600 bg-red-600 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                              }`}
                            >
                              {isPreviewLoading && isPreviewingThis ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isPreviewingThis ? (
                                <>
                                  <Square className="h-3 w-3 fill-current" />
                                  Stop preview
                                </>
                              ) : (
                                <>
                                  <Play className="h-3 w-3 fill-current" />
                                  Listen
                                </>
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Model & Language */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-slate-800">
                              <Cpu className="h-3 w-3 text-indigo-500" />
                              {agent.llm_model || "sarvam-105b"}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {agent.default_language === "en-IN"
                                ? "🇮🇳 Hinglish / en-IN"
                                : agent.default_language}
                            </span>
                          </div>
                        </td>

                        {/* Actions: Configure Drawer Button */}
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDrawer(agent)}
                            className="text-xs font-semibold text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1.5 rounded-xl h-8"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            Configure
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 2: VOICE STUDIO & SOUND GALLERY ─────────────────── */}
      {activeTab === "voices" && (
        <div className="space-y-6">
          <section
            className="overflow-hidden rounded-2xl border border-[#DCE7DF] bg-white shadow-[0_5px_18px_#1b3b300a]"
            aria-label="Compare voice personas"
          >
            <div className="border-b border-[#E8EEE9] px-4 py-3 sm:px-5">
              <h2 className="text-[15px] font-bold text-[#172A40]">
                Compare voice personas
              </h2>
              <p className="mt-1 text-xs text-[#718197]">
                Choose two voices and listen to their samples before assigning
                one.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2 sm:p-4">
              {compareVoices.map((voiceId, index) => {
                const voice = getVoiceForPicker(voiceId);
                return (
                  <div
                    className="flex min-w-0 flex-col rounded-xl border border-[#E3ECE5] bg-[#FAFCF9] p-3 sm:p-4"
                    key={index}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor={`compare-voice-${index}`}
                        className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#087F5B]"
                      >
                        Voice {index === 0 ? "A" : "B"}
                      </label>
                      <span className="rounded-full bg-[#E9F5EE] px-2.5 py-1 text-[11px] font-semibold text-[#087F5B]">
                        {assignedAgentsForVoice(agents, voice).length} assigned
                        agents
                      </span>
                    </div>
                    <SmartSelect
                      value={voice.id}
                      onChange={(value) =>
                        setCompareVoices((current) =>
                          index === 0
                            ? [value, current[1]]
                            : [current[0], value],
                        )
                      }
                      searchPlaceholder="Search voices…"
                      options={voicePickerOptions}
                      className="mt-2"
                    />
                    <div className="mt-3">
                      <strong className="block text-base font-bold text-[#17372A]">
                        {voice.name}
                      </strong>
                      <span className="mt-0.5 block text-xs font-medium text-[#648070]">
                        {voice.tone} · {voice.accent || "Indian"}
                      </span>
                    </div>
                    <p className="mt-2 min-h-0 text-xs leading-relaxed text-[#5C7163]">
                      {voice.description}
                    </p>
                    <div className="mt-3 border-t border-[#E3ECE5] pt-3">
                      <button
                        type="button"
                        onClick={() => handlePlayVoicePreview(voice)}
                        className="inline-flex min-h-8 items-center gap-2 rounded-lg bg-[#087F5B] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#066B4C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087F5B]"
                      >
                        {previewingVoiceId === voice.id ? (
                          <Square size={14} />
                        ) : (
                          <Play size={14} />
                        )}
                        {previewingVoiceId === voice.id
                          ? "Stop sample"
                          : "Listen sample"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          {/* Header Filter Pill Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Gender Filter:
              </span>
              <div className="flex gap-1.5">
                {(["all", "Female", "Male"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderFilter(g)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      genderFilter === g
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {g === "all"
                      ? "All Personas (11)"
                      : `${g} Personas (${g === "Female" ? 6 : 5})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs flex items-center gap-4">
              <div className="text-slate-500 hidden xl:flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>Full Bulbul v3 acoustic spectrum</span>
              </div>
              <Button
                onClick={() => {
                  setActiveTab("custom_voices");
                  setIsVoiceStudioOpen(true);
                }}
                className="bg-[#3E5448] hover:bg-[#2C3B32] text-white rounded-xl h-9 text-xs shadow-sm"
              >
                <Mic className="h-3.5 w-3.5 mr-2" />
                Clone Custom Voice
              </Button>
            </div>
          </div>

          {/* 11 Voice Studio Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {VOICES.filter(
              (v) => genderFilter === "all" || v.gender === genderFilter,
            ).map((voice) => {
              const isPlaying = previewingVoiceId === voice.id;
              const assignedAgents = assignedAgentsForVoice(agents, voice);
              const acoustics = getVoiceAcoustics(voice.id);

              return (
                <div
                  key={voice.id}
                  className={`bg-white rounded-2xl border transition-all p-3 flex flex-col justify-between space-y-2.5 shadow-sm relative overflow-hidden ${
                    isPlaying
                      ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg"
                      : "border-slate-200/80 hover:border-slate-300 hover:shadow-md"
                  }`}
                >
                  {/* Playing Pulse Banner */}
                  {isPlaying && (
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />
                  )}

                  <div>
                    {/* Top Row: Name, Avatar, Gender */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-sm border bg-emerald-50 border-emerald-100 text-emerald-800">
                          {voice.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-slate-900 text-sm">
                              {voice.name}
                            </h3>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border-emerald-100"
                            >
                              {voice.gender}
                            </Badge>
                          </div>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md inline-block mt-1">
                            {voice.tone}
                          </span>
                        </div>
                      </div>

                      {/* Usage Badge */}
                      <Badge
                        variant="secondary"
                        className="text-[11px] bg-slate-100 text-slate-700 border-slate-200 font-semibold shrink-0"
                      >
                        {assignedAgents.length}{" "}
                        {assignedAgents.length === 1 ? "Agent" : "Agents"}
                      </Badge>
                    </div>

                    <div className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Users className="h-3 w-3 shrink-0 text-emerald-600" />
                      <span className="font-semibold text-slate-600">Assigned:</span>
                      <span className="truncate" title={assignedAgents.map((a) => a.name).join(", ")}>
                        {assignedAgents.length > 0
                          ? assignedAgents.map((a) => a.name).join(", ")
                          : "Unassigned"}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed mb-2 line-clamp-2 min-h-[32px]">
                      {voice.description}
                    </p>

                    {/* Acoustic Telemetry Pill */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 mb-2.5">
                      <span className="text-slate-800 font-bold">
                        Acoustics:
                      </span>
                      <span>Pitch {acoustics.pitch.toFixed(2)}</span>
                      <span>·</span>
                      <span>Rate {acoustics.rate.toFixed(2)}x</span>
                      <span>·</span>
                      <span className="capitalize">
                        {voice.accent || "Indian"}
                      </span>
                    </div>

                    <p className="truncate text-[10px] italic text-slate-500" title={voice.sampleText}>
                      Preview: “{voice.sampleText}”
                    </p>
                  </div>

                  {/* Bottom Actions */}
                  <div className="space-y-2.5 pt-2.5 border-t border-slate-100">
                    <Button
                      onClick={() => handlePlayVoicePreview(voice)}
                      disabled={
                        isPreviewLoading && previewingVoiceId === voice.id
                      }
                        className={`w-full text-[11px] font-bold gap-2 py-1.5 rounded-xl transition-all ${
                        isPlaying
                          ? "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
                          : "bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                      }`}
                    >
                      {isPreviewLoading && previewingVoiceId === voice.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : isPlaying ? (
                        <>
                          <Square className="h-3.5 w-3.5 fill-current" />
                          <span>Stop Audio Sample</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Listen Voice Sample</span>
                        </>
                      )}
                    </Button>

                    {/* Reassign to Agent Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-slate-500 block">
                        Assign this voice to platform agent:
                      </label>
                      <SmartSelect
                        value=""
                        placeholder="Choose an agent to reassign…"
                        searchPlaceholder="Search agents…"
                        onChange={(value) => handleUpdateVoice(value, voice.id)}
                        options={agents.map((a) => ({
                          value: a.id,
                          label: `${a.name} (${a.company_name})`,
                          badge:
                            a.tts_voice?.toLowerCase() ===
                            voice.id.toLowerCase()
                              ? "Current"
                              : undefined,
                        }))}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 2B: GEMINI LIVE VOICES ─────────────────── */}
      {activeTab === "gemini_voices" && (
        <div className="space-y-6">
          <section className="overflow-hidden rounded-2xl border border-[#DCE7DF] bg-white shadow-[0_5px_18px_#1b3b300a]">
            <div className="flex flex-col gap-3 border-b border-[#E8EEE9] bg-gradient-to-r from-emerald-50/70 via-white to-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-700" />
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Gemini Live Voices
                  </h2>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                    {GEMINI_VOICES.length} prebuilt
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Choose a native Gemini voice for real-time voice-to-voice agents.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-[11px] font-semibold text-emerald-700">
                Gemini Live · Native audio
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 sm:p-5">
              {GEMINI_VOICES.filter((voice) => {
                const query = search.trim().toLowerCase();
                return !query || `${voice.name} ${voice.tone}`.toLowerCase().includes(query);
              }).map((voice) => {
                const assignedAgents = assignedAgentsForVoice(agents, voice);
                const previewVoice = {
                  id: voice.id,
                  name: voice.name,
                  gender: "Female" as const,
                  provider: "Google Gemini Live",
                  enabled: true,
                  description: voice.description,
                  tone: voice.tone,
                  sampleText: `Hello, this is ${voice.name}, a ${voice.tone.toLowerCase()} Gemini Live voice.`,
                };

                return (
                  <div key={voice.id} className={`relative flex min-h-[250px] flex-col justify-between space-y-3 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all ${previewingVoiceId === voice.id ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg" : "border-slate-200/80 hover:border-emerald-300 hover:shadow-md"}`}>
                    {previewingVoiceId === voice.id && <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />}
                    <div>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-sm font-extrabold text-emerald-800 shadow-sm">{voice.name.charAt(0)}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold tracking-tight text-slate-900">{voice.name}</h3>
                              <span className="rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800">Gemini Live</span>
                            </div>
                            <span className="mt-1 inline-block rounded-md bg-emerald-50/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{voice.tone}</span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{assignedAgents.length} {assignedAgents.length === 1 ? "Agent" : "Agents"}</span>
                      </div>
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                        <Users className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span className="font-semibold text-slate-600">Assigned:</span>
                        <span className="truncate" title={assignedAgents.map((agent) => agent.name).join(", ")}>
                          {assignedAgents.length > 0 ? assignedAgents.map((agent) => agent.name).join(", ") : "Unassigned"}
                        </span>
                      </div>
                      <p className="mb-2.5 text-[11px] leading-relaxed text-slate-600">{voice.description}</p>
                      <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 p-2 text-[10px] font-mono text-emerald-700">
                        <span className="font-bold">Provider:</span>
                        <span>Google Gemini Live</span>
                        <span>Native audio</span>
                      </div>
                    </div>
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <button type="button" onClick={() => handlePlayVoicePreview(previewVoice)} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${previewingVoiceId === voice.id ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800"}`}>
                        {previewingVoiceId === voice.id ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                        {previewingVoiceId === voice.id ? "Stop voice sample" : "Listen voice sample"}
                      </button>
                      <label className="block text-[11px] font-semibold text-slate-500">Assign this voice to platform agent:</label>
                      <SmartSelect
                        value=""
                        placeholder={assignedAgents.length > 0 ? `Assign to another agent` : "Assign to agent"}
                        searchPlaceholder="Search agents…"
                        onChange={(agentId) => handleUpdateVoice(agentId, voice.id)}
                        options={agents.map((agent) => ({
                          value: agent.id,
                          label: `${agent.name} (${agent.company_name})`,
                        }))}
                        className="min-w-0 flex-1 [&>button]:h-9 [&>button]:text-[11px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ─────────────────── TAB 3: CUSTOM VOICE STUDIO ─────────────────── */}
      {activeTab === "custom_voices" && (
        <div className="flex flex-col gap-6 items-start relative">
          {/* Studio Modal */}
          <VoiceCloningStudio
            isOpen={isVoiceStudioOpen}
            onClose={() => setIsVoiceStudioOpen(false)}
            onVoiceCreated={(v) => {
              loadCustomVoices();
              setIsVoiceStudioOpen(false);
            }}
          />

          {/* Right Panel: Gallery */}
          <div className="w-full flex-1 pb-12">
            <div className="bg-gradient-to-r from-slate-50 to-white p-6 rounded-3xl border border-slate-200/80 shadow-md flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-100/30 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              <div className="relative z-10 flex flex-col">
                <h3 className="font-extrabold text-slate-900 text-2xl tracking-tight">
                  My Custom Voices
                </h3>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  Manage and assign voices you have cloned.
                </p>
              </div>
              <div className="relative z-10 flex flex-wrap items-center gap-3 w-full xl:w-auto">
                <Button
                  onClick={() => setIsVoiceStudioOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 text-sm font-bold shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] hover:-translate-y-0.5 transition-all duration-200 shrink-0 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-white/20 w-full h-full -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Voice
                </Button>
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search cloned voices..."
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 shadow-sm h-10"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* Unified Filter Bar */}
                  <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200/80 shadow-sm h-10">
                    <Filter className="h-3.5 w-3.5 text-slate-400 ml-2" />
                    <SmartSelect
                      value={typeFilter}
                      onChange={setTypeFilter}
                      searchable={false}
                      className="w-24 [&>button]:h-8 [&>button]:border-transparent [&>button]:bg-transparent [&>button]:px-2 [&>button]:shadow-none [&>button]:text-[11px] [&>button]:hover:border-transparent [&>button]:hover:shadow-none"
                      options={[
                        { value: "all", label: "All Types" },
                        { value: "cloned", label: "Cloned" },
                        { value: "professional", label: "Pro" },
                      ]}
                    />
                    <div className="w-px h-4 bg-slate-200"></div>
                    <SmartSelect
                      value={voiceFilter}
                      onChange={setVoiceFilter}
                      searchable={false}
                      className="w-24 [&>button]:h-8 [&>button]:border-transparent [&>button]:bg-transparent [&>button]:px-2 [&>button]:shadow-none [&>button]:text-[11px] [&>button]:hover:border-transparent [&>button]:hover:shadow-none"
                      options={[
                        { value: "active", label: "Active" },
                        { value: "archived", label: "Archived" },
                        { value: "all", label: "All Status" },
                      ]}
                    />
                    <div className="w-px h-4 bg-slate-200"></div>
                    <SmartSelect
                      value={sortBy}
                      onChange={setSortBy}
                      searchable={false}
                      className="w-24 [&>button]:h-8 [&>button]:border-transparent [&>button]:bg-transparent [&>button]:px-2 [&>button]:shadow-none [&>button]:text-[11px] [&>button]:hover:border-transparent [&>button]:hover:shadow-none"
                      options={[
                        { value: "newest", label: "Newest" },
                        { value: "oldest", label: "Oldest" },
                        { value: "az", label: "A-Z" },
                      ]}
                    />
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-50 border border-slate-200/80 rounded-xl p-1 shadow-inner h-10">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold" : "text-slate-500 hover:text-slate-700 font-semibold"}`}
                      title="List View"
                    >
                      <List className="h-4 w-4" />
                      <span className="text-[11px] uppercase tracking-wider hidden sm:block">
                        List
                      </span>
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold" : "text-slate-500 hover:text-slate-700 font-semibold"}`}
                      title="Grid View"
                    >
                      <LayoutGrid className="h-4 w-4" />
                      <span className="text-[11px] uppercase tracking-wider hidden sm:block">
                        Grid
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
              {/* LEFT SIDE (70%): Gallery Grid / List */}
              <div
                className={`col-span-1 lg:col-span-8 ${viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-3"}`}
              >
                {filteredVoices.length === 0 ? (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-200 border-dashed">
                    <Mic className="h-12 w-12 text-slate-300 mb-4" />
                    <h4 className="text-sm font-bold text-slate-700">
                      No Custom Voices Found
                    </h4>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm">
                      Try adjusting your search or filter settings.
                    </p>
                  </div>
                ) : (
                  filteredVoices.map((voice) => {
                    const isSelected = selectedVoiceId === voice.id;
                    const assignedAgents = assignedAgentsForVoice(
                      agents,
                      voice,
                    );

                    if (viewMode === "grid") {
                      return (
                        <div
                          key={voice.id}
                          onClick={() => setSelectedVoiceId(voice.id)}
                          className={`bg-white rounded-3xl border ${isSelected ? "border-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]" : "border-slate-200 hover:border-emerald-300 hover:shadow-md"} transition-all duration-300 p-5 flex flex-col gap-4 group relative overflow-hidden cursor-pointer h-full`}
                        >
                          {/* Background glowing accent on hover (Grid only) */}
                          <div
                            className={`absolute top-0 right-0 w-64 h-64 ${isSelected ? "bg-emerald-400/20 opacity-100" : "bg-emerald-400/10 opacity-0 group-hover:opacity-100"} rounded-full blur-[80px] transition-opacity duration-700 pointer-events-none -mr-16 -mt-16`}
                          ></div>

                          <div className="relative z-10 flex flex-col h-full gap-4">
                            {/* Top Header */}
                            <div className="flex items-start justify-between">
                              <div
                                className={`h-12 w-12 rounded-2xl ${isSelected ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 border-slate-200"} border flex items-center justify-center font-black text-xl shadow-sm shrink-0 relative transition-colors`}
                              >
                                {voice.name?.charAt(0)?.toUpperCase() || "C"}
                                <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                  <Check className="h-2 w-2 text-white" />
                                </div>
                              </div>
                              <Badge
                                variant="secondary"
                                className="text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-100 px-1.5 py-0.5 rounded-md shadow-sm shrink-0"
                              >
                                ✨ Cloned
                              </Badge>
                            </div>

                            <div className="flex flex-col gap-1">
                              <h3 className="font-bold text-slate-900 text-lg tracking-tight leading-tight line-clamp-1 flex items-center gap-1.5">
                                {voice.name}
                                {voice.is_pinned && (
                                  <span className="text-sm" title="Pinned">
                                    📌
                                  </span>
                                )}
                              </h3>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                <Calendar className="h-3 w-3" />
                                {new Date(
                                  voice.created_at || Date.now(),
                                ).toLocaleDateString("en-US", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                            </div>

                            {/* Statuses */}
                            <div className="flex flex-col gap-2 mt-1">
                              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]"></span>{" "}
                                Active
                              </div>
                              {voice.name?.toLowerCase().includes("mix") ? (
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
                                  <AlertTriangle className="h-3.5 w-3.5" />{" "}
                                  Multiple Voices
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                                  <ShieldCheck className="h-3.5 w-3.5" /> High
                                  Clarity
                                </div>
                              )}
                            </div>

                            {/* Assigned Agent */}
                            <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Assigned:
                              </span>
                              {assignedAgents.length > 0 ? (
                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 w-full">
                                  <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span
                                    className="text-[11px] font-semibold text-slate-700 truncate"
                                    title={assignedAgents
                                      .map((a) => a.name)
                                      .join(", ")}
                                  >
                                    {assignedAgents
                                      .map((a) => a.name)
                                      .join(", ")}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 px-2.5 py-1.5 w-full border border-slate-200 border-dashed rounded-lg bg-slate-50">
                                  <span className="text-[11px] font-bold text-slate-400">
                                    Unassigned
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      // LIST VIEW
                      return (
                        <div
                          key={voice.id}
                          onClick={() => setSelectedVoiceId(voice.id)}
                          className={`bg-white rounded-2xl border ${isSelected ? "border-emerald-500 shadow-md bg-emerald-50/20" : "border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md"} transition-all duration-300 p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative group w-full cursor-pointer`}
                        >
                          {/* LEFT: Avatar, Name, Date, Badge */}
                          <div className="flex items-center gap-4 w-full sm:w-[45%] shrink-0">
                            <div
                              className={`h-11 w-11 rounded-xl ${isSelected ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-gradient-to-br from-slate-50 to-slate-100 text-slate-700 border-slate-200"} border flex items-center justify-center font-black text-lg shadow-sm shrink-0 relative transition-colors`}
                            >
                              {voice.name?.charAt(0)?.toUpperCase() || "C"}
                              <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
                                <Check className="h-2 w-2 text-white" />
                              </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 text-base tracking-tight leading-tight truncate">
                                  {voice.name}
                                </h3>
                                <Badge
                                  variant="secondary"
                                  className="text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-100 px-1 py-0 rounded-md shrink-0"
                                >
                                  ✨ Cloned
                                </Badge>
                                {voice.is_pinned && (
                                  <span
                                    className="text-sm shrink-0"
                                    title="Pinned"
                                  >
                                    📌
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                                <Calendar className="h-3 w-3" />
                                {new Date(
                                  voice.created_at || Date.now(),
                                ).toLocaleDateString("en-US", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                            </div>
                          </div>

                          {/* MIDDLE: Status badge, Clarity */}
                          <div className="flex items-center justify-start sm:justify-center gap-4 w-full sm:w-[25%] shrink-0">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]"></span>{" "}
                              Active
                            </div>
                            {voice.name?.toLowerCase().includes("mix") ? (
                              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                                <AlertTriangle className="h-3.5 w-3.5" /> Multi
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                <ShieldCheck className="h-3.5 w-3.5" /> High
                                Clarity
                              </div>
                            )}
                          </div>

                          {/* RIGHT: Assigned Agent + Chevron */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-[30%] shrink-0">
                            {assignedAgents.length > 0 ? (
                              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1 max-w-[140px]">
                                <Users className="h-3 w-3 text-slate-400 shrink-0" />
                                <span
                                  className="text-[11px] font-semibold text-slate-700 truncate"
                                  title={assignedAgents
                                    .map((a) => a.name)
                                    .join(", ")}
                                >
                                  {assignedAgents.map((a) => a.name).join(", ")}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-400">
                                Unassigned
                              </span>
                            )}
                            <ChevronRight
                              className={`h-4 w-4 transition-colors ${isSelected ? "text-emerald-500" : "text-slate-300 group-hover:text-slate-500"}`}
                            />
                          </div>
                        </div>
                      );
                    }
                  })
                )}
              </div>

              {/* RIGHT SIDE (30%): Sticky Voice Settings Panel */}
              <div className="col-span-1 lg:col-span-4 lg:sticky lg:top-24 self-start">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
                  {/* Sticky Header */}
                  <div className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
                    <Sliders className="h-4 w-4 text-emerald-500" />
                    <h3 className="font-bold text-slate-800 text-sm">
                      Voice Settings
                    </h3>
                  </div>

                  {!selectedVoiceId ||
                  !filteredVoices.find((v) => v.id === selectedVoiceId) ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50/30">
                      <div className="h-12 w-12 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center mb-3">
                        <Mic className="h-5 w-5 text-slate-300" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-700">
                        No Voice Selected
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Select a voice from the gallery to view and configure
                        its advanced details.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const voice = filteredVoices.find(
                        (v) => v.id === selectedVoiceId,
                      )!;
                      const assignedAgents = assignedAgentsForVoice(
                        agents,
                        voice,
                      );
                      return (
                        <div className="p-6 flex flex-col h-full space-y-5">
                          {/* Compact Voice Header */}
                          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-xl shadow-sm shrink-0">
                                {voice.name?.charAt(0)?.toUpperCase() || "C"}
                              </div>
                              <div className="flex flex-col">
                                <h2 className="text-sm font-extrabold text-slate-900 leading-tight flex items-center gap-1.5">
                                  {voice.name}
                                  {voice.is_pinned && (
                                    <span className="text-xs" title="Pinned">
                                      📌
                                    </span>
                                  )}
                                </h2>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge
                                    variant="secondary"
                                    className="text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border-none px-1 py-0 rounded-md"
                                  >
                                    {voice.is_archived
                                      ? "📦 Archived"
                                      : "✨ Cloned"}
                                  </Badge>
                                  <div className="text-[9px] font-mono text-slate-400">
                                    ID: {voice.id.substring(0, 10)}...
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={async () => {
                                  const newPinned = !voice.is_pinned;
                                  try {
                                    const formData = new FormData();
                                    formData.append(
                                      "is_pinned",
                                      newPinned.toString(),
                                    );
                                    const res = await fetch(
                                      `${API_BASE_URL}/companies/admin_workspace/voices/${voice.id}`,
                                      {
                                        method: "PATCH",
                                        headers: {
                                          Authorization: `Bearer ${localStorage.getItem("zenaipex_token")}`,
                                        },
                                        body: formData,
                                      },
                                    );
                                    if (res.ok) {
                                      setCustomVoices((prev) =>
                                        prev.map((v) =>
                                          v.id === voice.id
                                            ? { ...v, is_pinned: newPinned }
                                            : v,
                                        ),
                                      );
                                    }
                                  } catch (e) {
                                    setPreviewError("Failed to pin voice");
                                  }
                                }}
                                className={`p-1.5 rounded-lg border transition-colors ${voice.is_pinned ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 hover:text-slate-600 border-slate-100 hover:bg-slate-100"}`}
                                title={
                                  voice.is_pinned ? "Unpin Voice" : "Pin to Top"
                                }
                              >
                                <Pin className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  const newName = prompt(
                                    "Enter new name for this voice:",
                                    voice.name,
                                  );
                                  if (
                                    newName &&
                                    newName.trim() !== voice.name
                                  ) {
                                    try {
                                      const formData = new FormData();
                                      formData.append("name", newName.trim());
                                      const res = await fetch(
                                        `${API_BASE_URL}/companies/admin_workspace/voices/${voice.id}`,
                                        {
                                          method: "PATCH",
                                          headers: {
                                            Authorization: `Bearer ${localStorage.getItem("zenaipex_token")}`,
                                          },
                                          body: formData,
                                        },
                                      );
                                      if (res.ok) {
                                        setCustomVoices((prev) =>
                                          prev.map((v) =>
                                            v.id === voice.id
                                              ? { ...v, name: newName.trim() }
                                              : v,
                                          ),
                                        );
                                      }
                                    } catch (e) {
                                      setPreviewError("Failed to edit voice");
                                    }
                                  }
                                }}
                                className="p-1.5 rounded-lg border bg-slate-50 text-slate-400 hover:text-slate-600 border-slate-100 hover:bg-slate-100 transition-colors"
                                title="Edit Voice"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Audio Player */}
                          <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 flex flex-col gap-3">
                            {/* Custom Text Input */}
                            <div>
                              <textarea
                                placeholder="Type something to test this voice..."
                                rows={2}
                                maxLength={150}
                                value={testText[voice.id] || ""}
                                onChange={(e) =>
                                  setTestText((prev) => ({
                                    ...prev,
                                    [voice.id]: e.target.value,
                                  }))
                                }
                                className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 resize-none bg-white text-slate-700 placeholder-slate-400 transition-all"
                              />
                              <div className="text-[9px] text-slate-400 text-right mt-0.5">
                                {(testText[voice.id] || "").length}/150
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const audioEl = document.getElementById(
                                      `audio-panel-${voice.id}`,
                                    ) as HTMLAudioElement;
                                    if (audioEl && testAudioSrc[voice.id]) {
                                      if (isLivePlaying[voice.id]) {
                                        audioEl.pause();
                                        setIsLivePlaying((p) => ({
                                          ...p,
                                          [voice.id]: false,
                                        }));
                                      } else {
                                        const spd =
                                          voiceSettings[voice.id]?.speed ??
                                          voice.speed ??
                                          1.15;
                                        const vol =
                                          voiceSettings[voice.id]?.volume ??
                                          voice.volume ??
                                          1.35;
                                        audioEl.playbackRate = spd;
                                        if (gainNodesRef.current[voice.id]) {
                                          gainNodesRef.current[
                                            voice.id
                                          ].gain.value = vol;
                                        }
                                        audioEl.currentTime = 0;
                                        audioEl
                                          .play()
                                          .catch((e) => console.warn(e));
                                        setIsLivePlaying((p) => ({
                                          ...p,
                                          [voice.id]: true,
                                        }));
                                      }
                                    } else {
                                      handleTestCustomVoice(voice);
                                    }
                                  }}
                                  disabled={
                                    isGeneratingVoiceId === voice.id ||
                                    testingCustomVoiceId === voice.id
                                  }
                                  className={`h-7 px-2.5 text-xs font-bold gap-1.5 rounded-lg shadow-2xs transition-all ${
                                    isLivePlaying[voice.id]
                                      ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                      : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                                  }`}
                                >
                                  {isGeneratingVoiceId === voice.id ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                                      Synthesizing...
                                    </>
                                  ) : isLivePlaying[voice.id] ? (
                                    <>
                                      <Square className="h-3 w-3 fill-current" />{" "}
                                      Stop Audio
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-3 w-3 fill-current" />{" "}
                                      Test Audio
                                    </>
                                  )}
                                </Button>
                                <SmartSelect
                                  value={testLanguage[voice.id] || "en-IN"}
                                  onChange={(value) => {
                                    setTestLanguage((prev) => ({
                                      ...prev,
                                      [voice.id]: value,
                                    }));
                                    handleTestCustomVoice(voice, value, true);
                                  }}
                                  searchable={false}
                                  className="w-20 [&>button]:h-8 [&>button]:rounded-md [&>button]:border-slate-200 [&>button]:px-2 [&>button]:text-[11px]"
                                  options={[
                                    { value: "en-IN", label: "Eng" },
                                    { value: "hi-IN", label: "Hin" },
                                    { value: "gu-IN", label: "Guj" },
                                  ]}
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <SmartSelect
                                  value={(
                                    voiceSettings[voice.id]?.speed ??
                                    voice.speed ??
                                    playbackRate[voice.id] ??
                                    1.15
                                  ).toFixed(2)}
                                  onChange={(value) =>
                                    handleVoiceParamChange(
                                      voice.id,
                                      "speed",
                                      parseFloat(value),
                                    )
                                  }
                                  searchable={false}
                                  className="w-28 [&>button]:h-8 [&>button]:rounded-md [&>button]:border-amber-300 [&>button]:px-2 [&>button]:text-[11px] [&>button]:text-amber-900"
                                  options={[
                                    { value: "0.80", label: "0.80x Slow" },
                                    { value: "1.00", label: "1.00x Normal" },
                                    { value: "1.15", label: "1.15x Natural" },
                                    { value: "1.30", label: "1.30x Quick" },
                                    { value: "1.50", label: "1.50x Fast" },
                                  ]}
                                />
                                {testAudioSrc[voice.id] && (
                                  <>
                                    <button
                                      onClick={() =>
                                        handleTestCustomVoice(
                                          voice,
                                          undefined,
                                          true,
                                        )
                                      }
                                      disabled={
                                        isGeneratingVoiceId === voice.id ||
                                        testingCustomVoiceId === voice.id
                                      }
                                      className={`p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors ${isGeneratingVoiceId === voice.id ? "opacity-50 cursor-not-allowed" : ""}`}
                                      title="Regenerate Voice from AI Engine (Slow)"
                                    >
                                      <RefreshCw
                                        className={`h-3 w-3 ${isGeneratingVoiceId === voice.id ? "animate-spin" : ""}`}
                                      />
                                    </button>
                                    <a
                                      href={`data:audio/${testAudioSrc[voice.id]?.startsWith("UklGR") ? "wav" : "mp3"};base64,${testAudioSrc[voice.id]}`}
                                      download={`${voice.name.replace(/\s+/g, "_")}_test.${testAudioSrc[voice.id]?.startsWith("UklGR") ? "wav" : "mp3"}`}
                                      className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
                                      title="Download Audio"
                                    >
                                      <Download className="h-3 w-3" />
                                    </a>
                                  </>
                                )}
                              </div>
                            </div>

                            {testAudioSrc[voice.id] ? (
                              <div className="flex flex-col gap-1.5">
                                <div className="relative">
                                  <audio
                                    id={`audio-panel-${voice.id}`}
                                    controls
                                    src={`data:audio/${testAudioSrc[voice.id]?.startsWith("UklGR") ? "wav" : "mp3"};base64,${testAudioSrc[voice.id]}`}
                                    onPlay={() => {
                                      setIsLivePlaying((p) => ({
                                        ...p,
                                        [voice.id]: true,
                                      }));
                                      // Ensure current calibrated speed & volume are immediately applied
                                      const audioEl = document.getElementById(
                                        `audio-panel-${voice.id}`,
                                      ) as HTMLAudioElement;
                                      if (audioEl) {
                                        const curSpd =
                                          voiceSettings[voice.id]?.speed ??
                                          voice.speed ??
                                          1.15;
                                        audioEl.playbackRate = curSpd;
                                        const curVol =
                                          voiceSettings[voice.id]?.volume ??
                                          voice.volume ??
                                          1.35;
                                        if (gainNodesRef.current[voice.id]) {
                                          gainNodesRef.current[
                                            voice.id
                                          ].gain.value = curVol;
                                        } else {
                                          audioEl.volume = Math.min(
                                            1.0,
                                            curVol / 2.0,
                                          );
                                        }
                                      }
                                    }}
                                    onPause={() =>
                                      setIsLivePlaying((p) => ({
                                        ...p,
                                        [voice.id]: false,
                                      }))
                                    }
                                    onEnded={() => {
                                      setIsLivePlaying((p) => ({
                                        ...p,
                                        [voice.id]: false,
                                      }));
                                      setTestingCustomVoiceId(null);
                                    }}
                                    className="w-full h-9 outline-none rounded-md bg-white border border-slate-200/80 shadow-2xs"
                                  />
                                </div>
                                <div className="flex items-center justify-between px-1 text-[9px]">
                                  <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                                    <span
                                      className={`inline-block w-2 h-2 rounded-full ${isLivePlaying[voice.id] ? "bg-emerald-500 animate-ping" : "bg-slate-300"}`}
                                    />
                                    {isLivePlaying[voice.id] ? (
                                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                                        <Activity className="h-3 w-3 animate-pulse text-emerald-600" />{" "}
                                        Live Playing
                                      </span>
                                    ) : (
                                      <span>Ready to test</span>
                                    )}
                                  </span>
                                  {isAudioLiveTuned[voice.id] && (
                                    <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 shadow-2xs">
                                      ⚡ Live Tuned:{" "}
                                      {(
                                        voiceSettings[voice.id]?.speed ?? 1.15
                                      ).toFixed(2)}
                                      x ·{" "}
                                      {Math.round(
                                        (voiceSettings[voice.id]?.volume ??
                                          1.35) * 100,
                                      )}
                                      % Vol
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                className="w-full h-9 bg-white border-slate-200 hover:border-emerald-400 hover:text-emerald-700 text-slate-600 transition-all rounded-lg shadow-sm font-bold text-[11px]"
                                onClick={() => handleTestCustomVoice(voice)}
                                disabled={
                                  isGeneratingVoiceId === voice.id ||
                                  testingCustomVoiceId === voice.id
                                }
                              >
                                {testingCustomVoiceId === voice.id ? (
                                  <>
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-emerald-500" />{" "}
                                    Synthesizing...
                                  </>
                                ) : (
                                  <>
                                    <Play className="mr-1.5 h-4 w-4 text-emerald-500" />{" "}
                                    Generate Preview
                                  </>
                                )}
                              </Button>
                            )}
                          </div>

                          {/* Tuning Sliders Container */}
                          <div className="flex flex-col gap-3 pt-1">
                            <div className="flex items-center justify-between pb-0.5">
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                🎛️ Voice Tuning & Calibration
                              </span>
                              {sliderSaveStatus[voice.id] ? (
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-1 shadow-sm transition-all animate-pulse">
                                  ✓ Saved to Database
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-medium">
                                  Auto-synced
                                </span>
                              )}
                            </div>

                            {/* Voice Speed Slider */}
                            <div className="space-y-1.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 shadow-sm transition-all hover:border-emerald-200">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-emerald-900 flex items-center gap-1.5">
                                  ⚡ Voice Speed
                                </span>
                                <span className="text-emerald-800 font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-100 text-[10px] shadow-2xs">
                                  {(
                                    voiceSettings[voice.id]?.speed ??
                                    voice.speed ??
                                    1.15
                                  ).toFixed(2)}
                                  x
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0.8"
                                max="1.5"
                                step="0.05"
                                value={
                                  voiceSettings[voice.id]?.speed ??
                                  voice.speed ??
                                  1.15
                                }
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleVoiceParamChange(
                                    voice.id,
                                    "speed",
                                    val,
                                  );
                                }}
                                onPointerUp={() =>
                                  triggerInstantAudioPreview(voice.id)
                                }
                                className="w-full h-1.5 bg-emerald-200/80 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-all"
                              />
                              <div className="flex justify-between text-[8px] font-medium text-emerald-700/80">
                                <span>0.8x Slow</span>
                                <span>1.15x Natural</span>
                                <span>1.5x Fast</span>
                              </div>
                            </div>

                            {/* Volume Boost Slider */}
                            <div className="space-y-1.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 shadow-sm transition-all hover:border-emerald-200">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-emerald-900 flex items-center gap-1.5">
                                  🔊 Volume Boost
                                </span>
                                <span className="text-emerald-800 font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-100 text-[10px] shadow-2xs">
                                  {Math.round(
                                    (voiceSettings[voice.id]?.volume ??
                                      voice.volume ??
                                      1.35) * 100,
                                  )}
                                  %
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0.8"
                                max="2.0"
                                step="0.05"
                                value={
                                  voiceSettings[voice.id]?.volume ??
                                  voice.volume ??
                                  1.35
                                }
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  handleVoiceParamChange(
                                    voice.id,
                                    "volume",
                                    val,
                                  );
                                }}
                                onPointerUp={() =>
                                  triggerInstantAudioPreview(voice.id)
                                }
                                className="w-full h-1.5 bg-emerald-200/80 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-all"
                              />
                              <div className="flex justify-between text-[8px] font-medium text-emerald-700/80">
                                <span>80% Standard</span>
                                <span>135% Dynamic Loud</span>
                                <span>200% Max Boost</span>
                              </div>
                            </div>

                            {/* Clarity & Similarity Slider */}
                            <div className="space-y-1.5 bg-gradient-to-r from-emerald-50/70 to-emerald-100/40 p-2.5 rounded-xl border border-emerald-200/70 shadow-sm transition-all hover:border-emerald-300">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-emerald-900 flex items-center gap-1.5">
                                  🎯 Clarity & Similarity
                                </span>
                                <span className="text-emerald-800 font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-200 text-[10px] shadow-2xs">
                                  {voiceSettings[voice.id]?.clarity ??
                                    voice.clarity ??
                                    94}
                                  %
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={
                                  voiceSettings[voice.id]?.clarity ??
                                  voice.clarity ??
                                  94
                                }
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  handleVoiceParamChange(
                                    voice.id,
                                    "clarity",
                                    val,
                                  );
                                }}
                                onPointerUp={() =>
                                  triggerInstantAudioPreview(voice.id)
                                }
                                className="w-full h-1.5 bg-emerald-200/80 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-all"
                              />
                              <div className="flex justify-between text-[8px] font-medium text-emerald-700/80">
                                <span>0% Soft</span>
                                <span>50% Balanced</span>
                                <span>100% Studio Precision</span>
                              </div>
                            </div>

                            {/* Stability (Monotone) Slider */}
                            <div className="space-y-1.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 shadow-sm transition-all hover:border-emerald-200">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-emerald-900 flex items-center gap-1.5">
                                  ⚖️ Stability & Tone
                                </span>
                                <span className="text-emerald-800 font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-100 text-[10px] shadow-2xs">
                                  {voiceSettings[voice.id]?.stability ??
                                    voice.stability ??
                                    85}
                                  %
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={
                                  voiceSettings[voice.id]?.stability ??
                                  voice.stability ??
                                  85
                                }
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  handleVoiceParamChange(
                                    voice.id,
                                    "stability",
                                    val,
                                  );
                                }}
                                onPointerUp={() =>
                                  triggerInstantAudioPreview(voice.id)
                                }
                                className="w-full h-1.5 bg-emerald-200/80 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-all"
                              />
                              <div className="flex justify-between text-[8px] font-medium text-emerald-700/80">
                                <span>0% Dynamic Range</span>
                                <span>50% Conversational</span>
                                <span>100% Monotone</span>
                              </div>
                            </div>
                          </div>

                          {/* Agent Assignment */}
                          <div className="pt-2 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Assigned Agent
                              </span>
                              {assignedAgents.length > 0 && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                                  {assignedAgents.length} Active
                                </span>
                              )}
                            </div>

                            {/* Assigned Agent Tags */}
                            {assignedAgents.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200/80">
                                {assignedAgents.map((a) => (
                                  <div
                                    key={a.id}
                                    className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-800 text-[11px] font-bold px-2 py-1 rounded-lg shadow-2xs"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span>{a.name}</span>
                                    <span className="text-[9px] font-normal text-slate-400">
                                      ({a.company_name})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 italic px-2 py-1 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                Currently not assigned to any agent.
                              </div>
                            )}

                            {/* Assign/Reassign Dropdown */}
                            <SmartSelect
                              value={assignedAgents[0]?.id || ""}
                              disabled={!!updatingAgentId}
                              onChange={(value) =>
                                handleUpdateVoice(value, voice.id)
                              }
                              placeholder={
                                assignedAgents.length > 0
                                  ? "Switch or Reassign to Agent…"
                                  : "Assign to Agent…"
                              }
                              searchPlaceholder="Search agents…"
                              options={agents.map((a) => ({
                                value: a.id,
                                label: `${a.name} (${a.company_name})`,
                                badge:
                                  a.tts_voice === voice.id ||
                                  a.tts_voice === voice.voice_id
                                    ? "Current"
                                    : undefined,
                              }))}
                            />
                          </div>

                          {/* Actions */}
                          <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <button
                              onClick={async () => {
                                const newArchived = !voice.is_archived;
                                if (
                                  !newArchived ||
                                  confirm(
                                    "Are you sure you want to archive this voice?",
                                  )
                                ) {
                                  try {
                                    const formData = new FormData();
                                    formData.append(
                                      "is_archived",
                                      newArchived.toString(),
                                    );
                                    const res = await fetch(
                                      `${API_BASE_URL}/companies/admin_workspace/voices/${voice.id}`,
                                      {
                                        method: "PATCH",
                                        headers: {
                                          Authorization: `Bearer ${localStorage.getItem("zenaipex_token")}`,
                                        },
                                        body: formData,
                                      },
                                    );
                                    if (res.ok) {
                                      setCustomVoices((prev) =>
                                        prev.map((v) =>
                                          v.id === voice.id
                                            ? { ...v, is_archived: newArchived }
                                            : v,
                                        ),
                                      );
                                      if (
                                        voiceFilter === "active" &&
                                        newArchived
                                      ) {
                                        setSelectedVoiceId(null);
                                      }
                                    }
                                  } catch (e) {
                                    setPreviewError("Failed to archive voice");
                                  }
                                }
                              }}
                              className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold flex justify-center items-center gap-1.5 transition-colors ${voice.is_archived ? "text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-100" : "text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-100"}`}
                            >
                              <Archive className="h-3 w-3" />{" "}
                              {voice.is_archived ? "Unarchive" : "Archive"}
                            </button>
                            <button
                              onClick={async () => {
                                if (
                                  confirm(
                                    "Are you sure you want to permanently delete this voice?",
                                  )
                                ) {
                                  try {
                                    const res = await fetch(
                                      `${API_BASE_URL}/companies/admin_workspace/voices/${voice.id}`,
                                      {
                                        method: "DELETE",
                                        headers: {
                                          Authorization: `Bearer ${localStorage.getItem("zenaipex_token")}`,
                                        },
                                      },
                                    );
                                    if (res.ok) {
                                      setSelectedVoiceId(null);
                                      setCustomVoices((prev) =>
                                        prev.filter((v) => v.id !== voice.id),
                                      );
                                    }
                                  } catch (e) {
                                    setPreviewError("Failed to delete voice");
                                  }
                                }
                              }}
                              className="flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 flex justify-center items-center gap-1.5 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" /> Delete
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────── SLIDE-OVER AGENT CONFIGURATION DRAWER ─────────────────── */}
      {selectedAgentForEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                  Platform Admin Config
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {selectedAgentForEdit.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Workspace: {selectedAgentForEdit.company_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedAgentForEdit(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body Form */}
            <form
              id="agent-edit-form"
              onSubmit={handleSaveAgentDetails}
              className="p-6 space-y-5 overflow-y-auto flex-1"
            >
              {/* Agent Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Agent Display Name
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, name: e.target.value })
                  }
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Description / Role
                </label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      description: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Voice Persona Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Voice Persona (Sarvam Bulbul v3)</span>
                  <span className="text-[11px] font-normal text-emerald-600">
                    11 Available
                  </span>
                </label>
                <SmartSelect
                  value={editFormData.tts_voice}
                  onChange={(value) =>
                    setEditFormData({ ...editFormData, tts_voice: value })
                  }
                  searchPlaceholder="Search voice…"
                  options={[
                    ...customVoices.map((v) => ({
                      value: v.id,
                      label: v.name,
                      group: `My Cloned Voices (${customVoices.length})`,
                      badge: "Cloned",
                    })),
                    ...VOICES.map((v) => ({
                      value: v.id,
                      label: v.name,
                      group: `${v.gender} Voices`,
                      description: v.tone,
                      badge: v.gender,
                    })),
                  ]}
                />
              </div>

              {/* Phone voice runtime */}
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">
                      Phone Voice Runtime
                    </label>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Only one mode remains active; new calls use the selected flow.
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Single select
                  </span>
                </div>
                <div className="grid gap-2">
                  {VOICE_RUNTIME_MODES.map((mode) => {
                    const selected = editFormData.voice_engine === mode.value;
                    const toneClasses =
                      mode.tone === "blue"
                        ? selected
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                          : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"
                        : mode.tone === "emerald"
                          ? selected
                            ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                            : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40"
                          : selected
                            ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100"
                            : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/40";
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() =>
                          setEditFormData({
                            ...editFormData,
                            voice_engine: mode.value,
                          })
                        }
                        className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${toneClasses}`}
                      >
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-current" : "border-slate-300"}`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-current" : "bg-transparent"}`}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">
                              {mode.shortLabel}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selected ? "bg-white/80 text-slate-700" : "bg-slate-100 text-slate-500"}`}
                            >
                              {mode.badge}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[11px] font-semibold text-slate-600">
                            {mode.label}
                          </span>
                          <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                            {mode.detail}
                          </span>
                        </span>
                        {selected && (
                          <Check
                            className="h-4 w-4 shrink-0 text-current"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500">
                  Recommended: Gemini + Clone. If Gemini STT fails, the configured
                  fallback provider is used automatically.
                </p>
              </div>

              {/* LLM Model Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  AI Intelligence Model (Brain)
                </label>
                <SmartSelect
                  value={editFormData.llm_model}
                  onChange={(value) =>
                    setEditFormData({ ...editFormData, llm_model: value })
                  }
                  searchPlaceholder="Search models…"
                  options={[
                    {
                      value: "sarvam-105b",
                      label: "Sarvam AI · sarvam-105b",
                      badge: "Recommended",
                    },
                    {
                      value: "sarvam-105b-conversations",
                      label: "Sarvam AI · sarvam-105b-conversations",
                    },
                    {
                      value: "gemini-1.5-flash",
                      label: "Google · gemini-1.5-flash",
                    },
                    {
                      value: "gemini-2.0-flash",
                      label: "Google · gemini-2.0-flash",
                    },
                    {
                      value: "gemini-3.5-flash-lite",
                      label: "Google · gemini-3.5-flash-lite",
                      badge: "Fast Voice",
                    },
                    {
                      value: "llama-3.3-70b-versatile",
                      label: "Groq · llama-3.3-70b-versatile",
                      badge: "Ultra-Fast",
                    },
                  ]}
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Agent Deployment Status
                </label>
                <SmartSelect
                  value={editFormData.status}
                  onChange={(value) =>
                    setEditFormData({ ...editFormData, status: value })
                  }
                  searchable={false}
                  options={[
                    {
                      value: "active",
                      label: "Active",
                      description: "Serving customer calls and voice mode",
                      badge: "Live",
                    },
                    {
                      value: "draft",
                      label: "Draft / Paused",
                      description: "Hidden from callers",
                      badge: "Paused",
                    },
                  ]}
                />
              </div>

              {/* Language */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Default Language
                </label>
                <SmartSelect
                  value={editFormData.default_language}
                  onChange={(value) =>
                    setEditFormData({
                      ...editFormData,
                      default_language: value,
                    })
                  }
                  searchable={false}
                  options={[
                    {
                      value: "en-IN",
                      label: "Hinglish / Indian English",
                      badge: "en-IN",
                    },
                    { value: "hi-IN", label: "Pure Hindi", badge: "hi-IN" },
                    { value: "gu-IN", label: "Gujarati", badge: "gu-IN" },
                  ]}
                />
              </div>
              <div
                className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-slate-700 space-y-2"
                aria-live="polite"
              >
                <strong className="text-emerald-900">
                  Review agent impact before saving
                </strong>
                {editFormData.tts_voice !==
                  (selectedAgentForEdit.tts_voice || "ritu") && (
                  <p>
                    Voice: {selectedAgentForEdit.tts_voice || "ritu"} →{" "}
                    {editFormData.tts_voice}. Future responses will use the
                    selected voice.
                  </p>
                )}
                {editFormData.llm_model !==
                  (selectedAgentForEdit.llm_model || "sarvam-105b") && (
                  <p>
                    Model: {selectedAgentForEdit.llm_model || "sarvam-105b"} →{" "}
                    {editFormData.llm_model}. Future requests will use this
                    model.
                  </p>
                )}
                {editFormData.status !==
                  (selectedAgentForEdit.status || "active") && (
                  <p
                    className={
                      editFormData.status === "draft"
                        ? "text-amber-800 font-semibold"
                        : ""
                    }
                  >
                    Status: {selectedAgentForEdit.status || "active"} →{" "}
                    {editFormData.status}.{" "}
                    {editFormData.status === "draft"
                      ? "The agent will stop serving new calls."
                      : "The agent can serve new calls."}
                  </p>
                )}
                {editFormData.default_language !==
                  (selectedAgentForEdit.default_language || "en-IN") && (
                  <p>
                    Default language:{" "}
                    {selectedAgentForEdit.default_language || "en-IN"} →{" "}
                    {editFormData.default_language}.
                  </p>
                )}
                {editFormData.tts_voice ===
                  (selectedAgentForEdit.tts_voice || "ritu") &&
                  editFormData.llm_model ===
                    (selectedAgentForEdit.llm_model || "sarvam-105b") &&
                  editFormData.status ===
                    (selectedAgentForEdit.status || "active") &&
                  editFormData.default_language ===
                    (selectedAgentForEdit.default_language || "en-IN") && (
                    <p>Voice, model, status and language are unchanged.</p>
                  )}
              </div>
            </form>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/80">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedAgentForEdit(null)}
                className="rounded-xl h-10 px-5 text-xs font-bold text-slate-600"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="agent-edit-form"
                disabled={isSavingAgent}
                className="rounded-xl h-10 px-6 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
              >
                {isSavingAgent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save Agent Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
