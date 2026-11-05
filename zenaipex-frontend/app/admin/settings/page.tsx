"use client";

import { useEffect, useState, useRef } from "react";
import {
  Settings2,
  Building2,
  ShieldCheck,
  BellRing,
  Bot,
  Sparkles,
  Upload,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  LockKeyhole,
  Clock3,
  Sliders,
  Globe2,
  Server,
  Zap,
  Radio,
  RadioTower,
  Smartphone,
  Send,
  Loader2,
  CalendarClock,
  MapPin,
  Mail,
  Phone,
  MessageSquare,
  Mic,
  Volume2,
  Check,
  RefreshCw,
  Power,
  FileText,
  ChevronRight,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import dynamic from "next/dynamic";

const BusinessTab = dynamic(() => import("@/components/settings/tabs/BusinessTab"), {
  ssr: false,
  loading: () => <PageLoadingSkeleton cards={2} />,
});
const ScheduleTab = dynamic(() => import("@/components/settings/tabs/ScheduleTab"), {
  ssr: false,
  loading: () => <PageLoadingSkeleton cards={2} />,
});
const VoiceTab = dynamic(() => import("@/components/settings/tabs/VoiceTab"), {
  ssr: false,
  loading: () => <PageLoadingSkeleton cards={2} />,
});
const BrandingTab = dynamic(() => import("@/components/settings/tabs/BrandingTab"), {
  ssr: false,
  loading: () => <PageLoadingSkeleton cards={2} />,
});
const MaintenanceTab = dynamic(() => import("@/components/settings/tabs/MaintenanceTab"), {
  ssr: false,
  loading: () => <PageLoadingSkeleton cards={2} />,
});
const AlertsTab = dynamic(() => import("@/components/settings/tabs/AlertsTab"), {
  ssr: false,
  loading: () => <PageLoadingSkeleton cards={2} />,
});
const SecurityTab = dynamic(() => import("@/components/settings/tabs/SecurityTab"), {
  ssr: false,
  loading: () => <PageLoadingSkeleton cards={2} />,
});
const AiTab = dynamic(() => import("@/components/settings/tabs/AiTab"), {
  ssr: false,
  loading: () => <PageLoadingSkeleton cards={2} />,
});

import SmartWeeklySchedule from "@/components/platform/settings/SmartWeeklySchedule";
import { SmartSelect } from "@/components/ui/smart-select";
import {
  GlobalSettings,
  getAdminSettings,
  updateAdminSettings,
  uploadPlatformLogo,
  removePlatformLogo,
  companySettingsApi,
  CompanyProfile,
  testGuardrail,
} from "@/lib/api/settings";
import { fetchApi, getCompanyLogoUrl, API_BASE_URL } from "@/lib/api/client";

const DEFAULT_SETTINGS: GlobalSettings = {
  type: "global",
  platform: {
    platform_name: "ZeniaOne",
    default_language: "en-IN",
    default_timezone: "Asia/Kolkata",
    accent_color: "#0C4A31",
  },
  ai_defaults: {
    default_provider: "sarvam",
    default_model: "sarvam-105b",
    default_token_limit: 1024,
    default_temperature: 0.7,
    profanity_filter_enabled: true,
    pii_redaction_enabled: true,
    prompt_injection_shield: true,
    strict_grounding: true,
    competitor_blocklist: "vapi, bland, synthflow, retell, elevenlabs",
    max_call_duration_minutes: 15,
  },
  security: {
    session_timeout_minutes: 60,
    require_strong_passwords: true,
  },
  notifications: {
    admin_notifications_enabled: true,
    system_alerts_enabled: true,
    security_alerts_enabled: true,
    whatsapp_number: "+919099887880",
    slack_webhook_url: "",
  },
  system: {
    maintenance_mode: false,
    maintenance_message: "System is currently undergoing maintenance. Please try again later.",
  },
};

const ACCENT_PALETTES = [
  { id: "emerald", label: "Emerald Cyber", hex: "#0C4A31", borderHex: "#10B981" },
  { id: "indigo", label: "Indigo Quantum", hex: "#4F46E5", borderHex: "#818CF8" },
  { id: "oceanic", label: "Oceanic Blue", hex: "#0284C7", borderHex: "#38BDF8" },
  { id: "violet", label: "Royal Violet", hex: "#7C3AED", borderHex: "#A78BFA" },
  { id: "obsidian", label: "Obsidian Dark", hex: "#18181B", borderHex: "#71717A" },
];

const SETTINGS_TABS = [
  { id: "business", label: "🏢 Business Profile & Logo", icon: Building2 },
  { id: "schedule", label: "⏰ Operating Hours & Time", icon: CalendarClock },
  { id: "voice", label: "🎙️ Voice, Greetings & Policy", icon: Mic },
  { id: "branding", label: "🎨 Theme & Accent Palette", icon: Sparkles },
  { id: "maintenance", label: "🛑 Maintenance & Kill-Switch", icon: RadioTower },
  { id: "alerts", label: "🔔 WhatsApp & Slack Alerts", icon: BellRing },
  { id: "security", label: "🛡️ Security Armor", icon: ShieldCheck },
  { id: "ai", label: "🤖 AI Guardrails", icon: Bot },
] as const;

const STANDARD_VOICES = [
  { value: "ritu", label: "Ritu (Warm & Professional · Hindi/English)" },
  { value: "priya", label: "Priya (Friendly & Clear · Hinglish)" },
  { value: "neha", label: "Neha (Energetic Support · English/Hindi)" },
  { value: "pooja", label: "Pooja (Calm & Empathetic · Hindi)" },
  { value: "shreya", label: "Shreya (Executive Tone · English)" },
  { value: "kavya", label: "Kavya (Soft & Polished · Gujarati/Hindi)" },
  { value: "rahul", label: "Rahul (Assertive & Confident · Hindi/English)" },
  { value: "rohan", label: "Rohan (Casual & Tech · English)" },
  { value: "aditya", label: "Aditya (Corporate Formal · Hindi/English)" },
  { value: "kabir", label: "Kabir (Deep & Authoritative · Hindi)" },
  { value: "amit", label: "Amit (Customer Care Lead · Hinglish)" },
];

const LANGUAGE_OPTIONS = [
  { value: "en-IN", label: "English (India · en-IN)" },
  { value: "hi-IN", label: "Hindi / Hinglish (hi-IN)" },
  { value: "gu-IN", label: "Gujarati (gu-IN)" },
  { value: "en-US", label: "English (US · en-US)" },
  { value: "en-GB", label: "English (UK · en-GB)" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST · +05:30)" },
  { value: "UTC", label: "UTC (Universal Coordinated Time)" },
  { value: "America/New_York", label: "America/New York (EST · -05:00)" },
  { value: "Europe/London", label: "Europe/London (GMT · +00:00)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST · +04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT · +08:00)" },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "business" | "schedule" | "voice" | "branding" | "maintenance" | "alerts" | "security" | "ai"
  >("business");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);

  // Companies & Workspace management
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [currentCompany, setCurrentCompany] = useState<CompanyProfile | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [customVoices, setCustomVoices] = useState<Array<{ id: string; name?: string; display_name?: string }>>([]);

  // Company editable fields
  const [compName, setCompName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [industry, setIndustry] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [businessEmail, setBusinessEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("India");
  const [address, setAddress] = useState("");
  const [businessDesc, setBusinessDesc] = useState("");

  // Voice & Greetings fields
  const [defaultLanguage, setDefaultLanguage] = useState("en-IN");
  const [defaultVoice, setDefaultVoice] = useState("ritu");
  const [inboundGreeting, setInboundGreeting] = useState("");
  const [outboundGreeting, setOutboundGreeting] = useState("");
  const [customerPolicies, setCustomerPolicies] = useState("");
  const [generatingGreeting, setGeneratingGreeting] = useState<"inbound" | "outbound" | null>(null);

  // Weekly Schedule
  const [scheduleData, setScheduleData] = useState<any>(null);

  // Logo state
  const [logoVersion, setLogoVersion] = useState(Date.now());
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const platformLogoInputRef = useRef<HTMLInputElement>(null);

  // Alert fields
  const [whatsappNumber, setWhatsappNumber] = useState("+919099887880");
  const [slackWebhook, setSlackWebhook] = useState("");

  // Guardrail Test Simulator state
  const [guardrailTestInput, setGuardrailTestInput] = useState("");
  const [guardrailTestResult, setGuardrailTestResult] = useState<{
    passed: boolean;
    flags: string[];
    sanitized: string;
    action: string;
    active_rules: Record<string, boolean>;
  } | null>(null);
  const [testingGuardrail, setTestingGuardrail] = useState(false);

  const handleTestGuardrail = async (presetText?: string) => {
    const textToTest = (presetText !== undefined ? presetText : guardrailTestInput).trim();
    if (!textToTest) return;
    if (presetText !== undefined) setGuardrailTestInput(presetText);
    setTestingGuardrail(true);
    setGuardrailTestResult(null);
    try {
      const res = await testGuardrail(textToTest);
      setGuardrailTestResult(res);
      if (!res.passed) {
        setToast({ message: "🚨 Guardrail INTERCEPTED potential safety violations!", tone: "error" });
      } else {
        setToast({ message: "✅ Guardrail PASSED! Utterance is safe & compliant.", tone: "success" });
      }
    } catch {
      setToast({ message: "Failed to evaluate guardrails simulator.", tone: "error" });
    } finally {
      setTestingGuardrail(false);
    }
  };

  // 1. Initial Load: Platform Settings + Companies List
  useEffect(() => {
    async function loadInitial() {
      try {
        const [settingsRes, compListRes] = await Promise.allSettled([
          getAdminSettings(),
          fetchApi<{ companies: CompanyProfile[] }>("/companies"),
        ]);

        if (settingsRes.status === "fulfilled" && settingsRes.value) {
          const s = settingsRes.value;
          setSettings({
            ...DEFAULT_SETTINGS,
            ...s,
            platform: { ...DEFAULT_SETTINGS.platform, ...s.platform },
            ai_defaults: { ...DEFAULT_SETTINGS.ai_defaults, ...s.ai_defaults },
            security: { ...DEFAULT_SETTINGS.security, ...s.security },
            notifications: { ...DEFAULT_SETTINGS.notifications, ...s.notifications },
            system: { ...DEFAULT_SETTINGS.system, ...s.system },
          });
          if (s.notifications?.whatsapp_number) {
            setWhatsappNumber(s.notifications.whatsapp_number);
          }
          if (s.notifications?.slack_webhook_url) {
            setSlackWebhook(s.notifications.slack_webhook_url);
          }
        }

        if (compListRes.status === "fulfilled" && compListRes.value?.companies) {
          const comps = compListRes.value.companies;
          setCompanies(comps);
          // Prefer admin_workspace or first company
          const preferred = comps.find((c: any) => c.slug === "admin_workspace") || comps[0];
          if (preferred) {
            setSelectedCompanyId(preferred.id);
          }
        }
      } catch (err: any) {
        console.error("Settings load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadInitial();
  }, []);

  // 2. Load Selected Company Details
  useEffect(() => {
    if (!selectedCompanyId) return;

    let isMounted = true;
    async function loadCompanyDetails() {
      setLoadingCompany(true);
      try {
        const comp = await companySettingsApi.getCompany(selectedCompanyId);
        if (!isMounted) return;

        setCurrentCompany(comp);
        setCompName(comp.name || "");
        setLegalName(comp.settings?.legal_name || "");
        setIndustry(comp.industry || "");
        setTimezone(comp.timezone || "Asia/Kolkata");
        setBusinessEmail(comp.settings?.business_email || "");
        setPhone(comp.settings?.phone || "");
        setWebsite(comp.settings?.website || "");
        setCountry(comp.country || "India");
        setAddress(comp.settings?.address || "");
        setBusinessDesc(comp.settings?.business_description || "");

        // Voice & Greetings
        setDefaultLanguage(comp.settings?.default_language || "en-IN");
        setDefaultVoice(comp.settings?.default_voice || "ritu");
        setInboundGreeting(comp.settings?.inbound_greeting || comp.settings?.greeting_message || "");
        setOutboundGreeting(comp.settings?.outbound_greeting || "");
        setCustomerPolicies(comp.settings?.customer_policies || "");
        setScheduleData(comp.settings?.business_hours || null);

        // Custom voices
        try {
          const voiceRes = await companySettingsApi.listCustomVoices(selectedCompanyId);
          if (isMounted) setCustomVoices(voiceRes.voices || []);
        } catch {
          if (isMounted) setCustomVoices([]);
        }
      } catch (err: any) {
        if (isMounted) {
          setToast({ message: "Could not load selected workspace profile.", tone: "error" });
        }
      } finally {
        if (isMounted) setLoadingCompany(false);
      }
    }

    loadCompanyDetails();
    return () => {
      isMounted = false;
    };
  }, [selectedCompanyId]);

  // ── Company Logo Handlers ──────────────────────────────────────────────────
  const handleCompanyLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentCompany) return;

    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: "Logo file is too large. Maximum size is 2MB.", tone: "error" });
      if (event.target) event.target.value = "";
      return;
    }

    setUploadingLogo(true);
    try {
      await companySettingsApi.uploadCompanyLogo(currentCompany.id, file);
      // Reload company
      const refreshed = await companySettingsApi.getCompany(currentCompany.id);
      setCurrentCompany(refreshed);
      setLogoVersion(Date.now());
      setToast({ message: "Company logo uploaded and updated successfully!", tone: "success" });
    } catch (err: any) {
      setToast({ message: err?.message || "Failed to upload logo.", tone: "error" });
    } finally {
      setUploadingLogo(false);
      if (event.target) event.target.value = "";
    }
  };

  const handleCompanyLogoRemove = async () => {
    if (!currentCompany) return;
    if (!confirm("Are you sure you want to remove the company logo?")) return;

    setUploadingLogo(true);
    try {
      await companySettingsApi.removeCompanyLogo(currentCompany.id);
      const refreshed = await companySettingsApi.getCompany(currentCompany.id);
      setCurrentCompany(refreshed);
      setLogoVersion(Date.now());
      setToast({ message: "Company logo removed successfully.", tone: "info" });
    } catch (err: any) {
      setToast({ message: err?.message || "Failed to remove logo.", tone: "error" });
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Company Profile Save ───────────────────────────────────────────────────
  const saveCompanyProfile = async () => {
    if (!currentCompany) return;
    setSavingSection("business");
    try {
      const updated = await companySettingsApi.updateCompany(currentCompany.id, {
        name: compName,
        industry,
        country,
        timezone,
        settings: {
          ...currentCompany.settings,
          legal_name: legalName,
          business_email: businessEmail,
          phone,
          website,
          address,
          business_description: businessDesc,
        },
      });
      setCurrentCompany(updated);
      setToast({ message: "Business profile & office address saved permanently!", tone: "success" });
    } catch (err: any) {
      setToast({ message: err?.message || "Failed to save business profile.", tone: "error" });
    } finally {
      setSavingSection(null);
    }
  };

  // ── Company Operating Hours Save ───────────────────────────────────────────
  const saveOperatingHours = async () => {
    if (!currentCompany) return;
    setSavingSection("schedule");
    try {
      const updated = await companySettingsApi.updateCompany(currentCompany.id, {
        settings: {
          ...currentCompany.settings,
          business_hours: scheduleData,
        },
      });
      setCurrentCompany(updated);
      setToast({ message: "Weekly operating hours & schedule synchronized!", tone: "success" });
    } catch (err: any) {
      setToast({ message: err?.message || "Failed to save schedule.", tone: "error" });
    } finally {
      setSavingSection(null);
    }
  };

  // ── Voice & Greetings Save ─────────────────────────────────────────────────
  const saveVoiceAndGreetings = async () => {
    if (!currentCompany) return;
    setSavingSection("voice");
    try {
      const updated = await companySettingsApi.updateCompany(currentCompany.id, {
        settings: {
          ...currentCompany.settings,
          default_language: defaultLanguage,
          default_voice: defaultVoice,
          greeting_message: inboundGreeting,
          inbound_greeting: inboundGreeting,
          outbound_greeting: outboundGreeting,
          customer_policies: customerPolicies,
        },
      });
      setCurrentCompany(updated);
      setToast({ message: "AI voice, greetings & customer policies updated!", tone: "success" });
    } catch (err: any) {
      setToast({ message: err?.message || "Failed to save voice settings.", tone: "error" });
    } finally {
      setSavingSection(null);
    }
  };

  const generateAIGreeting = async (direction: "inbound" | "outbound") => {
    if (!currentCompany) return;
    setGeneratingGreeting(direction);
    try {
      const res = await companySettingsApi.generateGreeting(currentCompany.id, direction, defaultLanguage);
      if (direction === "inbound") {
        setInboundGreeting(res.greeting);
      } else {
        setOutboundGreeting(res.greeting);
      }
      setToast({ message: `AI generated high-converting ${direction} greeting! Click Save to apply.`, tone: "success" });
    } catch (err: any) {
      setToast({ message: err?.message || `Failed to generate ${direction} greeting.`, tone: "error" });
    } finally {
      setGeneratingGreeting(null);
    }
  };

  // ── Platform Accent Color Handler ──────────────────────────────────────────
  const handleSelectAccent = async (hex: string) => {
    setSettings((prev) => ({
      ...prev,
      platform: {
        ...prev.platform,
        accent_color: hex,
      },
    }));

    // Apply CSS variables immediately for instant visual feedback
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--primary-accent", hex);
      document.documentElement.style.setProperty("--admin-jade", hex);
      document.documentElement.setAttribute("data-theme-accent", hex);
      const shell = document.querySelector(".admin-shell") as HTMLElement;
      if (shell) {
        shell.style.setProperty("--primary-accent", hex);
        shell.style.setProperty("--admin-jade", hex);
      }
      window.dispatchEvent(new CustomEvent("branding_updated", { detail: { accent_color: hex } }));
    }

    try {
      await updateAdminSettings({
        platform: {
          ...settings.platform,
          accent_color: hex,
        },
      });
      setToast({ message: `Theme accent color set to ${hex} permanently!`, tone: "success" });
    } catch {
      setToast({ message: "Failed to persist theme accent color.", tone: "error" });
    }
  };

  // ── Platform Settings Save Handlers ────────────────────────────────────────
  const savePlatformSection = async (section: keyof GlobalSettings) => {
    setSavingSection(String(section));
    try {
      let payload: any = { [section]: settings[section] };

      if (section === "notifications") {
        payload.notifications = {
          ...settings.notifications,
          whatsapp_number: whatsappNumber,
          slack_webhook_url: slackWebhook,
        };
      }

      const res = await updateAdminSettings(payload);
      setSettings(res);
      setToast({ message: `${String(section).toUpperCase()} preferences updated permanently!`, tone: "success" });
    } catch {
      setToast({ message: "Failed to persist platform changes.", tone: "error" });
    } finally {
      setSavingSection(null);
    }
  };

  const handleMaintenanceToggle = async (enabled: boolean) => {
    const updated = {
      ...settings,
      system: {
        ...settings.system,
        maintenance_mode: enabled,
      },
    };
    setSettings(updated);
    setSavingSection("system");
    try {
      await updateAdminSettings({
        system: {
          maintenance_mode: enabled,
          maintenance_message: settings.system?.maintenance_message,
        },
      });
      setToast({
        message: enabled ? "🛑 Maintenance Mode ACTIVATED platform-wide!" : "🟢 Platform is now LIVE & accepting calls!",
        tone: enabled ? "error" : "success",
      });
    } catch {
      setToast({ message: "Failed to update maintenance state.", tone: "error" });
    } finally {
      setSavingSection(null);
    }
  };

  if (loading) return <PageLoadingSkeleton cards={3} />;

  const isMaintenanceOn = Boolean(settings.system?.maintenance_mode);

  // Logo URL resolution
  const companyLogoUrl =
    currentCompany && currentCompany.settings?.logo_url
      ? `${getCompanyLogoUrl(currentCompany.id, currentCompany.settings.logo_url)}&t=${logoVersion}`
      : null;

  const currentAccent = settings.platform?.accent_color || "#0C4A31";

  // Merged voice options
  const combinedVoiceOptions = [
    ...STANDARD_VOICES,
    ...customVoices.map((v) => ({
      value: v.id,
      label: `✨ ${v.display_name || v.name || v.id} (Custom Cloned)`,
    })),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-16">
      {/* ── Futuristic Hero Command Banner with Emergency Kill-Switch ─────── */}
      <section
        className="admin-hero-gradient relative overflow-hidden rounded-[28px] border px-7 py-8 text-white shadow-[0_20px_60px_rgba(10,45,32,0.22)] transition-all duration-300"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${currentAccent} 80%, black) 0%, ${currentAccent} 50%, color-mix(in srgb, ${currentAccent} 70%, black) 100%)`,
          borderColor: `color-mix(in srgb, ${currentAccent} 40%, white)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute left-1/3 -bottom-24 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-white/90 backdrop-blur-md">
              <Sparkles size={13} className="text-white" /> Global Infrastructure & Business Command
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl text-white">
              Platform & Workspace Settings
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-white/80 leading-relaxed">
              Configure company profile, weekly business hours, uploaded brand logos, custom AI voice greetings, emergency kill-switches, and WhatsApp alerts.
            </p>
          </div>

          {/* Quick Runtime Badge & Maintenance Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 rounded-2xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                Global Runtime State
              </p>
              <p className="text-sm font-bold flex items-center gap-2 mt-0.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full animate-pulse ${
                    isMaintenanceOn ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                />
                {isMaintenanceOn ? "🛑 Maintenance Active" : "🟢 Platform Open & Live"}
              </p>
            </div>

            <Button
              size="sm"
              onClick={() => handleMaintenanceToggle(!isMaintenanceOn)}
              disabled={savingSection === "system"}
              className={`rounded-xl px-4 text-xs font-bold transition-all shadow-md ${
                isMaintenanceOn
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-amber-600 hover:bg-amber-500 text-white"
              }`}
            >
              {savingSection === "system" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Power className="h-3.5 w-3.5 mr-1" />
              )}
              {isMaintenanceOn ? "Resume Platform" : "Maintenance Mode"}
            </Button>
          </div>
        </div>

        {/* ── Active Workspace Switcher Banner ────────────────────────────── */}
        <div className="relative z-10 mt-7 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-white border border-white/15">
              <Building2 size={18} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                Active Workspace
              </p>
              <div className="relative inline-block mt-0.5">
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="appearance-none rounded-lg bg-white/15 hover:bg-white/20 border border-white/25 px-3 py-1 pr-8 text-xs font-bold text-white focus:outline-none cursor-pointer"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id} className="text-slate-900 bg-white font-medium">
                      {c.name} {c.slug === "admin_workspace" ? "(Default / Primary)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-white/70" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/80">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span>ID: <code className="font-mono text-white text-[11px]">{selectedCompanyId || "none"}</code></span>
            {loadingCompany && <Loader2 size={12} className="animate-spin text-white ml-1" />}
          </div>
        </div>

        {/* ── Modern Futuristic Tab Navigation ─────────────────────────────── */}
        <div className="relative z-30 isolate mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
          {SETTINGS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`select-none relative z-30 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "shadow-md border text-white"
                    : "bg-white/10 text-white/90 hover:bg-white/20 hover:text-white"
                }`}
                style={isActive ? {
                  backgroundColor: currentAccent,
                  borderColor: "rgba(255, 255, 255, 0.4)",
                  boxShadow: `0 4px 14px color-mix(in srgb, ${currentAccent} 60%, transparent)`,
                } : undefined}
              >
                <IconComponent size={14} className="pointer-events-none shrink-0" />
                <span className="pointer-events-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── TAB 1: Business Profile & Brand Logo ──────────────────────────── */}
      {activeTab === "business" && (
        <BusinessTab
          compName={compName}
          setCompName={setCompName}
          legalName={legalName}
          setLegalName={setLegalName}
          industry={industry}
          setIndustry={setIndustry}
          businessEmail={businessEmail}
          setBusinessEmail={setBusinessEmail}
          phone={phone}
          setPhone={setPhone}
          website={website}
          setWebsite={setWebsite}
          country={country}
          setCountry={setCountry}
          address={address}
          setAddress={setAddress}
          businessDesc={businessDesc}
          setBusinessDesc={setBusinessDesc}
          timezone={timezone}
          setTimezone={setTimezone}
          saveCompanyProfile={saveCompanyProfile}
          savingSection={savingSection}
          handleCompanyLogoUpload={handleCompanyLogoUpload}
          handleCompanyLogoRemove={handleCompanyLogoRemove}
          uploadingLogo={uploadingLogo}
          currentCompany={currentCompany}
          companyLogoInputRef={companyLogoInputRef}
          logoVersion={logoVersion}
          companyLogoUrl={companyLogoUrl}
        />
      )}

      {/* ── TAB 2: Operating Schedule ─────────────────────────────────────── */}
      {activeTab === "schedule" && (
        <ScheduleTab
          scheduleData={scheduleData}
          setScheduleData={setScheduleData}
          saveOperatingHours={saveOperatingHours}
          savingSection={savingSection}
          currentCompany={currentCompany}
          timezone={timezone}
        />
      )}

      {/* ── TAB 3: AI Voice & Audio Tone ─────────────────────────────────── */}
      {activeTab === "voice" && (
        <VoiceTab
          defaultLanguage={defaultLanguage}
          setDefaultLanguage={setDefaultLanguage}
          defaultVoice={defaultVoice}
          setDefaultVoice={setDefaultVoice}
          inboundGreeting={inboundGreeting}
          setInboundGreeting={setInboundGreeting}
          outboundGreeting={outboundGreeting}
          setOutboundGreeting={setOutboundGreeting}
          customerPolicies={customerPolicies}
          setCustomerPolicies={setCustomerPolicies}
          generatingGreeting={generatingGreeting}
          generateAIGreeting={generateAIGreeting}
          combinedVoiceOptions={combinedVoiceOptions}
          currentCompany={currentCompany}
          saveVoiceAndGreetings={saveVoiceAndGreetings}
          savingSection={savingSection}
        />
      )}

      {/* ── TAB 4: Platform Theme & Branding ──────────────────────────────── */}
      {activeTab === "branding" && (
        <BrandingTab
          settings={settings}
          setSettings={setSettings}
          savePlatformSection={savePlatformSection}
          savingSection={savingSection}
          platformLogoInputRef={platformLogoInputRef}
          uploadingLogo={uploadingLogo}
          logoVersion={logoVersion}
          setLogoVersion={setLogoVersion}
          setToast={setToast}
          currentAccent={currentAccent}
          handleSelectAccent={(hex: string) => {
            setSettings((prev) => ({
              ...prev,
              platform: { ...prev.platform, accent_color: hex },
            }));
          }}
        />
      )}

      {/* ── TAB 5: System Maintenance & Operations ────────────────────────── */}
      {activeTab === "maintenance" && (
        <MaintenanceTab
          settings={settings}
          setSettings={setSettings}
          savePlatformSection={savePlatformSection}
          savingSection={savingSection}
          isMaintenanceOn={isMaintenanceOn}
          handleMaintenanceToggle={handleMaintenanceToggle}
        />
      )}

      {/* ── TAB 6: System Alerts & Dispatch ───────────────────────────────── */}
      {activeTab === "alerts" && (
        <AlertsTab
          settings={settings}
          setSettings={setSettings}
          whatsappNumber={whatsappNumber}
          setWhatsappNumber={setWhatsappNumber}
          slackWebhook={slackWebhook}
          setSlackWebhook={setSlackWebhook}
          savePlatformSection={savePlatformSection}
          savingSection={savingSection}
        />
      )}

      {/* ── TAB 7: Security, Audit & 2FA ─────────────────────────────────── */}
      {activeTab === "security" && (
        <SecurityTab
          settings={settings}
          setSettings={setSettings}
          savePlatformSection={savePlatformSection}
          savingSection={savingSection}
        />
      )}

      {/* ── TAB 8: Global AI Engine & Providers ───────────────────────────── */}
      {activeTab === "ai" && (
        <AiTab
          settings={settings}
          setSettings={setSettings}
          guardrailTestInput={guardrailTestInput}
          setGuardrailTestInput={setGuardrailTestInput}
          guardrailTestResult={guardrailTestResult}
          testingGuardrail={testingGuardrail}
          handleTestGuardrail={handleTestGuardrail}
          savePlatformSection={savePlatformSection}
          savingSection={savingSection}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
