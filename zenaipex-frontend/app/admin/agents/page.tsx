"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
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
import dynamic from "next/dynamic";

const AgentConfigDrawer = dynamic(
  () => import("@/components/agents/AgentConfigDrawer"),
  { ssr: false, loading: () => null }
);

const VoiceCatalogTabs = dynamic(
  () => import("@/components/agents/VoiceCatalogTabs"),
  {
    ssr: false,
    loading: () => (
      <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        <span className="text-xs font-semibold">Loading Voice Catalog…</span>
      </div>
    ),
  }
);

const CustomVoiceGallery = dynamic(
  () => import("@/components/agents/CustomVoiceGallery"),
  {
    ssr: false,
    loading: () => (
      <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        <span className="text-xs font-semibold">Loading Voice Studio…</span>
      </div>
    ),
  }
);
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

export type VoicePersonaStyle = "all" | "professional" | "cold" | "natural" | "human" | "indian";

const GEMINI_VOICES_DATA: [string, string, "Male" | "Female", ("professional" | "cold" | "natural" | "human" | "indian")[], string][] = [
  ["Zephyr", "Bright", "Female", ["natural", "human", "indian"], "Uplifting customer greeting, active support"],
  ["Puck", "Upbeat", "Male", ["natural", "indian"], "Dynamic assistant, enthusiastic sales"],
  ["Charon", "Informative", "Male", ["professional", "cold", "indian"], "Executive advisory, formal corporate, cold calling"],
  ["Kore", "Firm", "Female", ["professional", "cold", "indian"], "Composed corporate reception, firm notifications"],
  ["Fenrir", "Excitable", "Male", ["cold"], "High-tempo outbound push, urgent notices"],
  ["Leda", "Youthful", "Female", ["human", "natural"], "E-commerce, consumer app guides, friendly chat"],
  ["Orus", "Firm", "Male", ["cold", "professional"], "Cold calling, debt recovery, authoritative operations"],
  ["Aoede", "Breezy", "Female", ["natural", "indian", "human"], "Everyday natural support, popular Hindi/Hinglish calls"],
  ["Callirrhoe", "Easy-going", "Female", ["natural", "human"], "Relaxed customer service, travel, hospitality"],
  ["Autonoe", "Bright", "Female", ["natural"], "Cheerful consumer assist, lifestyle, education"],
  ["Enceladus", "Breathy", "Male", ["human", "natural"], "Calm, soothing, patient customer care"],
  ["Iapetus", "Clear", "Male", ["professional"], "Crisp technical support, business consulting"],
  ["Umbriel", "Easy-going", "Male", ["natural", "human"], "Approachable casual support, tech onboarding"],
  ["Algieba", "Smooth", "Female", ["professional"], "Polished corporate reception, luxury brand concierge"],
  ["Despina", "Smooth", "Female", ["professional"], "Sophisticated enterprise B2B, legal/financial intake"],
  ["Erinome", "Clear", "Female", ["cold", "professional"], "Direct matter-of-fact notifications, cold outreach"],
  ["Algenib", "Gravelly", "Male", ["cold"], "Deep authoritative baritone, logistics, dispatch"],
  ["Rasalgethi", "Informative", "Male", ["professional"], "News-anchor authoritative, market reporting"],
  ["Laomedeia", "Upbeat", "Female", ["natural"], "Retail promotions, marketing campaigns, booking"],
  ["Achernar", "Soft", "Male", ["human"], "Thoughtful patient counseling, healthcare scheduling"],
  ["Alnilam", "Firm", "Male", ["professional", "cold"], "Disciplined banking updates, security verification"],
  ["Schedar", "Even", "Male", ["professional"], "Balanced neutral voice, automated dispatch"],
  ["Gacrux", "Mature", "Male", ["professional"], "Senior advisor persona, dependable enterprise trust"],
  ["Pulcherrima", "Forward", "Female", ["cold"], "Bold assertive outbound sales, direct acquisition"],
  ["Achird", "Friendly", "Male", ["human", "natural", "indian"], "Warm friendly helper, reliable customer support"],
  ["Zubenelgenubi", "Casual", "Male", ["natural", "indian"], "Everyday peer conversational, Hinglish friendly"],
  ["Vindemiatrix", "Gentle", "Female", ["human"], "Gentle healthcare, patient reminders, compassionate care"],
  ["Sadachbia", "Lively", "Female", ["natural"], "Expressive animated assistant, entertainment"],
  ["Sadaltager", "Knowledgeable", "Male", ["professional"], "Expert tech guide, corporate trainer, advisory"],
  ["Sulafat", "Warm", "Female", ["human", "indian"], "Warm empathetic care, VIP concierge, reassuring support"],
];

const GEMINI_VOICES = GEMINI_VOICES_DATA.map(([name, tone, gender, styles, useCase]) => ({
  id: name.toLowerCase(),
  name,
  tone,
  gender,
  styles,
  useCase,
  description: `Gemini Live ${gender.toLowerCase()} voice with a ${tone.toLowerCase()} delivery. Best for: ${useCase}.`,
}));

