"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchApi } from "@/lib/api/client";
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleAlert,
  Cpu,
  Database,
  Eye,
  KeyRound,
  Loader2,
  Mic2,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  TestTube2,
  Volume2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartSelect } from "@/components/ui/smart-select";
import { Drawer } from "@/components/ui/drawer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AIProvider,
  ProviderRouting,
  RuntimeProvider,
  providersApi,
} from "@/lib/api/providers";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

const STAGES: Record<
  string,
  { label: string; icon: typeof Mic2; match: string }
> = {
  stt: { label: "Hear", icon: Mic2, match: "stt" },
  llm: { label: "Think", icon: Bot, match: "llm" },
  tts: { label: "Speak", icon: Volume2, match: "voice" },
};
const SURFACES = [
  {
    id: "phone_voice",
    name: "Phone Calls",
    icon: Phone,
    note: "New Exotel calls",
  },
  {
    id: "browser_voice",
    name: "Voice Chat AI",
    icon: Mic2,
    note: "Next browser voice session",
  },
  {
    id: "text_chat",
    name: "Website & Chat",
    icon: Bot,
    note: "New text response",
  },
];

const telephonyProviderLabel = (channel: any) => {
  const type = String(channel?.type || "").toLowerCase();
  if (type.includes("twilio")) return "Twilio";
  if (type.includes("enablex")) return "EnableX";
  if (type.includes("exotel")) return "Exotel";
  return "Telephony";
};

const MODE_PRESETS = [
  {
    id: "gemini_clone",
    name: "Gemini + Clone Voice",
    badge: "Recommended",
    tone: "blue",
    engine: "gemini_clone",
    description:
      "Gemini Live captures speech, Google Gemini generates the answer, and Sarvam speaks with your cloned voice.",
    flow: "Gemini Live → Google Gemini → Sarvam Clone TTS",
    routing: {
      phone_voice: {
        stt: ["gemini_live", "deepgram"],
        llm: ["gemini", "groq"],
        tts: ["sarvam_clone", "neural_tts"],
      },
      browser_voice: {
        stt: ["gemini_live", "sarvam_stt"],
        llm: ["gemini", "groq"],
        tts: ["sarvam_clone", "neural_tts"],
      },
      text_chat: { llm: ["gemini", "groq"] },
    },
  },
  {
    id: "pipeline",
    name: "Classic Deepgram + Groq",
    badge: "Stable fallback",
    tone: "emerald",
    engine: "pipeline",
    description:
      "The predictable pipeline: Deepgram speech recognition, Groq reasoning, and the selected voice output.",
    flow: "Deepgram → Groq → Sarvam Clone TTS",
    routing: {
      phone_voice: {
        stt: ["deepgram", "gemini_live"],
        llm: ["groq", "gemini"],
        tts: ["sarvam_clone", "neural_tts"],
      },
      browser_voice: {
        stt: ["deepgram", "sarvam_stt"],
        llm: ["groq", "gemini"],
        tts: ["sarvam_clone", "neural_tts"],
      },
      text_chat: { llm: ["groq", "gemini"] },
    },
  },
  {
    id: "native_gemini",
    name: "Gemini Live S2S · Browser + Phone",
    badge: "Fast demo",
    tone: "violet",
    engine: "gemini_live",
    description:
      "Gemini's native real-time voice-to-voice mode for browser voice and Exotel calls. The selected clone voice is bypassed in this mode.",
    flow: "Microphone / Phone → Gemini Live → Gemini native audio",
    routing: {
      phone_voice: {
        stt: ["gemini_live", "deepgram"],
        llm: ["gemini", "groq"],
        tts: ["neural_tts", "sarvam_clone"],
      },
      browser_voice: {
        stt: ["gemini_live", "sarvam_stt"],
        llm: ["gemini", "groq"],
        tts: ["neural_tts", "sarvam_clone"],
      },
      text_chat: { llm: ["gemini", "groq"] },
    },
  },
] as const;

