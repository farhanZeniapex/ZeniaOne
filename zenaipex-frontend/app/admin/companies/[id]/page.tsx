"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchApi } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Phone, FileText, MessageSquare, Users, Loader2, CheckCircle2, Circle, CalendarClock, Mic2, Bot, Radio, Settings2, Save, ChevronDown } from "lucide-react";
import { formatSystemDateTime } from "@/lib/utils";
import styles from "../../organization.module.css";

interface CompanyDetails {
  id: string;
  name: string;
  slug?: string;
  plan?: string;
  is_active: boolean;
  industry?: string;
  country?: string;
  owner_name?: string;
  owner_email?: string;
  created_at?: string;
  timezone?: string;
  settings?: Record<string, unknown>;
  stats?: { agents_count?: number; documents_count?: number; conversations_count?: number; channels_count?: number; setup_progress?: number; setup_completed_steps?: string[]; setup_missing_steps?: string[]; setup_total_steps?: number };
  team?: { user_id: string; name: string; email: string; role: string; joined_at?: string }[];
}

type SetupAgentOption = { id: string; name: string; voice: string; status: string };
type SetupVoiceOption = { id: string; name: string; source: string };

export default function AdminCompanyDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<CompanyDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [setupNotice, setSetupNotice] = useState("");
  const [voiceOptions, setVoiceOptions] = useState<SetupVoiceOption[]>([]);
  const [agentOptions, setAgentOptions] = useState<SetupAgentOption[]>([]);
  const [isVoicePickerOpen, setIsVoicePickerOpen] = useState(false);
  const [voicePickerRect, setVoicePickerRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [setupForm, setSetupForm] = useState({ industry: "", business_email: "", business_phone: "", business_address: "", business_description: "", greeting_message: "", default_voice: "", default_agent: "", hours_enabled: false, open_time: "09:00", close_time: "18:00" });

  useEffect(() => {
    if (id) {
      fetchApi<CompanyDetails>(`/admin/companies/${id}`)
        .then(setData)
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchApi<{ agents?: SetupAgentOption[]; voices?: SetupVoiceOption[] }>(`/admin/companies/${id}/setup-options`)
      .then(options => { setAgentOptions(options.agents || []); setVoiceOptions(options.voices || []); })
      .catch(error => console.error("Failed to load setup options", error));
  }, [id]);

  useEffect(() => {
    if (!isSetupOpen || typeof document === "undefined") return;
    const voiceInput = document.querySelector<HTMLInputElement>('input[placeholder="FK, OM, Ritu…"]');
    if (!voiceInput) return;
    const placePicker = () => { const rect = voiceInput.getBoundingClientRect(); setVoicePickerRect({ top: rect.top, left: rect.left, width: rect.width }); };
    voiceInput.removeAttribute("list");
    voiceInput.style.visibility = "hidden";
    placePicker();
    window.addEventListener("resize", placePicker);
    return () => { voiceInput.style.visibility = ""; window.removeEventListener("resize", placePicker); setVoicePickerRect(null); setIsVoicePickerOpen(false); };
  }, [isSetupOpen]);

  if (isLoading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  if (!data) return <div className="p-8 text-center text-red-500">Company not found.</div>;

  const stats = data.stats ?? {};
  const team = data.team ?? [];
  const completed = stats.setup_completed_steps ?? [];
  const missing = stats.setup_missing_steps ?? [];

  function openSetup() {
    const settings = data?.settings ?? {};
    const hours = settings.business_hours as Record<string, { start?: string; end?: string }> | undefined;
    const firstDay = hours?.monday || hours?.tuesday;
    setSetupForm({
      industry: data?.industry || "", business_email: String(settings.business_email || ""), business_phone: String(settings.business_phone || settings.phone || ""),
      business_address: String(settings.business_address || settings.address || ""), business_description: String(settings.business_description || ""),
      greeting_message: String(settings.greeting_message || settings.inbound_greeting || ""), default_voice: String(settings.default_voice || ""),
      default_agent: String(settings.default_agent || ""),
      hours_enabled: Boolean(hours), open_time: firstDay?.start || "09:00", close_time: firstDay?.end || "18:00",
    });
    setSetupNotice("");
    setIsSetupOpen(true);
  }

  function updateSetupField(field: keyof typeof setupForm, value: string | boolean) { setSetupForm(current => ({ ...current, [field]: value })); }

  async function saveSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    setIsSavingSetup(true); setSetupNotice("");
    const business_hours = setupForm.hours_enabled ? Object.fromEntries(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(day => [day, { active: day !== "sunday", start: setupForm.open_time, end: setupForm.close_time }])) : undefined;
    try {
      await fetchApi(`/admin/companies/${data.id}/setup`, { method: "PATCH", body: JSON.stringify({ ...setupForm, business_hours }) });
      const fresh = await fetchApi<CompanyDetails>(`/admin/companies/${data.id}`);
      setData(fresh); setSetupNotice("Setup details saved. Progress has been updated.");
    } catch (error: unknown) { setSetupNotice(error instanceof Error ? error.message : "Setup could not be saved."); }
    finally { setIsSavingSetup(false); }
  }

  function openCustomerWorkspace(path: string) {
    if (!data) return;
    sessionStorage.setItem("view_as_company_id", data.id);
    sessionStorage.setItem("view_as_company_name", data.name);
    router.push(path);
  }

  const setupSteps = [
    { name: "Business profile", detail: "Contact, address and business description", ready: completed.includes("Business profile"), icon: Building2, action: openSetup, label: "Edit profile" },
    { name: "Business hours", detail: "Open days and customer availability", ready: completed.includes("Business hours"), icon: CalendarClock, action: openSetup, label: "Set hours" },
    { name: "Greeting & voice", detail: "Welcome message and selected voice", ready: completed.includes("Greeting & voice"), icon: Mic2, action: openSetup, label: "Configure" },
    { name: "AI agent", detail: "Create or assign an agent", ready: completed.includes("AI agent"), icon: Bot, action: () => openCustomerWorkspace("/dashboard/agents"), label: "Open agents" },
    { name: "Knowledge", detail: "Upload documents for grounded answers", ready: completed.includes("Knowledge"), icon: FileText, href: `/admin/knowledge/companies/${data.id}`, label: "Open knowledge" },
    { name: "Channel", detail: "Connect phone, web chat or another channel", ready: completed.includes("Channel"), icon: Radio, action: () => openCustomerWorkspace("/dashboard/channels"), label: "Open channels" },
  ];

  return (
    <div className={`${styles.page} max-w-6xl`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" aria-label="Back to companies" onClick={() => router.push("/admin/companies")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className={styles.title}>{data.name}</h1>
              {data.slug === "admin_workspace" && (
                <span className="text-[10px] font-bold bg-sage-100 text-sage-700 border border-sage-200 px-2 py-0.5 rounded-full uppercase tracking-wide">ZeniaOne</span>
              )}
            </div>
            <p className="text-slate-500 text-sm">Tenant ID: <code className="bg-slate-100 px-1 rounded">{data.id}</code></p>
          </div>
        </div>
        {data.slug !== "admin_workspace" && (
          <Button
            onClick={() => {
              sessionStorage.setItem("view_as_company_id", data.id);
              sessionStorage.setItem("view_as_company_name", data.name);
              router.push("/dashboard");
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Building2 className="h-4 w-4 mr-2" />
            View as Company
          </Button>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#CFE1D5] bg-white shadow-[0_12px_35px_rgba(16,68,49,.08)]">
        <div className="flex flex-col gap-4 border-b border-[#E3ECE5] bg-[linear-gradient(110deg,#F1FAF5,#F7FBFF)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><span className="text-[11px] font-bold tracking-[.15em] text-[#087F5B]">WORKSPACE ONBOARDING</span><h2 className="mt-1 text-xl font-bold tracking-tight text-[#173529]">{stats.setup_progress ?? 0}% setup complete</h2><p className="mt-1 text-sm text-slate-500">{completed.length} of {stats.setup_total_steps ?? 6} setup items complete. Finish pending items yourself from this page.</p></div>
          <Button onClick={openSetup} className="bg-[#087F5B] text-white hover:bg-[#066D4E]"><Settings2 className="mr-2 h-4 w-4" />Update setup</Button>
        </div>
        <div className="px-5 pt-5"><div className="h-2 overflow-hidden rounded-full bg-[#E5F0E9]"><div className="h-full rounded-full bg-[#0AB273] transition-all duration-500" style={{ width: `${stats.setup_progress ?? 0}%` }} /></div></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">{setupSteps.map(step => <div key={step.name} className={`rounded-xl border p-4 ${step.ready ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}><div className="flex items-start gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${step.ready ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>{step.ready ? <CheckCircle2 size={18} /> : <Circle size={18} />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><strong className="text-sm text-[#19362A]">{step.name}</strong><span className={`text-[10px] font-bold uppercase tracking-wide ${step.ready ? "text-emerald-700" : "text-amber-700"}`}>{step.ready ? "Complete" : "Pending"}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p>{step.ready ? <span className="mt-3 inline-flex text-xs font-semibold text-emerald-700">Done</span> : step.href ? <Link href={step.href} className="mt-3 inline-flex text-xs font-bold text-[#087F5B] hover:underline">{step.label} →</Link> : <button type="button" onClick={step.action} className="mt-3 text-xs font-bold text-[#087F5B] hover:underline">{step.label} →</button>}</div></div></div>)}</div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Details */}
        <div className={`${styles.surface} p-5`}>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Company Details</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: "Plan", value: <span className="capitalize font-semibold text-indigo-700">{data.plan?.replace("_", " ")}</span> },
              { label: "Status", value: data.is_active ? <span className="text-green-600 font-semibold">Active</span> : <span className="text-red-600 font-semibold">Suspended</span> },
              { label: "Industry", value: data.industry || "—" },
              { label: "Country", value: data.country || "—" },
              { label: "Owner", value: data.owner_name || "—" },
              { label: "Owner Email", value: data.owner_email || "—" },
              { label: "Created", value: data.created_at ? formatSystemDateTime(data.created_at) : "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</dt>
                <dd className="mt-1 text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Stats */}
        <div className={`${styles.surface} p-5`}>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-4">Resources</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "AI Agents", value: stats.agents_count ?? 0, icon: Phone, color: "text-amber-600 bg-amber-50" },
              { label: "Documents", value: stats.documents_count ?? 0, icon: FileText, color: "text-indigo-600 bg-indigo-50" },
              { label: "Convs", value: stats.conversations_count ?? 0, icon: MessageSquare, color: "text-rose-600 bg-rose-50" },
            ].map(s => (
              <div key={s.label} className="flex flex-col items-center justify-center rounded-xl border border-slate-100 p-4 gap-2 bg-slate-50">
                <div className={`h-8 w-8 flex items-center justify-center rounded-lg ${s.color}`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <span className="text-xl font-bold text-slate-900">{s.value}</span>
                <span className="text-xs font-medium text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isSetupOpen && typeof document !== "undefined" && createPortal(<div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto p-4 backdrop-blur-xl" style={{ background: "radial-gradient(circle at 14% 12%, rgba(255,255,255,.76), rgba(198,231,250,.78) 46%, rgba(151,207,239,.82))" }} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !isSavingSetup) setIsSetupOpen(false); }}>
        <form onSubmit={saveSetup} className="my-5 w-full max-w-3xl overflow-hidden rounded-2xl border border-[#DCE7DF] bg-[#F9FBF8] shadow-2xl"><div className="flex items-start justify-between bg-[#073B2A] px-6 py-5 text-white"><div><span className="text-xs font-bold tracking-[.15em] text-emerald-200">COMPLETE WORKSPACE SETUP</span><h2 className="mt-1 text-xl font-bold">Business, hours & voice</h2><p className="mt-1 text-sm text-emerald-100">Save these details to update the readiness score and help the AI answer correctly.</p></div><button type="button" onClick={() => setIsSetupOpen(false)} className="rounded-lg p-2 text-emerald-100 hover:bg-white/10" aria-label="Close setup"><ArrowLeft className="h-5 w-5 rotate-180" /></button></div><div className="grid gap-5 p-6 md:grid-cols-2"><div className="space-y-4"><h3 className="font-bold text-[#173529]">Business profile</h3><label className="block text-sm font-semibold text-slate-700">Industry<input value={setupForm.industry} onChange={e => updateSetupField("industry", e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label><label className="block text-sm font-semibold text-slate-700">Business email<input type="email" value={setupForm.business_email} onChange={e => updateSetupField("business_email", e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label><label className="block text-sm font-semibold text-slate-700">Business phone<input value={setupForm.business_phone} onChange={e => updateSetupField("business_phone", e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label><label className="block text-sm font-semibold text-slate-700">Business address<input value={setupForm.business_address} onChange={e => updateSetupField("business_address", e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label><label className="block text-sm font-semibold text-slate-700">Business description<textarea rows={3} value={setupForm.business_description} onChange={e => updateSetupField("business_description", e.target.value)} className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2" /></label></div><div className="space-y-4"><h3 className="font-bold text-[#173529]">Customer experience</h3><label className="flex items-center justify-between rounded-xl border border-[#DCE7DF] bg-white p-3 text-sm font-semibold text-slate-700">Business hours active<input type="checkbox" checked={setupForm.hours_enabled} onChange={e => updateSetupField("hours_enabled", e.target.checked)} className="h-4 w-4 accent-emerald-600" /></label>{setupForm.hours_enabled && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold text-slate-700">Open<input type="time" value={setupForm.open_time} onChange={e => updateSetupField("open_time", e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label><label className="text-sm font-semibold text-slate-700">Close<input type="time" value={setupForm.close_time} onChange={e => updateSetupField("close_time", e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label></div>}<p className="text-xs text-slate-500">Hours apply Monday–Saturday. You can refine individual days later from the customer workspace.</p><label className="block text-sm font-semibold text-slate-700">Default clone voice<input value={setupForm.default_voice} onChange={e => updateSetupField("default_voice", e.target.value)} placeholder="FK, OM, Ritu…" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" /></label><label className="block text-sm font-semibold text-slate-700">Welcome greeting<textarea rows={4} value={setupForm.greeting_message} onChange={e => updateSetupField("greeting_message", e.target.value)} placeholder="Hello, how can I help you today?" className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2" /></label></div></div>{setupNotice && <p className={`mx-6 mb-4 rounded-lg border px-3 py-2 text-sm ${setupNotice.includes("saved") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>{setupNotice}</p>}<div className="flex justify-end gap-2 border-t border-[#DCE7DF] bg-white px-6 py-4"><Button type="button" variant="outline" disabled={isSavingSetup} onClick={() => setIsSetupOpen(false)}>Cancel</Button><Button type="submit" disabled={isSavingSetup} className="bg-[#087F5B] text-white hover:bg-[#066D4E]">{isSavingSetup ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : <><Save className="mr-2 h-4 w-4" />Save setup</>}</Button></div></form>
        {voicePickerRect && <div className="fixed z-[125]" style={{ top: voicePickerRect.top, left: voicePickerRect.left, width: voicePickerRect.width }}>
          <button type="button" onClick={() => setIsVoicePickerOpen(value => !value)} className="flex h-10 w-full items-center justify-between rounded-lg border border-[#B7D6E7] bg-white px-3 text-left text-sm font-semibold text-[#173C54] shadow-sm transition hover:border-[#3996C7] hover:shadow-md" aria-expanded={isVoicePickerOpen}>
            <span className="truncate">{voiceOptions.find(voice => voice.id === setupForm.default_voice)?.name || (setupForm.default_voice ? "Saved voice" : "Choose a voice")}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-[#39718B] transition ${isVoicePickerOpen ? "rotate-180" : ""}`} />
          </button>
          {isVoicePickerOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-[126] max-h-72 w-[min(420px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-[#B6D8E9] bg-white/95 p-2 shadow-[0_24px_70px_rgba(13,66,103,.24)] backdrop-blur-xl">
            <p className="px-2 py-2 text-[10px] font-bold tracking-[.14em] text-[#5D7A8C]">VOICE LIBRARY</p>
            {voiceOptions.length === 0 && <p className="px-2 pb-2 text-sm text-slate-500">No voices are available for this workspace yet.</p>}
            {voiceOptions.map(voice => <button key={`voice-${voice.id}`} type="button" onClick={() => { updateSetupField("default_voice", voice.id); setIsVoicePickerOpen(false); }} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${setupForm.default_voice === voice.id ? "bg-[#E4F4FB]" : "hover:bg-[#F3F9FC]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E6F5EF] text-[#087F5B]"><Mic2 className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#16384B]">{voice.name}</span><span className="block truncate text-xs text-[#658095]">{voice.source}</span></span>
              {setupForm.default_voice === voice.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#087F5B]" />}
            </button>)}
            {agentOptions.length > 0 && <><div className="mx-2 my-2 border-t border-[#DCEAF1]" /><p className="px-2 py-2 text-[10px] font-bold tracking-[.14em] text-[#5D7A8C]">ASSIGNED AGENT VOICES</p>{agentOptions.map(agent => <button key={`agent-${agent.id}`} type="button" onClick={() => { updateSetupField("default_voice", agent.voice); updateSetupField("default_agent", agent.id); setIsVoicePickerOpen(false); }} className={`mb-1 flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition ${setupForm.default_agent === agent.id ? "bg-[#E4F4FB]" : "hover:bg-[#F3F9FC]"}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#3268A3]"><Bot className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#16384B]">{agent.name}</span><span className="block truncate text-xs text-[#658095]">{agent.status} agent · {voiceOptions.find(voice => voice.id === agent.voice)?.name || "assigned voice"}</span></span>
              {setupForm.default_agent === agent.id && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#087F5B]" />}
            </button>)}</>}
          </div>}
        </div>}
      </div>, document.body)}

      {/* Team Members */}
      <div className={styles.tableSurface}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Users className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Team Members ({team.length})</h2>
        </div>
        <div className={styles.tableScroll}><table className="w-full text-sm">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-5 py-3 text-left font-semibold">Name</th>
              <th className="px-5 py-3 text-left font-semibold">Email</th>
              <th className="px-5 py-3 text-left font-semibold">Role</th>
              <th className="px-5 py-3 text-left font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {team.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No team members found.</td></tr>
            ) : team.map(m => (
              <tr key={m.user_id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-900">{m.name}</td>
                <td className="px-5 py-3 text-slate-500">{m.email}</td>
                <td className="px-5 py-3">
                  <span className="capitalize text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{m.role}</span>
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">{m.joined_at ? formatSystemDateTime(m.joined_at) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
