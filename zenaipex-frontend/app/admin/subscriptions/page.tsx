"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import org from "../organization.module.css";
import { SmartSelect } from "@/components/ui/smart-select";
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
  };
};
type Plan = {
  id: string;
  name: string;
  limits: {
    max_agents?: number;
    call_minutes_per_month?: number;
    max_kb_docs?: number;
    max_channels?: number;
  };
};

function CompanyMark({ sub }: { sub: Subscription }) {
  const initials = sub.company_name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [showFallback, setShowFallback] = useState(false);
  const logo = sub.logo_url
    ? getCompanyLogoUrl(sub.company_id, sub.logo_url)
    : undefined;
  if (!showFallback && logo)
    return (
      <img
        src={logo}
        alt=""
        onError={() => setShowFallback(true)}
        className="h-9 w-9 rounded-xl object-cover ring-1 ring-emerald-100"
      />
    );
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
      {initials}
    </span>
  );
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<{
    sub: Subscription;
    plan: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  const loadSubscriptions = () => {
    setIsLoading(true);
    setError("");
    fetchApi<{ subscriptions?: Subscription[] }>("/admin/subscriptions")
      .then((res) => setSubscriptions(res.subscriptions || []))
      .catch(() => setError("Subscriptions could not be loaded. Please retry."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let active = true;
    fetchApi<{ subscriptions?: Subscription[] }>("/admin/subscriptions")
      .then((res) => {
        if (active) setSubscriptions(res.subscriptions || []);
      })
      .catch(() => {
        if (active)
          setError("Subscriptions could not be loaded. Please retry.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fetchApi<{ plans?: Plan[] }>("/plans")
      .then((res) => setPlans(res.plans || []))
      .catch(() => setPlans([]));
  }, []);

  const handlePlanChange = async (companyId: string, newPlan: string) => {
    setUpdatingId(companyId);
    try {
      await fetchApi(`/admin/companies/${companyId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ plan: newPlan }),
      });
      setPendingPlan(null);
      loadSubscriptions();
    } catch (err) {
      console.error("Failed to update plan", err);
      setActionError("Failed to update plan. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  const activeCount = subscriptions.filter(
    (sub) => sub.status === "active",
  ).length;
  const trialCount = subscriptions.filter(
    (sub) => sub.status === "trial" || sub.plan === "free_trial",
  ).length;
  const enterpriseCount = subscriptions.filter(
    (sub) => sub.plan === "enterprise",
  ).length;

  return (
    <div className={org.page}>
      {actionError && (
        <Toast
          message={actionError}
          tone="error"
          onClose={() => setActionError(null)}
        />
      )}
      <div className={org.pageHeader}>
        <div>
          <span className={org.eyebrow}>
            <Sparkles size={14} /> COMMERCIAL OPERATIONS
          </span>
          <h1 className={org.title}>Billing & plans</h1>
          <p className={org.subtitle}>
            Manage tenant subscriptions and plan limits.
          </p>
        </div>
        <div className={org.toolbar}>
          <Button
            variant="outline"
            onClick={loadSubscriptions}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      <div className={org.metrics} aria-label="Subscription summary">
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Building2 size={17} />
          </span>
          <span className={org.metricLabel}>Subscriptions</span>
          <strong className={org.metricValue}>{subscriptions.length}</strong>
          <span className={org.metricSub}>Tenant plans</span>
        </div>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <ShieldCheck size={17} />
          </span>
          <span className={org.metricLabel}>Active</span>
          <strong className={org.metricValue}>{activeCount}</strong>
          <span className={org.metricSub}>Current subscriptions</span>
        </div>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Clock3 size={17} />
          </span>
          <span className={org.metricLabel}>Trials</span>
          <strong className={org.metricValue}>{trialCount}</strong>
          <span className={org.metricSub}>On free trial</span>
        </div>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <CreditCard size={17} />
          </span>
          <span className={org.metricLabel}>Enterprise</span>
          <strong className={org.metricValue}>{enterpriseCount}</strong>
          <span className={org.metricSub}>Custom plans</span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <AlertTriangle size={18} />
          {error}
          <button
            className="ml-auto font-bold underline"
            onClick={loadSubscriptions}
          >
            Retry
          </button>
        </div>
      )}
      <div className={org.tableSurface}>
        <div className={org.sectionHeading}>
          <div>
            <h2>Tenant plans</h2>
            <p>Review current plans and adjust a company subscription.</p>
          </div>
          <span className={org.count}>{subscriptions.length} companies</span>
        </div>
        <div className={org.tableScroll}>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Company</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Plan</th>
                <th className="px-6 py-4 font-semibold">
                  Limits (Agents/Mins)
                </th>
                <th className="px-6 py-4 font-semibold">Change Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                    Loading subscriptions...
                  </td>
                </tr>
              ) : subscriptions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <CreditCard className="h-8 w-8 text-slate-300" />
                      <span>No subscriptions found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                subscriptions.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                      <CompanyMark sub={sub} />
                      <span className="min-w-0 truncate">
                        {sub.company_name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs capitalize ${sub.status === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"} border`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 capitalize font-semibold text-emerald-800">
                      <span className="inline-flex rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1">
                        {sub.plan.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {sub.limits?.max_agents?.toLocaleString() ?? 0} agents /{" "}
                      {sub.limits?.call_minutes_per_month?.toLocaleString() ??
                        0}{" "}
                      min
                    </td>
                    <td className="px-6 py-4">
                      <SmartSelect
                        value={sub.plan}
                        disabled={updatingId === sub.company_id}
                        onChange={(value) =>
                          setPendingPlan({ sub, plan: value })
                        }
                        searchable={false}
                        className="min-w-48 [&>button]:h-11 [&>button]:rounded-xl [&>button]:px-3 [&>button]:text-sm"
                        options={[
                          {
                            value: "free_trial",
                            label: "Free Trial",
                            icon: <Gift className="h-4 w-4" />,
                          },
                          {
                            value: "starter",
                            label: "Starter",
                            icon: <Rocket className="h-4 w-4" />,
                          },
                          {
                            value: "professional",
                            label: "Professional",
                            icon: <BriefcaseBusiness className="h-4 w-4" />,
                          },
                          {
                            value: "enterprise",
                            label: "Enterprise",
                            icon: <Crown className="h-4 w-4" />,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={Boolean(pendingPlan)}
        onClose={() => setPendingPlan(null)}
        title="Confirm plan change"
        description={
          pendingPlan
            ? `Update ${pendingPlan.sub.company_name}'s subscription immediately.`
            : undefined
        }
        className="max-w-md"
        footer={
          pendingPlan ? (
            <>
              <Button
                variant="outline"
                onClick={() => setPendingPlan(null)}
                disabled={Boolean(updatingId)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  handlePlanChange(pendingPlan.sub.company_id, pendingPlan.plan)
                }
                disabled={Boolean(updatingId)}
              >
                {updatingId ? "Updating…" : "Confirm change"}
              </Button>
            </>
          ) : undefined
        }
      >
        {pendingPlan && (
          <>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <CreditCard size={22} />
            </div>
            <p className="text-sm leading-6 text-slate-600">
              Change <strong>{pendingPlan.sub.company_name}</strong> from{" "}
              <strong>{pendingPlan.sub.plan.replaceAll("_", " ")}</strong> to{" "}
              <strong>{pendingPlan.plan.replaceAll("_", " ")}</strong>?
            </p>
            {(() => {
              const selected = plans.find(
                (plan) => plan.id === pendingPlan.plan,
              );
              if (!selected)
                return (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    Plan limits are unavailable right now. Please review the
                    plan before confirming.
                  </p>
                );
              return (
                <div className="mt-5 rounded-xl border border-emerald-100 bg-[#F7F8F5] p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Limit impact preview
                  </p>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
                    <span className="font-bold text-slate-500">Limit</span>
                    <span className="font-bold text-slate-500">Current</span>
                    <span className="font-bold text-emerald-800">
                      {selected.name}
                    </span>
                    <span>Agents</span>
                    <span>
                      {(
                        pendingPlan.sub.limits?.max_agents ?? 0
                      ).toLocaleString()}
                    </span>
                    <strong className="text-emerald-800">
                      {(selected.limits.max_agents ?? 0).toLocaleString()}
                    </strong>
                    <span>Minutes / month</span>
                    <span>
                      {(
                        pendingPlan.sub.limits?.call_minutes_per_month ?? 0
                      ).toLocaleString()}
                    </span>
                    <strong className="text-emerald-800">
                      {(
                        selected.limits.call_minutes_per_month ?? 0
                      ).toLocaleString()}
                    </strong>
                    <span>Channels</span>
                    <span>
                      {pendingPlan.sub.limits?.max_channels?.toLocaleString() ??
                        "—"}
                    </span>
                    <strong className="text-emerald-800">
                      {(selected.limits.max_channels ?? 0).toLocaleString()}
                    </strong>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </Modal>
    </div>
  );
}
