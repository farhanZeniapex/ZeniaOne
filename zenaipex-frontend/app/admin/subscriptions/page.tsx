"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchApi, getCompanyLogoUrl } from "@/lib/api/client";
import {
  CreditCard,
  Building2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Clock3,
  Sparkles,
  AlertTriangle,
  Gift,
  Rocket,
  BriefcaseBusiness,
  Crown,
  Search,
  CheckCircle2,
  TrendingUp,
  Sliders,
  FileText,
  X,
  Phone,
  Bot,
  Percent,
  Download,
  Printer,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";

type Subscription = {
  id: string;
  company_id: string;
  company_name: string;
  logo_url?: string;
  status: string;
  plan: string;
  limits?: {
    max_agents?: number;
    call_minutes_per_month?: number;
    max_channels?: number;
    max_kb_docs?: number;
  };
  trial_ends_at?: string;
  used_minutes?: number;
  active_agents_count?: number;
  phone_channels_count?: number;
  plan_mrr?: number;
};

type Velocity = {
  mrr: number;
  projected_arr: number;
  active_paid_subscriptions: number;
  free_trials: number;
  enterprise_plans: number;
  expiring_soon: number;
  total_call_minutes_burned: number;
};

type InvoiceData = {
  invoice_number: string;
  date: string;
  billed_to: string;
  company_id: string;
  plan: string;
  line_items: Array<{ description: string; quantity: number; amount: number }>;
  subtotal: number;
  gst_rate: string;
  gst_amount: number;
  total: number;
  currency: string;
  payment_status: string;
};

function CompanyMark({ sub }: { sub: Subscription }) {
  const initials = (sub.company_name || "Company")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [showFallback, setShowFallback] = useState(false);
  const logo = sub.logo_url
    ? getCompanyLogoUrl(sub.company_id, sub.logo_url)
    : undefined;
  if (!showFallback && logo) {
    return (
      <img
        src={logo}
        alt={sub.company_name}
        onError={() => setShowFallback(true)}
        className="h-10 w-10 shrink-0 rounded-xl border border-slate-200/80 object-cover shadow-sm"
      />
    );
  }
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#E4F2E9] to-[#CCE4D4] text-xs font-bold text-[#194D33] shadow-sm">
      {initials}
    </div>
  );
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [velocity, setVelocity] = useState<Velocity>({
    mrr: 0,
    projected_arr: 0,
    active_paid_subscriptions: 0,
    free_trials: 0,
    enterprise_plans: 0,
    expiring_soon: 0,
    total_call_minutes_burned: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "trial" | "expiring">("all");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  // Customize Limits Modal
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [customPlan, setCustomPlan] = useState("free_trial");
  const [customStatus, setCustomStatus] = useState("trial");
  const [customMinutes, setCustomMinutes] = useState(60);
  const [customAgents, setCustomAgents] = useState(1);
  const [customChannels, setCustomChannels] = useState(1);
  const [savingLimits, setSavingLimits] = useState(false);

  // Invoice Modal
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const fetchSubscriptions = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetchApi<{ subscriptions?: Subscription[]; velocity?: Velocity }>(
        "/admin/subscriptions?limit=100",
      );
      if (res.subscriptions) {
        setSubscriptions(res.subscriptions);
      }
      if (res.velocity) {
        setVelocity(res.velocity);
      }
    } catch {
      setToast({ message: "Failed to load live subscriptions.", tone: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const openLimitModal = (sub: Subscription) => {
    setEditingSub(sub);
    setCustomPlan(sub.plan || "free_trial");
    setCustomStatus(sub.status || "trial");
    setCustomMinutes(sub.limits?.call_minutes_per_month ?? 60);
    setCustomAgents(sub.limits?.max_agents ?? 1);
    setCustomChannels(sub.limits?.max_channels ?? 1);
  };

  const saveCustomLimits = async () => {
    if (!editingSub) return;
    setSavingLimits(true);
    try {
      await fetchApi(`/admin/subscriptions/${editingSub.company_id}/limits`, {
        method: "PUT",
        body: JSON.stringify({
          plan: customPlan,
          status: customStatus,
          call_minutes_per_month: customMinutes,
          max_agents: customAgents,
          max_channels: customChannels,
        }),
      });
      setToast({ message: "Plan limits updated successfully!", tone: "success" });
      setEditingSub(null);
      fetchSubscriptions(true);
    } catch {
      setToast({ message: "Failed to update limits.", tone: "error" });
    } finally {
      setSavingLimits(false);
    }
  };

  const openInvoiceModal = async (companyId: string) => {
    setLoadingInvoice(true);
    try {
      const res = await fetchApi<InvoiceData>(`/admin/subscriptions/${companyId}/invoice`);
      setInvoiceData(res);
    } catch {
      setToast({ message: "Failed to load tax invoice.", tone: "error" });
    } finally {
      setLoadingInvoice(false);
    }
  };

  const filteredSubs = useMemo(() => {
    return subscriptions.filter((sub) => {
      const matchesSearch =
        sub.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.plan?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeTab === "active") return sub.status === "active" || sub.status === "active_paid";
      if (activeTab === "trial") return sub.status === "trial";
      if (activeTab === "expiring") {
        if (!sub.trial_ends_at) return false;
        const diff = (new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 3600 * 24);
        return diff > 0 && diff <= 5;
      }
      return true;
    });
  }, [subscriptions, searchQuery, activeTab]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* ── Futuristic Hero Header with Financial Velocity ────────────────── */}
      <section className="relative overflow-hidden rounded-[28px] border border-[#C5DDD0] bg-gradient-to-br from-[#09281C] via-[#0E3D2B] to-[#072016] px-6 py-8 text-white shadow-[0_24px_70px_rgba(9,40,28,0.22)] sm:px-9">
        <div className="absolute right-[-3rem] top-[-3rem] h-64 w-64 rounded-full bg-[#52D88C]/15 blur-3xl" />
        <div className="absolute right-24 bottom-[-2rem] h-48 w-48 rounded-full bg-[#3FB976]/10 blur-2xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9EEAB5]">
              <Sparkles size={14} /> Commercial Operations & Financial Velocity
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Billing & Plans
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#CCE2D5]">
              Real-time MRR tracking, minute quota consumption gauges, and custom enterprise plan controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fetchSubscriptions(true)}
              disabled={refreshing}
              className="border-[#9EEAB5]/40 bg-[#0E3D2B]/80 text-[#C7F5D4] backdrop-blur hover:bg-[#15533A] hover:text-white"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Metrics
            </Button>
          </div>
        </div>

        {/* ── Financial Velocity 4-Card Ribbon ── */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[#A8E2BC]/20 pt-6 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#A2DEC0]">Monthly Recurring Revenue</p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              ₹{velocity.mrr.toLocaleString("en-IN")}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#6FE59D]">
              <TrendingUp size={13} />
              <span>Projected ARR: ₹{velocity.projected_arr.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#A2DEC0]">Active Paid Accounts</p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {velocity.active_paid_subscriptions}
            </p>
            <p className="mt-1 text-xs text-[#CCE2D5]">
              {velocity.enterprise_plans} Enterprise tier contracts
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#A2DEC0]">Active Free Trials</p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {velocity.free_trials}
            </p>
            <p className="mt-1 text-xs text-amber-300">
              {velocity.expiring_soon > 0 ? `⚠️ ${velocity.expiring_soon} expiring in 5 days` : "Healthy trial pipeline"}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#A2DEC0]">Call Minutes Burned</p>
            <p className="mt-1 text-2xl font-black text-white sm:text-3xl">
              {velocity.total_call_minutes_burned.toLocaleString()} <span className="text-base font-normal text-[#A2DEC0]">min</span>
            </p>
            <p className="mt-1 text-xs text-[#CCE2D5]">Across all active tenants</p>
          </div>
        </div>
      </section>

      {/* ── Filter Bar & Search ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-[#0C4A31] text-white shadow-md shadow-[#0C4A31]/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            All Tenants ({subscriptions.length})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "active"
                ? "bg-[#0C4A31] text-white shadow-md shadow-[#0C4A31]/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            🟢 Active Paid ({velocity.active_paid_subscriptions})
          </button>
          <button
            onClick={() => setActiveTab("trial")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "trial"
                ? "bg-[#0C4A31] text-white shadow-md shadow-[#0C4A31]/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            🟡 Free Trials ({velocity.free_trials})
          </button>
          <button
            onClick={() => setActiveTab("expiring")}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "expiring"
                ? "bg-[#0C4A31] text-white shadow-md shadow-[#0C4A31]/20"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            ⚠️ Expiring Soon ({velocity.expiring_soon})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search tenant or plan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-medium focus:border-[#285A42] focus:outline-none focus:ring-2 focus:ring-[#9BD6AF]/40 shadow-sm"
          />
        </div>
      </div>

      {/* ── Subscriptions Table ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-[#D5E4DB] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-[#F4F8F5] text-[11px] font-bold uppercase tracking-wider text-[#355B49]">
                <th className="py-3.5 px-5">Company & Tenant</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Plan Tier</th>
                <th className="py-3.5 px-4 min-w-[200px]">Call Minutes Quota Burn</th>
                <th className="py-3.5 px-4">Voice Assets</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#285A42] mb-2" />
                    Loading tenant subscriptions & burn rates...
                  </td>
                </tr>
              ) : filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No subscriptions match this filter.
                  </td>
                </tr>
              ) : (
                filteredSubs.map((sub) => {
                  const maxMins = sub.limits?.call_minutes_per_month ?? 60;
                  const usedMins = sub.used_minutes ?? 0;
                  const pct = Math.min(Math.round((usedMins / Math.max(maxMins, 1)) * 100), 100);

                  const isHighUsage = pct >= 85;
                  const isCriticalUsage = pct >= 95;

                  return (
                    <tr
                      key={sub.id}
                      className="group transition-colors hover:bg-[#F9FCFA]"
                    >
                      {/* Company Info */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <CompanyMark sub={sub} />
                          <div>
                            <p className="font-bold text-slate-800 text-sm">
                              {sub.company_name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              ID: {sub.company_id.slice(-6)}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4">
                        {sub.status === "active" || sub.status === "active_paid" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active Paid
                          </span>
                        ) : sub.status === "trial" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 border border-amber-200">
                            <Clock3 size={11} />
                            Free Trial
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200">
                            Suspended
                          </span>
                        )}
                      </td>

                      {/* Plan Tier */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 font-bold capitalize text-slate-700">
                          {sub.plan === "enterprise" ? (
                            <Crown size={14} className="text-amber-500" />
                          ) : sub.plan === "professional" ? (
                            <Rocket size={14} className="text-indigo-500" />
                          ) : (
                            <Gift size={14} className="text-emerald-500" />
                          )}
                          {sub.plan.replace(/_/g, " ")}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {sub.plan_mrr ? `₹${sub.plan_mrr.toLocaleString("en-IN")}/mo` : "Complimentary"}
                        </p>
                      </td>

                      {/* Call Minutes Burn Bar */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-600">
                              {usedMins} / {maxMins.toLocaleString()} min
                            </span>
                            <span
                              className={`font-bold ${
                                isCriticalUsage
                                  ? "text-red-600"
                                  : isHighUsage
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {pct}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isCriticalUsage
                                  ? "bg-red-500"
                                  : isHighUsage
                                  ? "bg-amber-500"
                                  : "bg-[#0C4A31]"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Voice Assets */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                            <Bot size={11} className="text-slate-500" />
                            {sub.active_agents_count ?? 1} Agents
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium">
                            <Phone size={11} className="text-slate-500" />
                            {sub.phone_channels_count ?? 1} Lines
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openLimitModal(sub)}
                            className="h-8 border-[#C5DDD0] text-[#194D33] hover:bg-[#E4F2E9] text-xs font-bold"
                          >
                            <Sliders size={12} className="mr-1.5" />
                            Limits
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openInvoiceModal(sub.company_id)}
                            className="h-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900 text-xs font-semibold"
                            title="Generate Branded GST Tax Invoice"
                          >
                            <FileText size={13} className="mr-1" />
                            Invoice
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal 1: Customize Enterprise Limits with Interactive Sliders ── */}
      <Modal
        open={Boolean(editingSub)}
        onClose={() => setEditingSub(null)}
        title={`Custom Plan Limits: ${editingSub?.company_name || ""}`}
      >
        <div className="space-y-5 p-2">
          <p className="text-xs text-slate-500 leading-relaxed">
            Adjust dedicated quota ceilings for this tenant. Changes apply immediately to call routing and agent provisioning.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Plan Tier
              </label>
              <select
                value={customPlan}
                onChange={(e) => setCustomPlan(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold focus:border-[#285A42] focus:outline-none"
              >
                <option value="free_trial">Free Trial (₹0)</option>
                <option value="starter">Starter (₹4,999/mo)</option>
                <option value="professional">Professional (₹14,999/mo)</option>
                <option value="enterprise">Enterprise (₹49,999/mo)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Subscription Status
              </label>
              <select
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold focus:border-[#285A42] focus:outline-none"
              >
                <option value="active">Active Paid</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Slider 1: Call Minutes */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Monthly Call Minutes</span>
              <span className="font-mono font-bold text-[#0C4A31] bg-[#DCF7E4] px-2 py-0.5 rounded-md">
                {customMinutes.toLocaleString()} min
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="10000"
              step="30"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(Number(e.target.value))}
              className="w-full accent-[#0C4A31] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>30 min</span>
              <span>2,500 min</span>
              <span>10,000 min</span>
            </div>
          </div>

          {/* Slider 2: Max Agents */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Max AI Voice Agents</span>
              <span className="font-mono font-bold text-[#0C4A31] bg-[#DCF7E4] px-2 py-0.5 rounded-md">
                {customAgents} Agents
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={customAgents}
              onChange={(e) => setCustomAgents(Number(e.target.value))}
              className="w-full accent-[#0C4A31] cursor-pointer"
            />
          </div>

          {/* Slider 3: Channels */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700">Concurrent Phone Lines</span>
              <span className="font-mono font-bold text-[#0C4A31] bg-[#DCF7E4] px-2 py-0.5 rounded-md">
                {customChannels} Lines
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={customChannels}
              onChange={(e) => setCustomChannels(Number(e.target.value))}
              className="w-full accent-[#0C4A31] cursor-pointer"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingSub(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveCustomLimits}
              disabled={savingLimits}
              className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
            >
              {savingLimits ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save Limits
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal 2: Official Branded Tax Invoice ──────────────────────────── */}
      <Modal
        open={Boolean(invoiceData)}
        onClose={() => setInvoiceData(null)}
        title="Official GST Tax Invoice Preview"
      >
        {invoiceData && (
          <div className="space-y-4 p-2 text-xs">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-800">ZENIAONE AI</h3>
                <p className="text-[10px] text-slate-500">Autonomous Enterprise Voice Systems</p>
                <p className="text-[10px] text-slate-500">GSTIN: 24AAACZ1234F1Z8</p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-md bg-[#DCF7E4] px-2 py-0.5 font-mono font-bold text-[#177445]">
                  {invoiceData.invoice_number}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">{invoiceData.date}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Billed To:</p>
              <p className="text-sm font-bold text-slate-800">{invoiceData.billed_to}</p>
              <p className="text-[11px] text-slate-500 font-mono">Company ID: {invoiceData.company_id}</p>
            </div>

            <table className="w-full text-left border-collapse border border-slate-100">
              <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b">
                  <th className="p-2">Description</th>
                  <th className="p-2 text-center">Qty</th>
                  <th className="p-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoiceData.line_items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-2 font-medium">{item.description}</td>
                    <td className="p-2 text-center">{item.quantity}</td>
                    <td className="p-2 text-right font-mono">₹{item.amount.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1.5 border-t border-slate-200 pt-3 text-right">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">₹{invoiceData.subtotal.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST ({invoiceData.gst_rate}):</span>
                <span className="font-mono">₹{invoiceData.gst_amount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t pt-1.5">
                <span>Total Amount:</span>
                <span className="font-mono text-[#0C4A31]">₹{invoiceData.total.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="text-xs"
              >
                <Printer size={13} className="mr-1.5" />
                Print / PDF
              </Button>
              <Button
                size="sm"
                onClick={() => setInvoiceData(null)}
                className="bg-[#0C4A31] text-white text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

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