export default function AIProvidersPage() {
  const [providers, setProviders] = useState<RuntimeProvider[]>([]);
  const [routing, setRouting] = useState<ProviderRouting>({});
  const [storedProviders, setStoredProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<RuntimeProvider | null>(null);
  const [providerKey, setProviderKey] = useState("");
  const [providerModel, setProviderModel] = useState("");
  const [providerEnabled, setProviderEnabled] = useState(true);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerTesting, setProviderTesting] = useState(false);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [providerHealth, setProviderHealth] = useState<
    Record<string, { status: string; message: string }>
  >({});
  const [checkingAll, setCheckingAll] = useState(false);
  const [channelInventory, setChannelInventory] = useState<any[]>([]);
  const [companyNames, setCompanyNames] = useState<Record<string, string>>({});
  const [agentNames, setAgentNames] = useState<Record<string, string>>({});
  const [agentInventory, setAgentInventory] = useState<any[]>([]);
  const [pendingVoiceEngine, setPendingVoiceEngine] = useState<string | null>(
    null,
  );

  const load = async () => {
    setLoading(true);
    try {
      const [data, configured] = await Promise.all([
        providersApi.getRuntime(),
        providersApi.listProviders(),
      ]);
      setProviders(data.providers);
      setRouting(data.routing);
      setStoredProviders(configured);
    } catch {
      setNotice(
        "The provider runtime could not be loaded. Refresh and try again.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    Promise.all([
      fetchApi<any>("/admin/channels"),
      fetchApi<any>("/admin/companies"),
      fetchApi<any>("/admin/agents"),
    ])
      .then(([channels, companies, agents]) => {
        setChannelInventory(channels.channels || []);
        setCompanyNames(
          Object.fromEntries(
            (companies.companies || []).map((item: any) => [
              item.id,
              item.name,
            ]),
          ),
        );
        setAgentNames(
          Object.fromEntries(
            (agents.agents || []).map((item: any) => [item.id, item.name]),
          ),
        );
        setAgentInventory(agents.agents || []);
      })
      .catch(() => {
        // Provider inventory remains usable even if channel enrichment is unavailable.
      });
  }, []);

  const names = (id: string) =>
    providers.find((p) => p.id === id)?.name || id.replaceAll("_", " ");
  const modelFor = (provider: RuntimeProvider) =>
    runtimeProviderRecord(provider)?.model || provider.model;
  const activeIds = useMemo(
    () =>
      new Set(Object.values(routing).flatMap((x) => Object.values(x).flat())),
    [routing],
  );
  const activePreset = useMemo(() => {
    return (
      MODE_PRESETS.find((preset) => {
        const current = routing.phone_voice;
        return (
          current?.stt?.[0] === preset.routing.phone_voice.stt[0] &&
          current?.llm?.[0] === preset.routing.phone_voice.llm[0] &&
          current?.tts?.[0] === preset.routing.phone_voice.tts[0]
        );
      })?.id || null
    );
  }, [routing]);
  const change = (
    surface: string,
    stage: string,
    updater: (chain: string[]) => string[],
  ) =>
    setRouting((current) => ({
      ...current,
      [surface]: {
        ...current[surface],
        [stage]: updater(current[surface]?.[stage] || []),
      },
    }));
  const runtimeProviderRecord = (provider: RuntimeProvider | null) => {
    if (!provider) return undefined;
    const dbName =
      provider.id === "gemini_live"
        ? "gemini"
        : provider.id === "sarvam_stt" || provider.id === "sarvam_clone"
          ? "sarvam"
          : provider.id;
    return storedProviders.find(
      (item) => item.provider.toLowerCase() === dbName.toLowerCase(),
    );
  };
  const linkedRuntimeUses = (provider: RuntimeProvider | null) => {
    if (!provider) return [];
    const dbName =
      provider.id === "gemini_live"
        ? "gemini"
        : provider.id === "sarvam_stt" || provider.id === "sarvam_clone"
          ? "sarvam"
          : provider.id;
    return providers
      .filter((item) => {
        const itemDbName =
          item.id === "gemini_live"
            ? "gemini"
            : item.id === "sarvam_stt" || item.id === "sarvam_clone"
              ? "sarvam"
              : item.id;
        return itemDbName === dbName;
      })
      .map((item) => item.name);
  };
  const openProvider = (provider: RuntimeProvider) => {
    const record = runtimeProviderRecord(provider);
    setSelectedProvider(provider);
    setProviderKey("");
    setProviderModel(record?.model || provider.model || "");
    setProviderEnabled(record?.enabled ?? provider.configured);
    setProviderNotice(null);
  };
  const saveProvider = async () => {
    if (!selectedProvider) return;
    const record = runtimeProviderRecord(selectedProvider);
    if (!record) {
      setProviderNotice(
        "This provider is environment-managed. Its secret is managed by the server environment.",
      );
      return;
    }
    setProviderSaving(true);
    setProviderNotice(null);
    try {
      const updated = await providersApi.updateProvider(record.id, {
        enabled: providerEnabled,
        model: providerModel,
        ...(providerKey.trim() ? { api_key: providerKey.trim() } : {}),
      });
      setStoredProviders((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setProviderKey("");
      setProviderNotice(
        "Provider configuration saved securely. New sessions will use the updated key.",
      );
      await load();
    } catch (error: any) {
      setProviderNotice(error?.message || "The provider could not be updated.");
    } finally {
      setProviderSaving(false);
    }
  };
  const testSelectedProvider = async () => {
    if (!selectedProvider) return;
    const record = runtimeProviderRecord(selectedProvider);
    if (!record) {
      setProviderNotice(
        "This provider is environment-managed. Test it after updating the server environment configuration.",
      );
      return;
    }
    setProviderTesting(true);
    setProviderNotice(null);
    try {
      const result = await providersApi.testConnection(record.id, {
        model: providerModel,
        ...(providerKey.trim() ? { api_key: providerKey.trim() } : {}),
      });
      setProviderHealth((current) => ({
        ...current,
        [selectedProvider.id]: {
          status: result.status,
          message: result.message,
        },
      }));
      setProviderNotice(result.message);
    } catch (error: any) {
      const message = error?.message || "The connection test failed.";
      setProviderHealth((current) => ({
        ...current,
        [selectedProvider.id]: { status: "failed", message },
      }));
      setProviderNotice(message);
    } finally {
      setProviderTesting(false);
    }
  };
  const checkAllProviders = async () => {
    if (!storedProviders.length) return;
    setCheckingAll(true);
    setNotice(null);
    const results = await Promise.all(
      storedProviders
        .filter((item) => item.has_api_key)
        .map(async (record) => {
          const providerName = record.provider.toLowerCase();
          const runtimeId =
            providerName === "gemini"
              ? "gemini_live"
              : providerName === "sarvam"
                ? "sarvam_clone"
                : providerName;
          try {
            const result = await providersApi.testConnection(record.id, {
              model: record.model,
            });
            return [
              runtimeId,
              { status: result.status, message: result.message },
            ] as const;
          } catch (error: any) {
            return [
              runtimeId,
              {
                status: "failed",
                message: error?.message || "Connection test failed",
              },
            ] as const;
          }
        }),
    );
    setProviderHealth(Object.fromEntries(results));
    const failures = results.filter(
      ([, result]) => result.status !== "connected",
    );
    setNotice(
      failures.length
        ? `${failures.length} provider connection${failures.length === 1 ? "" : "s"} require attention. Review the warnings below.`
        : "All configured provider connections are healthy.",
    );
    setCheckingAll(false);
  };
  const publishRouting = async (
    nextRouting: ProviderRouting,
    requestedEngine: string | null,
  ) => {
    setSaving(true);
    setNotice(null);
    try {
      const result = await providersApi.updateRuntimeRouting(nextRouting);
      setRouting(result.routing);
      const matchedPreset = MODE_PRESETS.find((preset) => {
        const current = result.routing.phone_voice;
        return (
          current?.stt?.[0] === preset.routing.phone_voice.stt[0] &&
          current?.llm?.[0] === preset.routing.phone_voice.llm[0] &&
          current?.tts?.[0] === preset.routing.phone_voice.tts[0]
        );
      });
      // A page reload used to clear pendingVoiceEngine. Clicking Apply after
      // that saved provider chains but left every agent on its previous voice
      // engine, so the routing page said Gemini Live while My AI showed Clone.
      const effectiveEngine = requestedEngine || matchedPreset?.engine || null;
      if (effectiveEngine) {
        const activeAgents = agentInventory.filter(
          (agent) => agent.status === "active",
        );
        const updates = await Promise.allSettled(
          activeAgents.map((agent) =>
            fetchApi(`/admin/agents/${agent.id}`, {
              method: "PATCH",
              body: JSON.stringify({ voice_engine: effectiveEngine }),
            }),
          ),
        );
        const failed = updates.filter(
          (item) => item.status === "rejected",
        ).length;
        setAgentInventory((items) =>
          items.map((agent) =>
            activeAgents.some((active) => active.id === agent.id)
              ? { ...agent, voice_engine: effectiveEngine }
              : agent,
          ),
        );
        setPendingVoiceEngine(null);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            "zeniaone:voice-routing-updated",
            JSON.stringify({ engine: effectiveEngine, at: Date.now() }),
          );
        }
        setNotice(
          failed
            ? `Routing saved, but ${failed} active agent voice mode could not be synchronized.`
            : `Routing and ${activeAgents.length} active agent voice mode${activeAgents.length === 1 ? "" : "s"} saved successfully.`,
        );
      } else {
        setNotice("Routing saved. It will apply to the next request or call.");
      }
    } catch (error: any) {
      setNotice(error?.message || "Routing could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const save = async () => publishRouting(routing, pendingVoiceEngine);
  const applyPreset = async (preset: (typeof MODE_PRESETS)[number]) => {
    const nextRouting = JSON.parse(
      JSON.stringify(preset.routing),
    ) as ProviderRouting;
    setRouting(nextRouting);
    setPendingVoiceEngine(preset.engine);
    setNotice(`${preset.name} is being applied to new calls and sessions…`);
    await publishRouting(nextRouting, preset.engine);
  };
  const exotelChannels = useMemo(
    () =>
      channelInventory.filter((channel) =>
        ["exotel", "exotel_voice"].includes(channel.type),
      ),
    [channelInventory],
  );
  const activeExotelChannels = useMemo(
    () =>
      exotelChannels.filter(
        (channel) =>
          channel.is_active && channel.phone_number && channel.agent_id,
      ),
    [exotelChannels],
  );

  if (loading) return <PageLoadingSkeleton cards={3} showTable={false} />;

  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-10">
      <section className="relative overflow-hidden rounded-[28px] border border-[#CBE0D1] bg-[#0B2E21] px-6 py-8 text-white shadow-[0_22px_70px_rgba(11,46,33,.18)] sm:px-9">
        <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-[#8BE2AD]/25 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#A7E6B8]">
              <Sparkles size={14} /> Runtime control center
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              AI Provider Routing
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#C7DBCF]">
              Every new call and chat uses the active flow. API keys remain
              securely on the server.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#B8DCC1]">
                Configured
              </p>
              <p className="mt-1 text-2xl font-bold">
                {providers.filter((p) => p.configured).length}
                <span className="text-sm text-[#B8DCC1]">
                  {" "}
                  / {providers.length}
                </span>
              </p>
            </div>
            <Button
              onClick={checkAllProviders}
              disabled={checkingAll}
              variant="outline"
              className="h-12 border-white/25 bg-white/10 px-4 font-bold text-white hover:bg-white/20"
            >
              {checkingAll ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TestTube2 className="mr-2 h-4 w-4" />
              )}
              Check health
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="h-12 bg-[#B9F3C8] px-5 font-bold text-[#08311E] hover:bg-[#D7FADE]"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Apply routing
            </Button>
          </div>
        </div>
      </section>
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#BCE4C8] bg-[#F0FBF3] px-4 py-3 text-sm font-medium text-[#17613C]">
          <CheckCircle2 size={17} />
          {notice}
        </div>
      )}
      {Object.entries(providerHealth).filter(
        ([, result]) => result.status !== "connected",
      ).length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900 shadow-sm">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 shrink-0 text-red-600" size={19} />
            <div>
              <p className="font-bold">Provider attention required</p>
              <p className="mt-1 text-xs leading-5">
                A connection, quota, authentication, or model issue was detected.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(providerHealth)
                  .filter(([, result]) => result.status !== "connected")
                  .map(([id, result]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        const provider = providers.find(
                          (item) => item.id === id,
                        );
                        if (provider) openProvider(provider);
                      }}
                      className="rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100"
                    >
                      {names(id)} · {result.message}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#18342A]">
              Voice operating modes
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose a complete voice flow; the detailed provider chains below
              will update automatically.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#CFE1D4] bg-white px-3 py-1.5 text-[11px] font-bold text-[#527764]">
            <Activity size={13} /> One active mode at a time
          </span>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {MODE_PRESETS.map((preset) => {
            const selected = activePreset === preset.id;
            const tone =
              preset.tone === "blue"
                ? selected
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                  : "border-slate-200 hover:border-blue-300"
                : preset.tone === "emerald"
                  ? selected
                    ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                    : "border-slate-200 hover:border-emerald-300"
                  : selected
                    ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100"
                    : "border-slate-200 hover:border-violet-300";
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                disabled={saving}
                aria-busy={saving}
                className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-65 ${tone}`}
                aria-pressed={selected}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`grid h-10 w-10 place-items-center rounded-xl ${selected ? "bg-white/80" : "bg-slate-100"} text-[#087F5B]`}
                  >
                    <Mic2 size={19} />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${selected ? "bg-white/80 text-[#17613C]" : "bg-slate-100 text-slate-500"}`}
                  >
                    {selected ? "Selected" : preset.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#19372B]">
                  {preset.name}
                </h3>
                <p className="mt-2 min-h-12 text-xs leading-5 text-slate-600">
                  {preset.description}
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-[11px] font-bold text-[#355347]">
                  <span className="truncate">{preset.flow}</span>
                  <ArrowRight
                    size={14}
                    className="ml-auto shrink-0 text-[#087F5B]"
                  />
                </div>
                <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-[#087F5B]">
                  <span>
                    {selected ? "Active profile" : "Use this profile"}
                  </span>
                  {selected && <CheckCircle2 size={15} />}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Native Gemini S2S audio is controlled by the browser or agent runtime;
          the provider routing panel manages its fallback providers.
        </p>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-[#18342A]">
            Live routing plan
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            The first provider is primary. Other providers are used as backups
            after a failure.
          </p>
        </div>
        <div className="grid gap-5 xl:grid-cols-3">
          {SURFACES.map((surface) => {
            const SurfaceIcon = surface.icon;
            return (
              <Card
                key={surface.id}
                className="overflow-hidden border-[#D9E7DD] bg-white shadow-sm"
              >
                <div className="flex items-center gap-3 border-b border-[#E5EEE7] bg-[#F8FBF8] px-5 py-4">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E4F5E9] text-[#087F5B]">
                    <SurfaceIcon size={19} />
                  </span>
                  <div>
                    <h3 className="font-bold text-[#19372B]">{surface.name}</h3>
                    <p className="text-xs text-slate-500">{surface.note}</p>
                  </div>
                </div>
                <CardContent className="space-y-4 p-5">
                  {Object.entries(routing[surface.id] || {}).map(
                    ([stage, chain]) => {
                      const meta = STAGES[stage];
                      if (!meta) return null;
                      const Icon = meta.icon;
                      const eligible = providers.filter(
                        (p) =>
                          p.roles.some((role) =>
                            role.toLowerCase().includes(meta.match),
                          ) && !chain.includes(p.id),
                      );
                      return (
                        <div
                          key={stage}
                          className="rounded-2xl border border-[#E1EAE3] p-3"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <Icon size={15} className="text-[#087F5B]" />
                            <span className="text-sm font-bold text-[#244235]">
                              {meta.label}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {chain.map((id, index) => (
                              <div
                                key={id}
                                className="flex items-center gap-2 rounded-xl border border-[#DDEBE1] bg-[#FBFDFC] px-2.5 py-2"
                              >
                                <span
                                  className={
                                    index === 0
                                      ? "h-2 w-2 rounded-full bg-[#16B364] shadow-[0_0_0_3px_#DDF8E7]"
                                      : "h-2 w-2 rounded-full bg-[#A9B8AD]"
                                  }
                                />
                                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#355347]">
                                  {names(id)}
                                </span>
                                <span className="text-[10px] font-bold uppercase text-[#6B8B77]">
                                  {index === 0 ? "Active" : `Backup ${index}`}
                                </span>
                                <button
                                  disabled={index === 0}
                                  onClick={() =>
                                    change(surface.id, stage, (list) => {
                                      const next = [...list];
                                      [next[index - 1], next[index]] = [
                                        next[index],
                                        next[index - 1],
                                      ];
                                      return next;
                                    })
                                  }
                                  className="text-xs text-[#087F5B] disabled:opacity-20"
                                >
                                  ↑
                                </button>
                                <button
                                  disabled={index === chain.length - 1}
                                  onClick={() =>
                                    change(surface.id, stage, (list) => {
                                      const next = [...list];
                                      [next[index + 1], next[index]] = [
                                        next[index],
                                        next[index + 1],
                                      ];
                                      return next;
                                    })
                                  }
                                  className="text-xs text-[#087F5B] disabled:opacity-20"
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() => {
                                    if (chain.length === 1)
                                      setNotice(
                                        "Each stage must keep at least one active provider.",
                                      );
                                    else
                                      change(surface.id, stage, (list) =>
                                        list.filter((item) => item !== id),
                                      );
                                  }}
                                  className="rounded-md px-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          {eligible.length > 0 && (
                            <SmartSelect
                              value=""
                              placeholder="+ Add backup"
                              onChange={(id) =>
                                change(surface.id, stage, (list) => [
                                  ...list,
                                  id,
                                ])
                              }
                              options={eligible.map((p) => ({
                                value: p.id,
                                label: p.name,
                                badge: p.configured ? "Ready" : "Key missing",
                                disabled: !p.configured,
                              }))}
                              className="mt-2"
                            />
                          )}
                        </div>
                      );
                    },
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#18342A]">
              Secure provider inventory
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Select a provider to manage configuration, model, status, secure
              key replacement, and connection tests.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={load}
            className="border-[#CFE1D4] text-[#286044]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {providers.map((p) => (
            <Card
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => openProvider(p)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openProvider(p);
              }}
              className={`cursor-pointer border transition hover:-translate-y-0.5 hover:shadow-md ${p.configured ? "border-[#D4E9DA]" : "border-amber-200 bg-amber-50/30"}`}
            >
              <CardContent className="p-5">
                <div className="mb-5 flex items-start justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E8F6EB] text-[#087F5B]">
                    <Cpu size={19} />
                  </span>
                  <StatusBadge tone={p.configured ? "success" : "warning"}>
                    {p.configured ? "Configured" : "Key missing"}
                  </StatusBadge>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#203D30]">{p.name}</p>
                    <p className="mt-1 min-h-8 text-xs text-slate-500">
                      {p.category} · {modelFor(p)}
                    </p>
                  </div>
                  <Eye size={15} className="mt-1 text-[#7B9786]" />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-[#E7EFE8] pt-3 text-[11px]">
                  <StatusBadge
                    tone={activeIds.has(p.id) ? "success" : "neutral"}
                  >
                    {activeIds.has(p.id) ? "In routing" : "Standby"}
                  </StatusBadge>
                  <span className="flex items-center gap-1 text-[#527764]">
                    <ShieldCheck size={13} />
                    {p.source}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Info
          icon={Activity}
          title="Applies safely"
          text="Saved routing applies to new calls and sessions; active calls are not interrupted."
        />
        <Info
          icon={Database}
          title="Secrets protected"
          text="Full API keys are never displayed; replacements are stored securely."
        />
        <Info
          icon={CircleAlert}
          title="Fallback ready"
          text="Each stage must keep one provider. Add a backup before removing the primary."
        />
      </section>

      {false && exotelChannels.length > 0 && (
        <section className="hidden">Exotel routing details</section>
      )}

      {channelInventory.filter((channel) =>
        [
          "twilio_voice",
          "exotel_voice",
          "exotel",
          "enablex",
          "enablex_voice",
        ].includes(channel.type),
      ).length > 0 && (
        <section className="rounded-2xl border border-[#CFE1D4] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#087F5B]">
                Telephony channel status
              </p>
              <h2 className="mt-1 text-lg font-bold text-[#18342A]">
                Connected phone lines
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {
                channelInventory.filter((channel) =>
                  [
                    "twilio_voice",
                    "exotel_voice",
                    "exotel",
                    "enablex",
                    "enablex_voice",
                  ].includes(channel.type),
                ).length
              }{" "}
              channels
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {channelInventory
              .filter((channel) =>
                [
                  "twilio_voice",
                  "exotel_voice",
                  "exotel",
                  "enablex",
                  "enablex_voice",
                ].includes(channel.type),
              )
              .map((channel) => {
                const ready = Boolean(
                  channel.is_active && channel.phone_number && channel.agent_id,
                );
                const typeMismatch =
                  /enablex/i.test(channel.name || "") &&
                  ["exotel_voice", "exotel"].includes(channel.type);
                return (
                  <div
                    key={channel.id}
                    className={`rounded-2xl border p-4 shadow-sm ${ready ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/50"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          {telephonyProviderLabel(channel)} channel
                        </p>
                        <p className="mt-1 text-sm font-bold text-[#244235]">
                          {channel.name || "Unnamed channel"}
                        </p>
                      </div>
                      <StatusBadge tone={ready ? "success" : "warning"}>
                        {ready ? "Ready" : "Warning"}
                      </StatusBadge>
                    </div>
                    <p className="mt-3 font-mono text-sm font-bold text-slate-700">
                      {channel.phone_number || "No number assigned"}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-slate-600">
                      Agent: {agentNames[channel.agent_id] || "Unassigned"}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {ready
                        ? "Inbound eligible · Outbound when selected"
                        : "Not eligible for new calls"}
                    </p>
                    {typeMismatch && (
                      <p className="mt-2 rounded-lg bg-amber-100 px-2 py-1.5 text-[10px] font-semibold leading-4 text-amber-800">
                        Name suggests EnableX, but saved type is exotel_voice.
                        Verify configuration.
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {selectedProvider &&
        (() => {
          const record = runtimeProviderRecord(selectedProvider);
          return (
            <Drawer
              open={Boolean(selectedProvider)}
              onClose={() => setSelectedProvider(null)}
              title={selectedProvider.name}
              description={`${selectedProvider.category} · ${selectedProvider.model}`}
              className="max-w-xl bg-white"
            >
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#E3EEE5] bg-[#FBFDFC] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Status
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#244235]">
                      {selectedProvider.configured ? "Configured" : "Needs key"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E3EEE5] bg-[#FBFDFC] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Source
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#244235]">
                      {record ? "Encrypted DB" : selectedProvider.source}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E3EEE5] bg-[#FBFDFC] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Routing
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#244235]">
                      {activeIds.has(selectedProvider.id)
                        ? "In use"
                        : "Standby"}
                    </p>
                  </div>
                </div>
                {selectedProvider.id === "exotel" &&
                  (() => {
                    const exotelChannels = channelInventory.filter((channel) =>
                      ["exotel", "exotel_voice"].includes(channel.type),
                    );
                    const inactive = exotelChannels.filter(
                      (channel) => !channel.is_active,
                    );
                    const incomplete = exotelChannels.filter(
                      (channel) => !channel.phone_number || !channel.agent_id,
                    );
                    return (
                      <div className="space-y-3 rounded-2xl border border-[#DDEBE1] bg-[#F8FBF8] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[#244235]">
                              Exotel channel health
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Linked phone numbers, workspace, agent,
                              identifiers, and saved activity mapping.
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${inactive.length || incomplete.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                          >
                            {inactive.length || incomplete.length
                              ? "Review needed"
                              : "Configuration ready"}
                          </span>
                        </div>
                        {exotelChannels.length === 0 ? (
                          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs font-semibold text-amber-800">
                            No Exotel voice channel is linked to this workspace.
                          </p>
                        ) : (
                          <div className="max-h-72 space-y-2 overflow-auto">
                            {exotelChannels.map((channel) => (
                              <div
                                key={channel.id}
                                className="rounded-xl border border-[#E1EAE3] bg-white px-3 py-2.5"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-bold text-[#244235]">
                                      {channel.name || "Unnamed channel"}
                                    </p>
                                    <p className="mt-1 font-mono text-xs text-slate-600">
                                      {channel.phone_number ||
                                        "No number assigned"}
                                    </p>
                                  </div>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${channel.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}
                                  >
                                    {channel.is_active ? "Active" : "Inactive"}
                                  </span>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                                  <span>
                                    Channel ID:{" "}
                                    <b className="font-mono text-slate-700">
                                      {channel.id || "Unknown"}
                                    </b>
                                  </span>
                                  <span>
                                    Public ID:{" "}
                                    <b className="font-mono text-slate-700">
                                      {channel.public_identifier ||
                                        "Not assigned"}
                                    </b>
                                  </span>
                                  <span>
                                    Company:{" "}
                                    <b className="text-slate-700">
                                      {companyNames[channel.company_id] ||
                                        channel.company_id ||
                                        "Unknown"}
                                    </b>
                                  </span>
                                  <span>
                                    Agent:{" "}
                                    <b className="text-slate-700">
                                      {agentNames[channel.agent_id] ||
                                        "Unassigned"}
                                    </b>
                                  </span>
                                  <span>
                                    Type:{" "}
                                    <b className="text-slate-700">
                                      {channel.type || "Unknown"}
                                    </b>
                                  </span>
                                  <span>
                                    Status:{" "}
                                    <b
                                      className={
                                        channel.is_active
                                          ? "text-emerald-700"
                                          : "text-red-700"
                                      }
                                    >
                                      {channel.is_active
                                        ? "Active"
                                        : "Inactive"}
                                    </b>
                                  </span>
                                  <span>
                                    Created:{" "}
                                    <b className="text-slate-700">
                                      {channel.created_at
                                        ? new Date(
                                            channel.created_at,
                                          ).toLocaleDateString()
                                        : "—"}
                                    </b>
                                  </span>
                                  <span>
                                    Last updated:{" "}
                                    <b className="text-slate-700">
                                      {channel.updated_at
                                        ? new Date(
                                            channel.updated_at,
                                          ).toLocaleDateString()
                                        : "—"}
                                    </b>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {(inactive.length || incomplete.length) > 0 && (
                          <p className="text-[11px] font-semibold leading-4 text-amber-800">
                            Inactive or incomplete channels require verification
                            of the phone number, agent assignment, and channel
                            credentials before they can receive new calls.
                          </p>
                        )}
                        {exotelChannels.length > 0 && (
                          <p className="text-[11px] font-semibold leading-4 text-slate-500">
                            Saved configuration is shown here. Run a test call
                            to verify live Exotel credentials and call stability
                            before enabling a channel.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                {record && (
                  <div className="rounded-2xl border border-[#E3EEE5] bg-[#FBFDFC] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Current key fingerprint
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-[#244235]">
                          {record.key_hint || "•••••••• (stored)"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Last updated
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#244235]">
                          {new Date(record.updated_at).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          by {record.updated_by || "system"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-[#E7EFE8] pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Shared by
                      </p>
                      <p className="mt-1 text-xs font-semibold text-[#355347]">
                        {linkedRuntimeUses(selectedProvider).join(" · ") ||
                          "This provider"}
                      </p>
                    </div>
                  </div>
                )}
                {record ? (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700">
                        API key
                      </label>
                      <input
                        type="password"
                        value={providerKey}
                        onChange={(event) => setProviderKey(event.target.value)}
                        placeholder={
                          record.has_api_key
                            ? "••••••••  (enter a new key to replace it)"
                            : "New API key"
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#087F5B] focus:ring-2 focus:ring-[#DDF5E4]"
                      />
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        The existing key is never revealed. A new key will be
                        stored securely.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-700">
                        Model
                      </label>
                      <input
                        value={providerModel}
                        onChange={(event) =>
                          setProviderModel(event.target.value)
                        }
                        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#087F5B] focus:ring-2 focus:ring-[#DDF5E4]"
                      />
                    </div>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E3EEE5] bg-[#FBFDFC] px-3 py-3 text-sm font-semibold text-[#244235]">
                      <input
                        type="checkbox"
                        checked={providerEnabled}
                        onChange={(event) =>
                          setProviderEnabled(event.target.checked)
                        }
                        className="h-4 w-4 accent-[#087F5B]"
                      />{" "}
                      Provider enabled for runtime resolution
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={testSelectedProvider}
                        disabled={providerTesting || providerSaving}
                        className="border-[#CFE1D4] text-[#286044]"
                      >
                        {providerTesting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube2 className="mr-2 h-4 w-4" />
                        )}
                        Test connection
                      </Button>
                      <Button
                        type="button"
                        onClick={saveProvider}
                        disabled={providerSaving || providerTesting}
                        className="bg-[#0C4A31] text-white hover:bg-[#083A27]"
                      >
                        {providerSaving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save provider
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    <p className="font-bold">Environment-managed provider</p>
                    <p className="mt-1">
                      This provider secret is supplied by the server
                      environment. The full key is never shown in the dashboard.
                      Update the server secret and restart the backend to
                      replace it.
                    </p>
                  </div>
                )}
                {providerHealth[selectedProvider.id]?.status === "failed" && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">
                    <p className="font-bold">Provider warning</p>
                    <p className="mt-1">
                      {providerHealth[selectedProvider.id].message}
                    </p>
                    <p className="mt-2 text-xs">
                      Update the key or model and test again, or move this
                      provider below a healthy backup.
                    </p>
                  </div>
                )}
                {providerNotice && (
                  <div className="rounded-xl border border-[#BCE4C8] bg-[#F0FBF3] px-4 py-3 text-sm font-medium text-[#17613C]">
                    {providerNotice}
                  </div>
                )}
              </div>
            </Drawer>
          );
        })()}
    </div>
  );
}

function Info({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Activity;
  title: string;
  text: string;
}) {
  return (
    <Card className="border-[#DDEBE1]">
      <CardContent className="flex gap-3 p-5">
        <Icon className="mt-0.5 text-[#087F5B]" />
        <div>
          <p className="font-bold text-[#244235]">{title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-500">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}