const AZURE_VOICES = [
  ["hi-IN-AaravNeural", "Aarav", "Hindi (India)", "Male"],
  ["hi-IN-AnanyaNeural", "Ananya", "Hindi (India)", "Female"],
  ["hi-IN-AartiNeural", "Aarti", "Hindi (India)", "Female"],
  ["hi-IN-ArjunNeural", "Arjun", "Hindi (India)", "Male"],
  ["hi-IN-KavyaNeural", "Kavya", "Hindi (India)", "Female"],
  ["hi-IN-KunalNeural", "Kunal", "Hindi (India)", "Male"],
  ["hi-IN-RehaanNeural", "Rehaan", "Hindi (India)", "Male"],
  ["hi-IN-SwaraNeural", "Swara", "Hindi (India)", "Female"],
  ["hi-IN-MadhurNeural", "Madhur", "Hindi (India)", "Male"],
  ["gu-IN-DhwaniNeural", "Dhwani", "Gujarati (India)", "Female"],
  ["gu-IN-NiranjanNeural", "Niranjan", "Gujarati (India)", "Male"],
].map(([id, name, language, gender]) => ({
  id,
  name,
  language,
  gender: gender as "Male" | "Female",
  tone: "Azure Standard Neural",
  description: `Azure standard neural ${gender.toLowerCase()} voice for ${language}. Free F0 quota eligible; Azure key required for live synthesis.`,
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
    "workforce" | "voices" | "gemini_voices" | "azure_voices" | "custom_voices"
  >("workforce");
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [voiceFilter, setVoiceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "Male" | "Female">(
    "all",
  );
  const [geminiGenderFilter, setGeminiGenderFilter] = useState<"all" | "Male" | "Female">(
    "all",
  );
  const [geminiStyleFilter, setGeminiStyleFilter] = useState<VoicePersonaStyle>("all");
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
        gender: voice.gender,
        provider: "Google Gemini Live",
        enabled: true,
        sampleText: `Hello, this is ${voice.name}, a ${voice.tone.toLowerCase()} Gemini Live voice.`,
        tone: voice.tone,
        description: voice.description,
        isGemini: true,
      })),
      ...AZURE_VOICES.map((av) => ({
        id: av.id,
        name: av.name,
        gender: av.gender,
        provider: "Azure Neural",
        enabled: true,
        sampleText: `Namaste, mein ${av.name} hoon, ek Azure Neural voice persona.`,
        tone: "Natural & Expressive",
        description: `${av.name} (${av.gender}) - ${av.language} Azure Neural voice.`,
        isAzure: true,
      })),
    ];
  }, [customVoices]);

  // Unified Multi-Catalog Voice Lookup (Sarvam 11, Custom Cloned, Gemini Live 30, Azure 11)
  const findVoiceObj = useCallback(
    (voiceIdOrName: string | undefined): Voice & { provider?: string; isCustom?: boolean; isGemini?: boolean; isAzure?: boolean } => {
      if (!voiceIdOrName) return { ...VOICES[0], provider: "Sarvam Bulbul" };
      const searchKey = voiceIdOrName.trim().toLowerCase();

      // 1. Check custom voices by voice_id, id, or name
      const customMatch = customVoices.find(
        (cv) =>
          (cv.voice_id && cv.voice_id.toLowerCase() === searchKey) ||
          (cv.id && cv.id.toLowerCase() === searchKey) ||
          (cv.name && cv.name.toLowerCase() === searchKey),
      );
      if (customMatch) {
        return {
          id: customMatch.voice_id || customMatch.id,
          name: customMatch.name,
          gender: (customMatch.gender as "Male" | "Female") || "Female",
          provider: "Sarvam Cloned",
          enabled: true,
          sampleText:
            customMatch.sample_text || "Hello! This is a sample of my cloned voice.",
          isCustom: true,
          tone: "Cloned Voice",
          description: customMatch.description || "Custom cloned voice persona",
        };
      }

      // 2. Check Gemini Live voices by id or name
      const geminiMatch = GEMINI_VOICES.find(
        (gv) =>
          gv.id.toLowerCase() === searchKey ||
          gv.name.toLowerCase() === searchKey,
      );
      if (geminiMatch) {
        return {
          id: geminiMatch.id,
          name: geminiMatch.name,
          gender: geminiMatch.gender,
          provider: "Google Gemini Live",
          enabled: true,
          sampleText: `Hello, this is ${geminiMatch.name}, a ${geminiMatch.tone.toLowerCase()} Gemini Live voice.`,
          tone: geminiMatch.tone,
          description: geminiMatch.description,
          isGemini: true,
        };
      }

      // 3. Check Azure Neural voices by id or name
      const azureMatch = AZURE_VOICES.find(
        (av) =>
          av.id.toLowerCase() === searchKey ||
          av.name.toLowerCase() === searchKey,
      );
      if (azureMatch) {
        return {
          id: azureMatch.id,
          name: azureMatch.name,
          gender: azureMatch.gender,
          provider: "Azure Neural",
          enabled: true,
          sampleText: `Namaste, mein ${azureMatch.name} hoon, ek Azure Neural voice persona.`,
          tone: "Natural & Expressive",
          description: `${azureMatch.name} (${azureMatch.gender}) - Azure Neural voice.`,
          isAzure: true,
        };
      }

      // 4. Check Sarvam 11 platform voices by id or name
      const sarvamMatch = VOICES.find(
        (v) =>
          v.id.toLowerCase() === searchKey ||
          v.name.toLowerCase() === searchKey,
      );
      if (sarvamMatch) {
        return {
          ...sarvamMatch,
          provider: "Sarvam Bulbul",
        };
      }

      // 5. Check platformVoices computed list
      const platMatch = platformVoices.find(
        (v) =>
          v.id.toLowerCase() === searchKey ||
          (v.name && v.name.toLowerCase() === searchKey),
      );
      if (platMatch) return platMatch;

      // 6. If starts with svc- (unmatched clone)
      if (searchKey.startsWith("svc-")) {
        return {
          id: searchKey,
          name: `Cloned Voice (${searchKey.slice(0, 8)})`,
          gender: "Female" as const,
          provider: "Sarvam Cloned",
          enabled: true,
          sampleText: "Hello! This is a sample of my cloned voice.",
          isCustom: true,
          tone: "Cloned Voice",
          description: "Custom cloned voice persona",
        };
      }

      // 7. Last resort default
      return { ...VOICES[0], provider: "Sarvam Bulbul" };
    },
    [customVoices, platformVoices],
  );

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

  useEffect(() => {
    setTypeFilter("all");
    setVoiceFilter("all");
  }, [activeTab]);

  const filteredVoices = useMemo(() => {
    let result = customVoices
      .filter(() => typeFilter === "all" || typeFilter === "cloned")
      .filter((v) => {
        if (voiceFilter === "active") return !v.is_archived;
        if (voiceFilter === "archived") return !!v.is_archived;
        return true;
      })
      .filter((v) => {
        if (genderFilter === "all") return true;
        const vGender = v.gender || "Female";
        return vGender.toLowerCase() === genderFilter.toLowerCase();
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
  }, [customVoices, typeFilter, voiceFilter, search, sortBy, genderFilter]);

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

  // Change Agent Voice Platform-Wide & Sync Engine Calibration
  const handleUpdateVoice = async (agentId: string, newVoiceId: string) => {
    setUpdatingAgentId(agentId);
    try {
      const curVoiceSetting = voiceSettings[newVoiceId] || {};
      const speedVal = curVoiceSetting.speed ?? 1.15;
      const volumeVal = curVoiceSetting.volume ?? 1.35;
      const clarityVal = curVoiceSetting.clarity ?? 94;
      const stabilityVal = curVoiceSetting.stability ?? 85;

      const targetAgent = agents.find((a) => a.id === agentId);
      const voiceObj = findVoiceObj(newVoiceId);
      const canonicalVoiceId = voiceObj.id || newVoiceId;

      // Deduce correct runtime engine matching voice persona and agent model
      let deducedEngine = "pipeline";
      const isGeminiLiveVoice = GEMINI_VOICES.some(
        (gv) =>
          gv.id.toLowerCase() === canonicalVoiceId.toLowerCase() ||
          gv.name.toLowerCase() === canonicalVoiceId.toLowerCase(),
      );
      const isCustomCloneVoice =
        customVoices.some(
          (cv) =>
            (cv.voice_id && cv.voice_id.toLowerCase() === canonicalVoiceId.toLowerCase()) ||
            (cv.id && cv.id.toLowerCase() === canonicalVoiceId.toLowerCase()) ||
            (cv.name && cv.name.toLowerCase() === canonicalVoiceId.toLowerCase()),
        ) || canonicalVoiceId.startsWith("svc-");

      if (isGeminiLiveVoice) {
        deducedEngine = "gemini_live";
      } else if (isCustomCloneVoice) {
        const llmModel = (targetAgent?.llm_model || "").toLowerCase();
        if (llmModel.startsWith("gemini")) {
          deducedEngine = "gemini_clone";
        } else {
          deducedEngine = "pipeline";
        }
      } else {
        deducedEngine = "pipeline";
      }

      // 1. Persist to MongoDB backend
      await fetchApi(`/admin/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          tts_voice: canonicalVoiceId,
          voice_engine: deducedEngine,
          gemini_voice: isGeminiLiveVoice ? canonicalVoiceId : undefined,
          voice_speed: speedVal,
          voice_volume: volumeVal,
          voice_clarity: clarityVal,
          voice_stability: stabilityVal,
        }),
      });

      // 2. Update local React state immediately
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...a,
                tts_voice: canonicalVoiceId,
                voice_engine: deducedEngine,
                gemini_voice: isGeminiLiveVoice ? canonicalVoiceId : a.gemini_voice,
                voice_speed: speedVal,
                voice_volume: volumeVal,
                voice_clarity: clarityVal,
                voice_stability: stabilityVal,
              }
            : a,
        ),
      );

      // 3. Immediately sync session storage cache & broadcast storage event
      try {
        const cached = sessionStorage.getItem("cached_admin_agents");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((a: any) =>
              a.id === agentId || a._id === agentId
                ? { ...a, tts_voice: canonicalVoiceId, voice_engine: deducedEngine }
                : a,
            );
            sessionStorage.setItem("cached_admin_agents", JSON.stringify(updated));
          }
        }
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(
          new CustomEvent("agent-voice-updated", {
            detail: { agentId, tts_voice: canonicalVoiceId, voice_engine: deducedEngine },
          }),
        );
      } catch (storageErr) {}

      setSuccessToast(
        `Assigned ${voiceObj.name} (${voiceObj.provider || "Voice"}) to ${targetAgent?.name || "Agent"}`,
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
    const result = agents.filter((agent) => {
      const matchesSearch =
        agent.name?.toLowerCase().includes(search.toLowerCase()) ||
        agent.company_name?.toLowerCase().includes(search.toLowerCase()) ||
        agent.company_id?.toLowerCase().includes(search.toLowerCase()) ||
        agent.tts_voice?.toLowerCase().includes(search.toLowerCase());

      const matchesCompany =
        companyFilter === "all" || agent.company_id === companyFilter;

      const matchesStatus =
        voiceFilter === "all" ||
        (voiceFilter === "active"
          ? agent.status === "active"
          : agent.status !== "active");

      const hasAssignedVoice = Boolean(agent.tts_voice);
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "assigned" && hasAssignedVoice) ||
        (typeFilter === "unassigned" && !hasAssignedVoice);

      const voiceObj = findVoiceObj(agent.tts_voice);
      const matchesGender =
        genderFilter === "all" || voiceObj.gender === genderFilter;

      let matchesQuick = true;
      if (quickFilter === "male") matchesQuick = voiceObj.gender === "Male";
      else if (quickFilter === "female")
        matchesQuick = voiceObj.gender === "Female";
      else if (quickFilter === "internal")
        matchesQuick = agent.company_name?.toLowerCase().includes("internal");

      return (
        matchesSearch &&
        matchesCompany &&
        matchesStatus &&
        matchesType &&
        matchesGender &&
        matchesQuick
      );
    });

    if (sortBy === "az") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "oldest") {
      result.reverse();
    }
    return result;
  }, [
    agents,
    search,
    companyFilter,
    typeFilter,
    voiceFilter,
    sortBy,
    genderFilter,
    quickFilter,
  ]);

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
      ...AZURE_VOICES.map((voice) => ({
        value: voice.id,
        label: voice.name,
        description: `${voice.language} - ${voice.gender}`,
        badge: "Azure",
        group: "Azure Neural voices",
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

  const totalVoiceCount =
    VOICES.length + GEMINI_VOICES.length + AZURE_VOICES.length + customVoices.length;

  const voiceTypeOptions =
    activeTab === "voices"
      ? [
          { value: "all", label: "All Types" },
          { value: "platform", label: "Platform" },
        ]
      : activeTab === "gemini_voices"
        ? [
            { value: "all", label: "All Types" },
            { value: "gemini", label: "Gemini" },
          ]
        : activeTab === "azure_voices"
          ? [
              { value: "all", label: "All Types" },
              { value: "azure", label: "Azure F0" },
            ]
        : activeTab === "custom_voices"
          ? [
              { value: "all", label: "All Types" },
              { value: "cloned", label: "Cloned" },
            ]
          : [
              { value: "all", label: "All Types" },
              { value: "assigned", label: "Assigned" },
              { value: "unassigned", label: "Unassigned" },
            ];

  const orderedPlatformVoices = [...VOICES]
    .filter(
      (voice) =>
        typeFilter === "all" || typeFilter === "platform",
    )
    .filter(
      (voice) =>
        genderFilter === "all" || voice.gender === genderFilter,
    )
    .filter(
      (voice) =>
        !search.trim() ||
        `${voice.name} ${voice.tone} ${voice.gender}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sortBy === "az"
        ? a.name.localeCompare(b.name)
        : sortBy === "oldest"
          ? b.name.localeCompare(a.name)
          : 0,
    );

  const orderedGeminiVoices = [...GEMINI_VOICES]
    .filter((voice) => typeFilter === "all" || typeFilter === "gemini")
    .filter(
      (voice) =>
        geminiGenderFilter === "all" || voice.gender === geminiGenderFilter,
    )
    .filter(
      (voice) =>
        geminiStyleFilter === "all" || voice.styles.includes(geminiStyleFilter as any),
    )
    .filter(
      (voice) =>
        !search.trim() ||
        `${voice.name} ${voice.tone} ${voice.gender} ${voice.useCase} ${voice.styles.join(" ")}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sortBy === "az"
        ? a.name.localeCompare(b.name)
        : sortBy === "oldest"
          ? b.name.localeCompare(a.name)
          : 0,
    );

  const orderedAzureVoices = [...AZURE_VOICES]
    .filter((voice) => typeFilter === "all" || typeFilter === "azure")
    .filter(
      (voice) =>
        !search.trim() ||
        `${voice.name} ${voice.id} ${voice.language} ${voice.gender}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sortBy === "az"
        ? a.name.localeCompare(b.name)
        : sortBy === "oldest"
          ? b.name.localeCompare(a.name)
          : 0,
    );

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

      {/* ── Executive Header ───────────────────────────────────────────── */}
      <div className={org.pageHeader}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Bot className="h-6 w-6 text-emerald-600" />
            Agents & Voices
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {agents.length} agents · {totalVoiceCount} voices
            </span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Autonomous AI personas, neural cloned voices & conversational models
          </p>
        </div>
        <div className={org.toolbar}>
          <button
            onClick={() => {
              loadAgents();
              loadCustomVoices();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsVoiceStudioOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold transition-colors shadow-xs"
          >
            <Mic className="h-3.5 w-3.5" /> Clone Voice
          </button>
        </div>
      </div>

      {/* ── Standard Unified KPI Cards ─────────────────────────────────── */}
      <div className={org.metrics} aria-label="Agent summary">
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Bot size={17} />
          </span>
          <span className={org.metricLabel}>Total Agents</span>
          <strong className={org.metricValue}>{agents.length}</strong>
          <span className={org.metricSub}>
            {agents.filter((a) => a.status === "active").length} active deployed
          </span>
        </div>

        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Building2 size={17} />
          </span>
          <span className={org.metricLabel}>Workspaces</span>
          <strong className={org.metricValue}>{uniqueCompanies.length}</strong>
          <span className={org.metricSub}>Distinct enterprise tenants</span>
        </div>

        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Mic size={17} />
          </span>
          <span className={org.metricLabel}>Voice Library</span>
          <strong className={org.metricValue}>{totalVoiceCount}</strong>
          <span className={org.metricSub}>
            {GEMINI_VOICES.length} Gemini · {VOICES.length} Studio · {customVoices.length} Cloned
          </span>
        </div>

        <div className={org.metric}>
          <span className={org.metricIcon}>
            <CheckCircle2 size={17} />
          </span>
          <span className={org.metricLabel}>Status Review</span>
          <strong className={org.metricValue}>
            {attentionCount ? `${attentionCount} Review` : "All Healthy"}
          </strong>
          <span className={org.metricSub}>
            {attentionCount ? "Agents need review" : "Active & operational"}
          </span>
        </div>
      </div>

      {/* ─────────────────── UNIFIED NAVIGATION & COMMAND BAR ─────────────────── */}
      <div className={org.surface}>
        {/* Row 1: Section Tabs & Global Search */}
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
              <span className={org.tabCount}>{VOICES.length}</span>
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
              onClick={() => setActiveTab("azure_voices")}
              aria-pressed={activeTab === "azure_voices"}
              className={org.sectionTab}
            >
              <Sparkles className="h-4 w-4" />
              Azure Voices
              <span className={org.tabCount}>{AZURE_VOICES.length}</span>
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

        {/* Row 2: Unified Command & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
          {/* Left: Dynamic Segmented Pills based on activeTab */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeTab === "gemini_voices" && (
              <div className="flex flex-col gap-2 w-full">
                {/* Row 1: Style / Persona Category Filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-emerald-600" /> Style:
                  </span>
                  {[
                    { id: "all", label: "All Styles", icon: "🌟", count: GEMINI_VOICES.length },
                    { id: "professional", label: "Professional", icon: "💼", count: GEMINI_VOICES.filter(v => v.styles.includes("professional")).length },
                    { id: "cold", label: "Cold Calling", icon: "🧊", count: GEMINI_VOICES.filter(v => v.styles.includes("cold")).length },
                    { id: "natural", label: "Natural", icon: "🌿", count: GEMINI_VOICES.filter(v => v.styles.includes("natural")).length },
                    { id: "human", label: "Human & Warm", icon: "💖", count: GEMINI_VOICES.filter(v => v.styles.includes("human")).length },
                    { id: "indian", label: "Indian Tuned", icon: "🇮🇳", count: GEMINI_VOICES.filter(v => v.styles.includes("indian")).length },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setGeminiStyleFilter(st.id as any)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        geminiStyleFilter === st.id
                          ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500/20"
                          : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <span>{st.icon}</span>
                      <span>{st.label}</span>
                      <span className={`text-[10px] px-1 py-0.2 rounded-full font-semibold ${
                        geminiStyleFilter === st.id ? "bg-emerald-800 text-emerald-100" : "bg-slate-100 text-slate-500"
                      }`}>
                        {st.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Row 2: Gender Selector */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                    Gender:
                  </span>
                  <button
                    type="button"
                    onClick={() => setGeminiGenderFilter("all")}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                      geminiGenderFilter === "all"
                        ? "bg-slate-800 text-white"
                        : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100"
                    }`}
                  >
                    All ({GEMINI_VOICES.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeminiGenderFilter("Male")}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                      geminiGenderFilter === "Male"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-slate-600 border border-slate-200/80 hover:text-blue-700 hover:border-blue-200"
                    }`}
                  >
                    <span>♂ Male</span>
                    <span className="text-[10px] opacity-80">
                      ({GEMINI_VOICES.filter((v) => v.gender === "Male").length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeminiGenderFilter("Female")}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                      geminiGenderFilter === "Female"
                        ? "bg-purple-600 text-white"
                        : "bg-white text-slate-600 border border-slate-200/80 hover:text-purple-700 hover:border-purple-200"
                    }`}
                  >
                    <span>♀ Female</span>
                    <span className="text-[10px] opacity-80">
                      ({GEMINI_VOICES.filter((v) => v.gender === "Female").length})
                    </span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "voices" && (
              <>
                <button
                  type="button"
                  onClick={() => setGenderFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    genderFilter === "all"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100"
                  }`}
                >
                  All Personas ({VOICES.length})
                </button>
                <button
                  type="button"
                  onClick={() => setGenderFilter("Male")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    genderFilter === "Male"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:text-blue-700 hover:border-blue-200"
                  }`}
                >
                  <span>♂ Male</span>
                  <span className="text-[10px] opacity-80 font-semibold">
                    ({VOICES.filter((v) => v.gender === "Male").length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setGenderFilter("Female")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    genderFilter === "Female"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:text-purple-700 hover:border-purple-200"
                  }`}
                >
                  <span>♀ Female</span>
                  <span className="text-[10px] opacity-80 font-semibold">
                    ({VOICES.filter((v) => v.gender === "Female").length})
                  </span>
                </button>
              </>
            )}

            {activeTab === "workforce" && (
              <>
                <button
                  type="button"
                  onClick={() => { setQuickFilter("all"); setGenderFilter("all"); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    quickFilter === "all"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100"
                  }`}
                >
                  All ({agents.length})
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickFilter("male"); setGenderFilter("Male"); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    quickFilter === "male"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:text-blue-700 hover:border-blue-200"
                  }`}
                >
                  <span>♂ Male</span>
                  <span className="text-[10px] opacity-80 font-semibold">
                    ({agents.filter((a) => findVoiceObj(a.tts_voice).gender === "Male").length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickFilter("female"); setGenderFilter("Female"); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    quickFilter === "female"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:text-purple-700 hover:border-purple-200"
                  }`}
                >
                  <span>♀ Female</span>
                  <span className="text-[10px] opacity-80 font-semibold">
                    ({agents.filter((a) => findVoiceObj(a.tts_voice).gender === "Female").length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuickFilter("internal")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    quickFilter === "internal"
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:text-emerald-700 hover:border-emerald-200"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Internal</span>
                </button>
              </>
            )}

            {activeTab === "custom_voices" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setGenderFilter("all");
                    setVoiceFilter("all");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    genderFilter === "all" && voiceFilter === "all"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100"
                  }`}
                >
                  All ({customVoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenderFilter("Male");
                    setVoiceFilter("all");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    genderFilter === "Male"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:text-blue-700 hover:border-blue-200"
                  }`}
                >
                  <span>♂ Male</span>
                  <span className="text-[10px] opacity-80 font-semibold">
                    ({customVoices.filter((v) => (v.gender || "Female").toLowerCase() === "male").length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenderFilter("Female");
                    setVoiceFilter("all");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    genderFilter === "Female"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:text-purple-700 hover:border-purple-200"
                  }`}
                >
                  <span>♀ Female</span>
                  <span className="text-[10px] opacity-80 font-semibold">
                    ({customVoices.filter((v) => (v.gender || "Female").toLowerCase() === "female").length})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenderFilter("all");
                    setVoiceFilter("active");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    voiceFilter === "active" && genderFilter === "all"
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:text-emerald-700 hover:border-emerald-200"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Active</span>
                  <span className="text-[10px] opacity-80 font-semibold">
                    ({customVoices.filter((v) => !v.is_archived).length})
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Right: Dropdowns, View Switcher, Clone Button, Refresh */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            {activeTab === "workforce" && (
              <SmartSelect
                value={companyFilter}
                onChange={setCompanyFilter}
                searchPlaceholder="Search company…"
                className="w-36 [&>button]:h-8 [&>button]:text-[11px]"
                options={[
                  { value: "all", label: `All Companies (${uniqueCompanies.length})` },
                  ...uniqueCompanies.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            )}

            {/* Dropdowns */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
              <SmartSelect
                value={voiceFilter}
                onChange={setVoiceFilter}
                searchable={false}
                className="w-24 [&>button]:h-7 [&>button]:border-transparent [&>button]:bg-transparent [&>button]:px-2 [&>button]:shadow-none [&>button]:text-[11px]"
                options={[
                  { value: "all", label: "All Status" },
                  { value: "active", label: "Active" },
                  { value: "archived", label: "Archived" },
                ]}
              />
              <div className="h-3.5 w-px bg-slate-200" />
              <SmartSelect
                value={sortBy}
                onChange={setSortBy}
                searchable={false}
                className="w-24 [&>button]:h-7 [&>button]:border-transparent [&>button]:bg-transparent [&>button]:px-2 [&>button]:shadow-none [&>button]:text-[11px]"
                options={[
                  { value: "newest", label: "Newest" },
                  { value: "oldest", label: "Oldest" },
                  { value: "az", label: "A-Z" },
                ]}
              />
            </div>

            {/* List / Grid toggle */}
            <div className="flex items-center rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  viewMode === "list"
                    ? "bg-slate-100 text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                title="List View"
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  viewMode === "grid"
                    ? "bg-slate-100 text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-700"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </button>
            </div>

            {/* Clone Custom Voice CTA Button */}
            <Button
              onClick={() => {
                setIsVoiceStudioOpen(true);
              }}
              size="sm"
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl h-8 px-3 text-xs font-bold shadow-xs gap-1.5"
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Clone Voice</span>
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadAgents}
              disabled={isLoading}
              className="h-8 px-2.5 rounded-xl border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs"
              title="Refresh platform data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* ─────────────────── TAB 1: ENTERPRISE WORKFORCE DIRECTORY ─────────────────── */}
      {activeTab === "workforce" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-0">
          <section
            className="border-b border-slate-100 bg-slate-50/40 px-4 py-3"
            aria-label="Compare voice personas"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Compare voice personas</h2>
                <p className="text-[11px] text-slate-500">Compare two voices before assigning one to an agent.</p>
              </div>
              <span className="hidden rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 sm:inline-flex">Preview before assign</span>
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {compareVoices.map((voiceId, index) => {
                const voice = getVoiceForPicker(voiceId);
                return (
                  <div key={index} className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                    <span className="w-12 shrink-0 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Voice {index === 0 ? "A" : "B"}</span>
                    <SmartSelect
                      value={voice.id}
                      onChange={(value) =>
                        setCompareVoices((current) =>
                          index === 0 ? [value, current[1]] : [current[0], value],
                        )
                      }
                      searchPlaceholder="Search voices…"
                      options={voicePickerOptions}
                      className="min-w-0 flex-1 [&>button]:h-8 [&>button]:text-[11px]"
                    />
                    <span className="hidden max-w-[180px] truncate text-[10px] text-slate-500 xl:block" title={voice.description}>{voice.tone}</span>
                    <button type="button" onClick={() => handlePlayVoicePreview(voice)} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-800">
                      {previewingVoiceId === voice.id ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                      {previewingVoiceId === voice.id ? "Stop" : "Listen"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {viewMode === "grid" && (
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAgents.map((agent) => {
                const voiceObj = findVoiceObj(agent.tts_voice);
                const isPreviewingThis = previewingVoiceId === voiceObj.id;
                const isMale = voiceObj.gender === "Male";
                const isFemale = voiceObj.gender === "Female";

                return (
                  <article
                    key={agent.id}
                    className={`relative flex min-h-[260px] flex-col justify-between space-y-3 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all ${
                      isPreviewingThis
                        ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg"
                        : "border-slate-200/80 hover:border-emerald-300 hover:shadow-md"
                    }`}
                  >
                    {isPreviewingThis && (
                      <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />
                    )}

                    <div>
                      {/* Top Row: Avatar, Name, Badges, Status */}
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold shadow-sm ${
                              isMale
                                ? "border-blue-200 bg-blue-50 text-blue-800"
                                : isFemale
                                  ? "border-purple-200 bg-purple-50 text-purple-800"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
                            }`}
                          >
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold tracking-tight text-slate-900 truncate">
                                {agent.name}
                              </h3>
                              <span className="rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                                AI Agent
                              </span>
                            </div>
                            <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 truncate max-w-[170px]">
                              {agent.company_name}
                            </span>
                          </div>
                        </div>

                        {agent.status === "active" ? (
                          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            Idle
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <p className="mb-2.5 text-[11px] leading-relaxed text-slate-600 line-clamp-2 min-h-[34px]">
                        {agent.description || `Configured for ${agent.company_name}`}
                      </p>

                      {/* Spec Box */}
                      <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 p-2 text-[10px] font-mono text-emerald-700">
                        <span className="font-bold">AI Model:</span>
                        <span className="truncate max-w-[130px]">{agent.llm_model || "sarvam-105b"}</span>
                        <span>{agent.default_language || "en-IN"}</span>
                      </div>
                    </div>

                    {/* Bottom Action Section */}
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-semibold text-slate-500">
                            Assigned Voice Persona:
                          </label>
                          <span className="text-[10px] font-bold text-emerald-700 truncate max-w-[120px]">
                            {voiceObj.name}
                          </span>
                        </div>
                        <SmartSelect
                          value={agent.tts_voice || voiceObj.id}
                          disabled={updatingAgentId === agent.id}
                          searchable
                          searchPlaceholder="Search voice…"
                          onChange={(value) => handleUpdateVoice(agent.id, value)}
                          options={[
                            ...customVoices.map((voice) => ({
                              value: voice.voice_id || voice.id,
                              label: voice.name,
                              group: `My Cloned Voices (${customVoices.length})`,
                              badge: "Cloned",
                            })),
                            ...VOICES.map((voice) => ({
                              value: voice.id,
                              label: voice.name,
                              group: `${voice.gender} Voice Personas`,
                              description: voice.tone,
                              badge: voice.gender,
                            })),
                            ...GEMINI_VOICES.map((voice) => ({
                              value: voice.id,
                              label: voice.name,
                              group: `Gemini Live Voices (${GEMINI_VOICES.length})`,
                              description: voice.tone,
                              badge: "Gemini",
                            })),
                          ]}
                          menuWidth={300}
                          className="w-full [&>button]:h-9 [&>button]:text-[11px]"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePlayVoicePreview(voiceObj, agent)}
                          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl h-9 text-[11px] font-bold transition-all ${
                            isPreviewingThis
                              ? "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/20"
                              : "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800"
                          }`}
                        >
                          {isPreviewingThis ? (
                            <>
                              <Square className="h-3 w-3 fill-current" />
                              <span>Stop audio</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 fill-current" />
                              <span>Listen voice</span>
                            </>
                          )}
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDrawer(agent)}
                          className="h-9 px-3 rounded-xl text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 gap-1.5 shadow-xs"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          <span>Configure</span>
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Table */}
          {viewMode === "list" && <div className="overflow-x-auto">
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
                    const voiceObj = findVoiceObj(agent.tts_voice);
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
          </div>}
        </div>
      )}

      {/* ─────────────────── TAB 2: VOICE CATALOGS (SARVAM / GEMINI / AZURE) ─────────────────── */}
      {(activeTab === "voices" || activeTab === "gemini_voices" || activeTab === "azure_voices") && (
        <VoiceCatalogTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          viewMode={viewMode}
          genderFilter={genderFilter}
          geminiStyleFilter={geminiStyleFilter}
          orderedPlatformVoices={orderedPlatformVoices}
          orderedGeminiVoices={orderedGeminiVoices}
          orderedAzureVoices={orderedAzureVoices}
          AZURE_VOICES={AZURE_VOICES}
          agents={agents}
          previewingVoiceId={previewingVoiceId}
          isPreviewLoading={isPreviewLoading}
          handlePlayVoicePreview={handlePlayVoicePreview}
          handleUpdateVoice={handleUpdateVoice}
          getVoiceAcoustics={getVoiceAcoustics}
          assignedAgentsForVoice={assignedAgentsForVoice}
        />
      )}

      {/* ─────────────────── TAB 3: CUSTOM VOICE STUDIO & GALLERY ─────────────────── */}
      {activeTab === "custom_voices" && (
        <CustomVoiceGallery
          isVoiceStudioOpen={isVoiceStudioOpen}
          setIsVoiceStudioOpen={setIsVoiceStudioOpen}
          loadCustomVoices={loadCustomVoices}
          filteredVoices={filteredVoices}
          viewMode={viewMode}
          selectedVoiceId={selectedVoiceId}
          setSelectedVoiceId={setSelectedVoiceId}
          getVoiceForPicker={getVoiceForPicker}
          previewingVoiceId={previewingVoiceId}
          handlePlayVoicePreview={handlePlayVoicePreview}
          assignedAgentsForVoice={assignedAgentsForVoice}
          agents={agents}
          handleUpdateVoice={handleUpdateVoice}
          isPreviewLoading={isPreviewLoading}
          setCustomVoices={setCustomVoices}
          setSuccessToast={setSuccessToast}
          setPreviewError={setPreviewError}
          voiceFilter={voiceFilter}
          testText={testText}
          setTestText={setTestText}
          isGeneratingVoiceId={isGeneratingVoiceId}
          testingCustomVoiceId={testingCustomVoiceId}
          setTestingCustomVoiceId={setTestingCustomVoiceId}
          isLivePlaying={isLivePlaying}
          setIsLivePlaying={setIsLivePlaying}
          testAudioSrc={testAudioSrc}
          voiceSettings={voiceSettings}
          gainNodesRef={gainNodesRef}
          handleTestCustomVoice={handleTestCustomVoice}
          testLanguage={testLanguage}
          setTestLanguage={setTestLanguage}
          playbackRate={playbackRate}
          handleVoiceParamChange={handleVoiceParamChange}
          triggerInstantAudioPreview={triggerInstantAudioPreview}
          sliderSaveStatus={sliderSaveStatus}
          isAudioLiveTuned={isAudioLiveTuned}
          updatingAgentId={updatingAgentId}
        />
      )}

      {/* ─────────────────── SLIDE-OVER AGENT CONFIGURATION DRAWER ─────────────────── */}
      {selectedAgentForEdit && (
        <AgentConfigDrawer
          agent={selectedAgentForEdit}
          onClose={() => setSelectedAgentForEdit(null)}
          editFormData={editFormData}
          setEditFormData={setEditFormData}
          onSubmit={handleSaveAgentDetails}
          isSaving={isSavingAgent}
          customVoices={customVoices}
          voiceRuntimeModes={VOICE_RUNTIME_MODES}
          voices={VOICES}
        />
      )}
    </div>
  );
}
