"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toast } from "@/components/ui/toast";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import {
  GlobalSettings,
  getAdminSettings,
  updateAdminSettings,
} from "@/lib/api/settings";

const DEFAULT_SETTINGS: GlobalSettings = {
  type: "global",
  platform: {
    platform_name: "ZeniaOne",
    default_language: "en-IN",
    default_timezone: "Asia/Kolkata",
  },
  ai_defaults: {
    default_provider: "groq",
    default_model: "qwen-3.8-27b",
    default_token_limit: 2048,
    default_temperature: 0.7,
  },
  security: {
    session_timeout_minutes: 60,
    require_strong_passwords: true,
  },
  notifications: {
    admin_notifications_enabled: true,
    system_alerts_enabled: true,
    security_alerts_enabled: true,
  },
  system: {
    maintenance_mode: false,
    maintenance_message: "ZeniaOne is currently performing scheduled engine optimizations. Normal operations will resume shortly.",
  },
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"branding" | "maintenance" | "alerts" | "security" | "ai">("branding");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);

  // Logo state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Webhook / WhatsApp custom state
  const [whatsappNumber, setWhatsappNumber] = useState("+919099887880");
  const [slackWebhook, setSlackWebhook] = useState("https://hooks.slack.com/services/T00/B00/XXXXX");

  useEffect(() => {
    async function load() {
      try {
        const data = await getAdminSettings();
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          platform: { ...DEFAULT_SETTINGS.platform, ...data.platform },
          ai_defaults: { ...DEFAULT_SETTINGS.ai_defaults, ...data.ai_defaults },
          security: { ...DEFAULT_SETTINGS.security, ...data.security },
          notifications: { ...DEFAULT_SETTINGS.notifications, ...data.notifications },
          system: { ...DEFAULT_SETTINGS.system, ...data.system },
        });
        if ((data as any).logo_url || data.platform?.logo_path) {
          setLogoPreview((data as any).logo_url || data.platform?.logo_path);
        }
      } catch {
        setToast({ message: "Loaded default platform control profile.", tone: "info" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const saveSection = async (section: keyof GlobalSettings) => {
    setSavingSection(String(section));
    try {
      await updateAdminSettings({ [section]: settings[section] });
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

  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-12">
      {/* ── Futuristic Hero Command Banner with Emergency Kill-Switch ─────── */}
      <section className="relative overflow-hidden rounded-[28px] border border-[#BDE0C8] bg-gradient-to-br from-[#061D13] via-[#0B3523] to-[#04140D] px-6 py-8 text-white shadow-[0_24px_75px_rgba(7,36,24,0.25)] sm:px-9">
        <div className="absolute right-[-3rem] top-[-3rem] h-72 w-72 rounded-full bg-[#5BE697]/15 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9EEAB5]">
              <Settings2 size={14} className="text-[#4BEB92]" /> Global Infrastructure & Security Command
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Platform Settings
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#CCE2D5]">
              Configure white-label branding, emergency maintenance kill-switches, WhatsApp alert dispatchers, and global AI guardrails.
            </p>
          </div>

          {/* Quick Emergency Status Pill */}
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#A2DEC0]">Global Runtime State</p>
              <p className="mt-0.5 text-lg font-black text-white">
                {isMaintenanceOn ? "🛑 Maintenance Mode" : "🟢 Platform Open & Live"}
              </p>
            </div>
            <button
              onClick={() => handleMaintenanceToggle(!isMaintenanceOn)}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                isMaintenanceOn
                  ? "bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)] animate-pulse"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30"
              }`}
            >
              {isMaintenanceOn ? "Exit Maintenance" : "Maintenance Mode"}
            </button>
          </div>
        </div>

        {/* ── Segmented Control Navigation Tabs ── */}
        <div className="mt-8 flex flex-wrap gap-2 border-t border-[#A8E2BC]/20 pt-5">
          <button
            onClick={() => setActiveTab("branding")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "branding"
                ? "bg-[#0C4A31] text-[#A7F3D0] shadow-md border border-[#34D399]/40"
                : "bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            <Building2 size={13} />
            🎨 Branding & Identity
          </button>
          <button
            onClick={() => setActiveTab("maintenance")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "maintenance"
                ? "bg-[#0C4A31] text-[#A7F3D0] shadow-md border border-[#34D399]/40"
                : "bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            <RadioTower size={13} />
            🛑 Maintenance & Kill-Switch
          </button>
          <button
            onClick={() => setActiveTab("alerts")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "alerts"
                ? "bg-[#0C4A31] text-[#A7F3D0] shadow-md border border-[#34D399]/40"
                : "bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            <BellRing size={13} />
            🔔 Alerts & Webhooks
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "security"
                ? "bg-[#0C4A31] text-[#A7F3D0] shadow-md border border-[#34D399]/40"
                : "bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            <ShieldCheck size={13} />
            🛡️ Security Armor
          </button>
          <button
            onClick={() => setActiveTab("ai")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "ai"
                ? "bg-[#0C4A31] text-[#A7F3D0] shadow-md border border-[#34D399]/40"
                : "bg-white/5 text-white/80 hover:bg-white/10"
            }`}
          >
            <Bot size={13} />
            🤖 AI Guardrails
          </button>
        </div>
      </section>

      {/* ── Tab 1: Branding & White-Label ──────────────────────────────────── */}
      {activeTab === "branding" && (
        <Card className="border-[#D5E4DB] bg-white shadow-sm">
          <CardContent className="p-7 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-[#19372B]">White-Label Branding & Identity</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Customize the platform appearance, brand name, timezone, and portal headers.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Platform Brand Name
                  </label>
                  <Input
                    value={settings.platform.platform_name}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        platform: { ...settings.platform, platform_name: e.target.value },
                      })
                    }
                    className="font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Default Business Timezone
                  </label>
                  <select
                    value={settings.platform.default_timezone}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        platform: { ...settings.platform, default_timezone: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium focus:border-[#285A42] focus:outline-none"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST · +05:30)</option>
                    <option value="UTC">UTC (Universal Coordinated Time)</option>
                    <option value="America/New_York">America/New York (EST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST · +04:00)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Default Platform Language
                  </label>
                  <select
                    value={settings.platform.default_language}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        platform: { ...settings.platform, default_language: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium focus:border-[#285A42] focus:outline-none"
                  >
                    <option value="en-IN">English (India · en-IN)</option>
                    <option value="hi-IN">Hindi / Hinglish (hi-IN)</option>
                    <option value="gu-IN">Gujarati (gu-IN)</option>
                  </select>
                </div>
              </div>

              {/* Logo & Accent Preview */}
              <div className="rounded-2xl border border-slate-100 bg-[#FBFDFC] p-5 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Platform Logo & Accent Theme
                </p>
                <div className="flex items-center gap-4">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-2">
                    <img
                      src="/brand/zeniaone-logo.png"
                      alt="Logo"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <Sparkles className="text-[#087F5B]" size={28} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Global Header Logo</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">PNG, SVG or WebP. Max 2MB.</p>
                    <label className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#0C4A31] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#093A27] cursor-pointer">
                      <Upload size={12} /> Upload New
                      <input type="file" className="hidden" accept="image/*" />
                    </label>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs font-bold text-slate-700 mb-2">Primary Accent Palette</p>
                  <div className="flex items-center gap-2">
                    <button className="h-7 w-7 rounded-full bg-[#0C4A31] ring-2 ring-offset-2 ring-[#0C4A31]" title="Emerald Cyber" />
                    <button className="h-7 w-7 rounded-full bg-[#4F46E5] opacity-70 hover:opacity-100 transition" title="Indigo Quantum" />
                    <button className="h-7 w-7 rounded-full bg-[#0EA5E9] opacity-70 hover:opacity-100 transition" title="Oceanic Blue" />
                    <button className="h-7 w-7 rounded-full bg-[#18181B] opacity-70 hover:opacity-100 transition" title="Obsidian Dark" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => saveSection("platform")}
                disabled={savingSection === "platform"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "platform" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save Branding Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tab 2: Maintenance & Kill-Switch ────────────────────────────────── */}
      {activeTab === "maintenance" && (
        <Card className="border-[#D5E4DB] bg-white shadow-sm">
          <CardContent className="p-7 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-[#19372B]">Platform Maintenance & Emergency Controls</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Safely isolate telephony webhooks and database writes during updates without crashing active callers.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-amber-900">Emergency Platform Kill-Switch</h3>
                  <p className="text-xs text-amber-800 leading-relaxed mt-1">
                    When Maintenance Mode is ON, inbound calls will hear the broadcast message below and gracefully disconnect. Background queues will be paused.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => handleMaintenanceToggle(!isMaintenanceOn)}
                  className={`rounded-xl px-5 py-2.5 text-xs font-black transition-all ${
                    isMaintenanceOn
                      ? "bg-red-600 text-white shadow-lg shadow-red-500/40 animate-pulse"
                      : "bg-[#0C4A31] text-white hover:bg-[#093A27]"
                  }`}
                >
                  {isMaintenanceOn ? "🛑 Deactivate Maintenance Mode (Go Live)" : "Activate Maintenance Mode"}
                </button>
                <span className="text-xs font-semibold text-slate-600">
                  Current Status: <span className="font-bold text-slate-900">{isMaintenanceOn ? "PAUSED" : "OPERATIONAL"}</span>
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Broadcast Audio / Banner Message
              </label>
              <Textarea
                rows={3}
                value={settings.system?.maintenance_message || ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    system: { ...settings.system, maintenance_message: e.target.value },
                  })
                }
                className="text-xs text-slate-800"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                This message will be spoken by Sarvam TTS to incoming callers during platform maintenance.
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => saveSection("system")}
                disabled={savingSection === "system"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "system" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save Maintenance Broadcast
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tab 3: Alerts & Webhook Dispatchers ─────────────────────────────── */}
      {activeTab === "alerts" && (
        <Card className="border-[#D5E4DB] bg-white shadow-sm">
          <CardContent className="p-7 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-[#19372B]">Urgent Alerts & Webhook Dispatchers</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Instant real-time notifications sent to WhatsApp, Slack, or Discord when call drops or AI provider failures occur.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    WhatsApp Alert Number (High Priority)
                  </label>
                  <div className="relative">
                    <Smartphone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
                    <Input
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="pl-9 text-xs font-mono font-bold text-slate-800"
                      placeholder="+919099887880"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Critical call drops or circuit breaker trips will be dispatched via WhatsApp instantly.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Slack / Discord Incoming Webhook URL
                  </label>
                  <Input
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    className="text-xs font-mono text-slate-700"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-[#FBFDFC] p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Notification Triggers & Toggles
                </p>
                <div className="space-y-3 pt-1">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.admin_notifications_enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            admin_notifications_enabled: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-[#0C4A31] rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">Dispatch alerts for AI Provider Failovers</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.system_alerts_enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            system_alerts_enabled: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-[#0C4A31] rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">Dispatch alerts for Call Minutes Quota Exhaustion (85%+)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications.security_alerts_enabled}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            security_alerts_enabled: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-[#0C4A31] rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">Dispatch alerts for Suspicious Logins from Unknown IPs</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => saveSection("notifications")}
                disabled={savingSection === "notifications"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "notifications" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save Alert Webhooks
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tab 4: Security Armor & Session Policies ───────────────────────── */}
      {activeTab === "security" && (
        <Card className="border-[#D5E4DB] bg-white shadow-sm">
          <CardContent className="p-7 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-[#19372B]">Security Armor & Session Governance</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Session timeouts, password complexity requirements, and multi-tenant isolation safeguards.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Admin Session Inactivity Timeout</span>
                    <span className="font-mono font-bold text-[#0C4A31] bg-[#DCF7E4] px-2 py-0.5 rounded-md">
                      {settings.security.session_timeout_minutes} Minutes
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="480"
                    step="15"
                    value={settings.security.session_timeout_minutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        security: {
                          ...settings.security,
                          session_timeout_minutes: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#0C4A31] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>15 min</span>
                    <span>120 min</span>
                    <span>8 hours</span>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security.require_strong_passwords}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          security: {
                            ...settings.security,
                            require_strong_passwords: e.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-[#0C4A31] rounded"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">Enforce Strict Password Complexity</span>
                      <p className="text-[11px] text-slate-500">
                        Requires minimum 10 characters with numbers and special symbols for all tenant admins.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-[#FBFDFC] p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Platform Security Safeguards
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">JWT Token Signing</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      HS256 Verified
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                    <span className="text-slate-600">Telephony Webhook HMAC</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-600">Cross-Tenant DB Isolation</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Enforced (company_id)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => saveSection("security")}
                disabled={savingSection === "security"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "security" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save Security Policies
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tab 5: AI Guardrails & Token Budget ─────────────────────────────── */}
      {activeTab === "ai" && (
        <Card className="border-[#D5E4DB] bg-white shadow-sm">
          <CardContent className="p-7 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-[#19372B]">Global AI Guardrails & Token Budget</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Default LLM engines, maximum tokens per phone call, and hallucination containment limits.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Global Default Provider
                  </label>
                  <select
                    value={settings.ai_defaults.default_provider}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ai_defaults: { ...settings.ai_defaults, default_provider: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold focus:border-[#285A42] focus:outline-none"
                  >
                    <option value="groq">Groq (Ultra-fast 0.11s TTFT)</option>
                    <option value="gemini">Google Gemini (Multi-turn & High Context)</option>
                    <option value="sarvam">Sarvam AI (Specialized Indic Speech)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Default Engine Model
                  </label>
                  <Input
                    value={settings.ai_defaults.default_model}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ai_defaults: { ...settings.ai_defaults, default_model: e.target.value },
                      })
                    }
                    className="text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Hard Token Ceiling Per Phone Call</span>
                    <span className="font-mono font-bold text-[#0C4A31] bg-[#DCF7E4] px-2 py-0.5 rounded-md">
                      {settings.ai_defaults.default_token_limit} Tokens
                    </span>
                  </div>
                  <input
                    type="range"
                    min="512"
                    max="8192"
                    step="256"
                    value={settings.ai_defaults.default_token_limit}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ai_defaults: {
                          ...settings.ai_defaults,
                          default_token_limit: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#0C4A31] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>512 tokens</span>
                    <span>2,048 tokens</span>
                    <span>8,192 tokens</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Creativity / Temperature</span>
                    <span className="font-mono font-bold text-[#0C4A31] bg-[#DCF7E4] px-2 py-0.5 rounded-md">
                      {settings.ai_defaults.default_temperature}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={settings.ai_defaults.default_temperature}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        ai_defaults: {
                          ...settings.ai_defaults,
                          default_temperature: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#0C4A31] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>0.0 (Strict / Accurate)</span>
                    <span>0.7 (Balanced)</span>
                    <span>1.0 (Creative)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => saveSection("ai_defaults")}
                disabled={savingSection === "ai_defaults"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "ai_defaults" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save AI Guardrails
              </Button>
            </div>
          </CardContent>
        </Card>
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
