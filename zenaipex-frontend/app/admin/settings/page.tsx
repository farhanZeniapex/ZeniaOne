"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Globe2,
  Loader2,
  LockKeyhole,
  Phone,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  GlobalSettings,
  getAdminSettings,
  updateAdminSettings,
} from "@/lib/api/settings";
import { companySettingsApi, CompanyProfile } from "@/lib/api/settings";
import { getCompanyLogoUrl } from "@/lib/api/client";
import { useCurrentCompany } from "@/hooks/use-company";
import SmartWeeklySchedule from "@/components/platform/settings/SmartWeeklySchedule";
import WorkspaceExperienceSettings from "@/components/platform/settings/workspace-experience-settings";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import { SmartSelect } from "@/components/ui/smart-select";

const DEFAULT_SETTINGS: GlobalSettings = {
  type: "global",
  platform: {
    platform_name: "ZeniaOne",
    default_language: "en",
    default_timezone: "UTC",
  },
  ai_defaults: {
    default_provider: "gemini",
    default_model: "gemini-3.5-flash-lite",
    default_token_limit: 1024,
    default_temperature: 0.7,
  },
  security: { session_timeout_minutes: 60, require_strong_passwords: true },
  notifications: {
    admin_notifications_enabled: true,
    system_alerts_enabled: true,
    security_alerts_enabled: true,
  },
  system: {
    maintenance_mode: false,
    maintenance_message:
      "System is undergoing maintenance. Please try again shortly.",
  },
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      setSettings(await getAdminSettings());
    } catch {
      setNotice("Settings could not be loaded. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const save = async (
    section:
      "platform" | "ai_defaults" | "security" | "notifications" | "system",
  ) => {
    setSaving(section);
    setNotice(null);
    try {
      const next = await updateAdminSettings({ [section]: settings[section] });
      setSettings(next);
      setNotice(`${section.replace("_", " ")} settings saved successfully.`);
    } catch (error: any) {
      setNotice(error?.message || "Settings could not be saved.");
    } finally {
      setSaving(null);
    }
  };
  const set = <
    K extends keyof Pick<
      GlobalSettings,
      "platform" | "ai_defaults" | "security" | "notifications" | "system"
    >,
  >(
    section: K,
    key: keyof GlobalSettings[K],
    value: any,
  ) =>
    setSettings((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  if (loading) return <PageLoadingSkeleton cards={4} />;
  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-[#CBE0D1] bg-[#0A2D20] px-6 py-8 text-white shadow-[0_22px_70px_rgba(11,46,33,.16)] sm:px-9">
        <div className="absolute -right-12 -top-16 h-64 w-64 rounded-full bg-[#8BE2AD]/25 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#A7E6B8]">
              <Sparkles size={14} /> Platform controls
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Settings
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#C7DBCF]">
              Manage security, notifications, AI defaults, and maintenance behavior from one secure control center.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#B8DCC1]">
              Runtime setting
            </p>
            <p className="mt-1 text-lg font-bold">
              {settings.system.maintenance_mode
                ? "Maintenance enabled"
                : "Platform open"}
            </p>
          </div>
        </div>
      </section>
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#BCE4C8] bg-[#F0FBF3] px-4 py-3 text-sm font-medium text-[#17613C]">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      <WorkspaceExperienceSettings />
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={ShieldCheck}
          label="Password policy"
          value={
            settings.security.require_strong_passwords ? "Strong" : "Standard"
          }
        />
        <Stat
          icon={Clock3}
          label="Session lifetime"
          value={`${settings.security.session_timeout_minutes} min`}
        />
        <Stat
          icon={Bot}
          label="AI default"
          value={settings.ai_defaults.default_provider}
        />
        <Stat
          icon={BellRing}
          label="System alerts"
          value={settings.notifications.system_alerts_enabled ? "On" : "Off"}
        />
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-[#BFE2CA] bg-[#F3FCF5] shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#DDF7E5] text-[#087F5B]">
                <Phone size={20} />
              </span>
              <div>
                <p className="font-bold text-[#214333]">Live AI routing</p>
                <p className="mt-1 text-sm text-[#527764]">
                  Actual Gemini, Groq, STT, and TTS routing for phone, voice chat, and website experiences is managed in AI Providers.
                </p>
              </div>
            </div>
            <a
              href="/admin/system/ai-providers"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0C4A31] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#083A27]"
            >
              Open routing <ArrowRight size={16} />
            </a>
          </CardContent>
        </Card>
        <Card className="border-[#D9E7DD] shadow-sm">
          <CardContent className="flex h-full items-center gap-3 p-5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#E6F6EB] text-[#087F5B]">
              <ShieldCheck size={20} />
            </span>
            <div>
              <p className="font-bold text-[#214333]">Billing enforcement</p>
              <p className="mt-1 text-sm text-[#527764]">
                {settings.env_overrides?.ai_billing_enforcement
                  ? "Usage limits are enforced by the server environment."
                  : "Usage limit enforcement is currently disabled in the server environment."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          icon={Settings2}
          title="Platform identity"
          description="Default branding and language for the control center."
          action={() => save("platform")}
          saving={saving === "platform"}
        >
          <Field label="Platform name">
            <Input
              value={settings.platform.platform_name}
              onChange={(e) => set("platform", "platform_name", e.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default language">
              <SmartSelect
                value={settings.platform.default_language}
                onChange={(value) => set("platform", "default_language", value)}
                options={[
                  { value: "en", label: "English" },
                  { value: "hi", label: "Hindi" },
                  { value: "hi-IN", label: "Hinglish" },
                  { value: "gu-IN", label: "Gujarati" },
                ]}
                searchable={false}
              />
            </Field>
            <Field label="Default timezone">
              <Input
                value={settings.platform.default_timezone}
                onChange={(e) =>
                  set("platform", "default_timezone", e.target.value)
                }
                placeholder="Asia/Kolkata"
              />
            </Field>
          </div>
        </Panel>
        <Panel
          icon={Bot}
          title="AI defaults"
          description="Fallback defaults for agents without an explicit setting."
          action={() => save("ai_defaults")}
          saving={saving === "ai_defaults"}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default provider">
              <SmartSelect
                value={settings.ai_defaults.default_provider}
                onChange={(value) =>
                  set("ai_defaults", "default_provider", value)
                }
                options={[
                  { value: "gemini", label: "Gemini" },
                  { value: "groq", label: "Groq" },
                  { value: "sarvam", label: "Sarvam" },
                ]}
                searchable={false}
              />
            </Field>
            <Field label="Default model">
              <Input
                value={settings.ai_defaults.default_model}
                onChange={(e) =>
                  set("ai_defaults", "default_model", e.target.value)
                }
              />
            </Field>
            <Field label="Token limit">
              <Input
                type="number"
                min="64"
                max="8192"
                value={settings.ai_defaults.default_token_limit}
                onChange={(e) =>
                  set(
                    "ai_defaults",
                    "default_token_limit",
                    Number(e.target.value),
                  )
                }
              />
            </Field>
            <Field label="Temperature (0–1)">
              <Input
                type="number"
                min="0"
                max="1"
                step=".1"
                value={settings.ai_defaults.default_temperature}
                onChange={(e) =>
                  set(
                    "ai_defaults",
                    "default_temperature",
                    Number(e.target.value),
                  )
                }
              />
            </Field>
          </div>
          <p className="rounded-xl bg-[#F6FAF7] p-3 text-xs leading-5 text-[#527764]">
            Voice calls and chat routing are controlled from AI Providers. This
            section supplies only safe defaults.
          </p>
        </Panel>
        <Panel
          icon={LockKeyhole}
          title="Security policy"
          description="Set session and password requirements for every admin."
          action={() => save("security")}
          saving={saving === "security"}
        >
          <Field label="Session timeout in minutes">
            <Input
              type="number"
              min="5"
              max="10080"
              value={settings.security.session_timeout_minutes}
              onChange={(e) =>
                set(
                  "security",
                  "session_timeout_minutes",
                  Number(e.target.value),
                )
              }
            />
          </Field>
          <Toggle
            label="Require strong passwords"
            detail="Applies password rules when administrators set or reset a password."
            checked={settings.security.require_strong_passwords}
            onChange={(value) =>
              set("security", "require_strong_passwords", value)
            }
          />
        </Panel>
        <Panel
          icon={BellRing}
          title="Alerts & notifications"
          description="Choose the platform events that notify administrators."
          action={() => save("notifications")}
          saving={saving === "notifications"}
        >
          <Toggle
            label="Admin notifications"
            detail="Workspace and account changes."
            checked={settings.notifications.admin_notifications_enabled}
            onChange={(value) =>
              set("notifications", "admin_notifications_enabled", value)
            }
          />
          <Toggle
            label="System alerts"
            detail="Provider, API and service events."
            checked={settings.notifications.system_alerts_enabled}
            onChange={(value) =>
              set("notifications", "system_alerts_enabled", value)
            }
          />
          <Toggle
            label="Security alerts"
            detail="Authentication and policy events."
            checked={settings.notifications.security_alerts_enabled}
            onChange={(value) =>
              set("notifications", "security_alerts_enabled", value)
            }
          />
        </Panel>
        <div className="xl:col-span-2">
          <Panel
            icon={Wrench}
            title="Maintenance control"
            description="Use only when you need to temporarily pause customer access."
            action={() => save("system")}
            saving={saving === "system"}
            danger
          >
            <Toggle
              label="Maintenance mode"
              detail="New customer actions display the message below. Existing server tasks are not cancelled."
              checked={settings.system.maintenance_mode}
              onChange={(value) => set("system", "maintenance_mode", value)}
              danger
            />
            <Field label="Customer maintenance message">
              <Textarea
                rows={3}
                value={settings.system.maintenance_message}
                onChange={(e) =>
                  set("system", "maintenance_message", e.target.value)
                }
              />
            </Field>
          </Panel>
        </div>
      </div>
    </div>
  );
}
function WorkspaceSettings() {
  const { companyId } = useCurrentCompany();
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (companyId)
      companySettingsApi
        .getCompany(companyId)
        .then(setCompany)
        .catch(() => setNotice("Workspace settings could not be loaded."));
  }, [companyId]);
  const update = async (updates: Partial<CompanyProfile>, message: string) => {
    if (!companyId || !company) return;
    setSaving(true);
    try {
      const result = await companySettingsApi.updateCompany(companyId, updates);
      setCompany(result);
      setNotice(message);
    } catch (error: any) {
      setNotice(error?.message || "Workspace settings could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const saveBusiness = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update(
      {
        name: String(form.get("name") || ""),
        industry: String(form.get("industry") || ""),
        country: String(form.get("country") || ""),
        timezone: String(form.get("timezone") || ""),
        settings: {
          ...company?.settings,
          legal_name: String(form.get("legal_name") || ""),
          business_email: String(form.get("business_email") || ""),
          phone: String(form.get("phone") || ""),
          website: String(form.get("website") || ""),
          address: String(form.get("address") || ""),
          business_description: String(form.get("business_description") || ""),
        },
      },
      "Business profile saved successfully.",
    );
  };
  const saveHours = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let hours: any = {};
    try {
      hours = JSON.parse(String(form.get("business_hours") || "{}"));
    } catch {}
    update(
      {
        settings: {
          ...company?.settings,
          business_hours: hours,
          greeting_message: String(form.get("greeting_message") || ""),
          default_language: String(form.get("default_language") || "en-IN"),
          default_voice: String(form.get("default_voice") || "ritu"),
        },
      },
      "Business hours and agent defaults saved successfully.",
    );
  };
  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    try {
      await companySettingsApi.uploadCompanyLogo(companyId, file);
      setCompany(await companySettingsApi.getCompany(companyId));
      setNotice("Workspace logo updated successfully.");
    } catch (error: any) {
      setNotice(error?.message || "Logo could not be uploaded.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };
  const removeLogo = async () => {
    if (!companyId) return;
    setUploading(true);
    try {
      await companySettingsApi.removeCompanyLogo(companyId);
      setCompany(await companySettingsApi.getCompany(companyId));
      setNotice("Workspace logo removed successfully.");
    } catch {
      setNotice("Logo could not be removed.");
    } finally {
      setUploading(false);
    }
  };
  if (!companyId || !company)
    return (
      <Card className="border-[#D9E7DD]">
        <CardContent className="p-6 text-sm text-slate-500">
          Loading workspace settings…
        </CardContent>
      </Card>
    );
  const logoUrl = company.settings?.logo_url
    ? getCompanyLogoUrl(companyId, company.settings.logo_url)
    : undefined;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#18342A]">
          Workspace & customer experience
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          This information is used by the website, customer chat, and agent context.
        </p>
      </div>
      {notice && (
        <div className="rounded-xl border border-[#C7E9D0] bg-[#F1FBF4] px-4 py-3 text-sm font-medium text-[#17613C]">
          {notice}
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden border-[#D9E7DD] shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b border-[#E5EEE7] bg-[#F8FBF8] px-6 py-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E4F5E9] text-[#087F5B]">
                <Building2 size={19} />
              </span>
              <div>
                <h3 className="font-bold text-[#19372B]">
                  Brand & business profile
                </h3>
                <p className="text-xs text-slate-500">
                  Logo, contact and customer-facing business details.
                </p>
              </div>
            </div>
            <form onSubmit={saveBusiness} className="space-y-4 p-6">
              <div className="flex items-center gap-4 rounded-2xl border border-[#E2ECE4] bg-[#FCFDFC] p-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#D6E5DA] bg-white text-[#087F5B]">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Workspace logo"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <Building2 size={25} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#315342]">
                    Workspace logo
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    PNG, JPG or WebP. Maximum 2MB.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label className="cursor-pointer rounded-lg bg-[#0C4A31] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#083A27]">
                      <Upload className="mr-1 inline h-3.5 w-3.5" />
                      {uploading ? "Uploading…" : "Upload logo"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={uploadLogo}
                      />
                    </label>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={removeLogo}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company name">
                  <Input name="name" defaultValue={company.name} />
                </Field>
                <Field label="Legal name">
                  <Input
                    name="legal_name"
                    defaultValue={company.settings?.legal_name || ""}
                  />
                </Field>
                <Field label="Industry">
                  <Input
                    name="industry"
                    defaultValue={company.industry || ""}
                  />
                </Field>
                <Field label="Timezone">
                  <Input
                    name="timezone"
                    defaultValue={company.timezone || "Asia/Kolkata"}
                  />
                </Field>
                <Field label="Business email">
                  <Input
                    name="business_email"
                    type="email"
                    defaultValue={company.settings?.business_email || ""}
                  />
                </Field>
                <Field label="Business phone">
                  <Input
                    name="phone"
                    defaultValue={company.settings?.phone || ""}
                  />
                </Field>
                <Field label="Website">
                  <Input
                    name="website"
                    defaultValue={company.settings?.website || ""}
                  />
                </Field>
                <Field label="Country">
                  <Input
                    name="country"
                    defaultValue={company.country || "IN"}
                  />
                </Field>
              </div>
              <Field label="Business address">
                <Input
                  name="address"
                  defaultValue={company.settings?.address || ""}
                />
              </Field>
              <Field label="Business description">
                <Textarea
                  name="business_description"
                  rows={3}
                  defaultValue={company.settings?.business_description || ""}
                />
              </Field>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#0C4A31] hover:bg-[#083A27]"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save business profile
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-[#D9E7DD] shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center gap-3 border-b border-[#E5EEE7] bg-[#F8FBF8] px-6 py-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E4F5E9] text-[#087F5B]">
                <CalendarClock size={19} />
              </span>
              <div>
                <h3 className="font-bold text-[#19372B]">
                  Business hours & agent behavior
                </h3>
                <p className="text-xs text-slate-500">
                  Tell the agent when your business is open and how to greet
                  visitors.
                </p>
              </div>
            </div>
            <form onSubmit={saveHours} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Default language">
                  <SmartSelect
                    name="default_language"
                    defaultValue={company.settings?.default_language || "en-IN"}
                    onChange={() => {}}
                    searchable={false}
                    options={[
                      { value: "en-IN", label: "English" },
                      { value: "hi-IN", label: "Hindi / Hinglish" },
                      { value: "gu-IN", label: "Gujarati" },
                    ]}
                  />
                </Field>
                <Field label="Default voice">
                  <Input
                    name="default_voice"
                    defaultValue={company.settings?.default_voice || "ritu"}
                  />
                </Field>
              </div>
              <Field label="Welcome greeting">
                <Textarea
                  name="greeting_message"
                  rows={3}
                  defaultValue={company.settings?.greeting_message || ""}
                  placeholder="Hello, how can I help you today?"
                />
              </Field>
              <div>
                <p className="mb-2 text-sm font-bold text-[#315342]">
                  Weekly business hours
                </p>
                <SmartWeeklySchedule
                  initialSchedule={company.settings?.business_hours}
                />
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#0C4A31] hover:bg-[#083A27]"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save hours & behavior
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Panel({
  icon: Icon,
  title,
  description,
  children,
  action,
  saving,
  danger = false,
}: any) {
  return (
    <Card
      className={`h-full overflow-hidden border ${danger ? "border-amber-200" : "border-[#D9E7DD]"} shadow-sm`}
    >
      <CardContent className="p-0">
        <div
          className={`flex items-start justify-between border-b px-6 py-5 ${danger ? "border-amber-100 bg-amber-50/50" : "border-[#E5EEE7] bg-[#F8FBF8]"}`}
        >
          <div className="flex gap-3">
            <span
              className={`grid h-10 w-10 place-items-center rounded-xl ${danger ? "bg-amber-100 text-amber-700" : "bg-[#E4F5E9] text-[#087F5B]"}`}
            >
              <Icon size={19} />
            </span>
            <div>
              <h2 className="font-bold text-[#19372B]">{title}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            </div>
          </div>
          <Button
            onClick={action}
            disabled={saving}
            className={
              danger
                ? "bg-amber-700 hover:bg-amber-800"
                : "bg-[#0C4A31] hover:bg-[#083A27]"
            }
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
        </div>
        <div className="space-y-5 p-6">{children}</div>
      </CardContent>
    </Card>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-[#315342]">{label}</span>
      {children}
    </label>
  );
}
function Toggle({
  label,
  detail,
  checked,
  onChange,
  danger = false,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5 rounded-xl border border-[#E2ECE4] bg-[#FCFDFC] p-4">
      <div>
        <p className="text-sm font-bold text-[#315342]">{label}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? (danger ? "bg-amber-600" : "bg-[#0D9A5F]") : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}
function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-[#D9E7DD] shadow-sm">
      <CardContent className="p-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E6F6EB] text-[#087F5B]">
          <Icon size={18} />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-lg font-bold text-[#1C3A2D] capitalize">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
