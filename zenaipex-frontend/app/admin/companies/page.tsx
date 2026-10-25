"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { fetchApi, getCompanyLogoUrl } from "@/lib/api/client";
import { useBranding } from "@/hooks/use-branding";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Search,
  Building2,
  Loader2,
  Trash2,
  AlertTriangle,
  Users,
  ShieldCheck,
  X,
  ArrowRight,
  FileText,
  MessageSquare,
  Plus,
  CheckCircle2,
  ListFilter,
  CircleCheck,
  PauseCircle,
  Layers3,
  Gift,
  Rocket,
  BriefcaseBusiness,
  Crown,
} from "lucide-react";
import { formatSystemDateTime } from "@/lib/utils";
import org from "../organization.module.css";
import { SmartSelect } from "@/components/ui/smart-select";
import { Drawer } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";

type Company = {
  id: string;
  name: string;
  logo_url?: string;
  slug?: string;
  owner_name?: string;
  owner_email?: string;
  plan?: string;
  is_active: boolean;
  agents_count?: number;
  documents_count?: number;
  conversations_count?: number;
  channels_count?: number;
  setup_progress?: number;
  setup_completed_steps?: string[];
  setup_missing_steps?: string[];
  setup_total_steps?: number;
  created_at: string;
};

type CreateCompanyForm = {
  name: string;
  industry: string;
  country: string;
  timezone: string;
  plan: string;
  business_email: string;
  business_phone: string;
  business_address: string;
  business_description: string;
};

const initialCreateForm: CreateCompanyForm = {
  name: "",
  industry: "",
  country: "IN",
  timezone: "Asia/Kolkata",
  plan: "free_trial",
  business_email: "",
  business_phone: "",
  business_address: "",
  business_description: "",
};

export default function AdminCompaniesPage() {
  const { platformName } = useBranding();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "suspended"
  >("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] =
    useState<CreateCompanyForm>(initialCreateForm);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    setIsLoading(true);
    try {
      const data = await fetchApi<{ companies?: Company[] }>(
        "/admin/companies",
      );
      setCompanies(data.companies || []);
    } catch (err) {
      console.error("Failed to load companies", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteCompany() {
    if (!companyToDelete) return;
    setIsDeleting(true);
    try {
      await fetchApi(`/admin/companies/${companyToDelete.id}`, {
        method: "DELETE",
      });
      setCompanyToDelete(null);
      loadCompanies();
    } catch (err: unknown) {
      alert(
        "Failed to delete company: " +
          (err instanceof Error ? err.message : "Unknown error"),
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function updateCreateField(field: keyof CreateCompanyForm, value: string) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCreateCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    setIsCreating(true);
    try {
      const company = await fetchApi<Company>("/admin/companies", {
        method: "POST",
        body: JSON.stringify({
          ...createForm,
          industry: createForm.industry || undefined,
          business_email: createForm.business_email || undefined,
          business_phone: createForm.business_phone || undefined,
          business_address: createForm.business_address || undefined,
          business_description: createForm.business_description || undefined,
        }),
      });
      setCompanies((current) => [company, ...current]);
      setSelectedCompany(company);
      setCreateForm(initialCreateForm);
      setIsCreateOpen(false);
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : "Company could not be created.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  const filtered = companies.filter((c) => {
    const matchesSearch =
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.owner_email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? c.is_active
          : !c.is_active;
    const matchesPlan = planFilter === "all" ? true : c.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const uniquePlans = Array.from(
    new Set(
      companies
        .map((c) => c.plan)
        .filter((plan): plan is string => Boolean(plan)),
    ),
  );
  const activeCount = companies.filter((c) => c.is_active).length;
  const suspendedCount = companies.length - activeCount;
  const agentsCount = companies.reduce(
    (sum, company) => sum + (Number(company.agents_count) || 0),
    0,
  );
  const draftSteps = [
    { label: "Workspace identity", ready: Boolean(createForm.name.trim()) },
    {
      label: "Business contact",
      ready: Boolean(createForm.business_email || createForm.business_phone),
    },
    {
      label: "AI context",
      ready: Boolean(createForm.industry || createForm.business_description),
    },
  ];
  const draftReady = draftSteps.filter((step) => step.ready).length;
  const draftProgress = Math.round((draftReady / draftSteps.length) * 100);

  return (
    <div className={org.page}>
      <div className={org.pageHeader}>
        <div>
          <span className={org.eyebrow}>
            <Building2 size={14} /> ORGANIZATION DIRECTORY
          </span>
          <h1 className={org.title}>Companies & users</h1>
          <p className={org.subtitle}>
            Manage tenant companies and their owners across {platformName}.
          </p>
        </div>
        <div className={org.toolbar}>
          <Button
            onClick={() => {
              setCreateError("");
              setIsCreateOpen(true);
            }}
            className="bg-[#087F5B] hover:bg-[#066D4E] text-white whitespace-nowrap"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create company
          </Button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 w-full sm:w-64"
            />
          </div>
          <SmartSelect
            value={statusFilter}
            onChange={(value) =>
              setStatusFilter(value as "all" | "active" | "suspended")
            }
            searchable={false}
            className="w-40"
            options={[
              {
                value: "all",
                label: "All Statuses",
                icon: <ListFilter className="h-4 w-4" />,
              },
              {
                value: "active",
                label: "Active",
                badge: "Ready",
                icon: <CircleCheck className="h-4 w-4" />,
              },
              {
                value: "suspended",
                label: "Suspended",
                badge: "Review",
                icon: <PauseCircle className="h-4 w-4" />,
              },
            ]}
          />
          <SmartSelect
            value={planFilter}
            onChange={setPlanFilter}
            searchable={false}
            className="w-40"
            options={[
              {
                value: "all",
                label: "All Plans",
                icon: <Layers3 className="h-4 w-4" />,
              },
              ...uniquePlans.map((plan) => ({
                value: plan,
                label: plan.replace("_", " "),
                icon:
                  plan === "free_trial" ? (
                    <Gift className="h-4 w-4" />
                  ) : plan === "starter" ? (
                    <Rocket className="h-4 w-4" />
                  ) : plan === "professional" ? (
                    <BriefcaseBusiness className="h-4 w-4" />
                  ) : plan === "enterprise" ? (
                    <Crown className="h-4 w-4" />
                  ) : (
                    <Layers3 className="h-4 w-4" />
                  ),
              })),
            ]}
          />
        </div>
      </div>

      <div className={org.metrics} aria-label="Company summary">
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Building2 size={17} />
          </span>
          <span className={org.metricLabel}>Total companies</span>
          <strong className={org.metricValue}>{companies.length}</strong>
          <span className={org.metricSub}>Registered tenants</span>
        </div>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <ShieldCheck size={17} />
          </span>
          <span className={org.metricLabel}>Active</span>
          <strong className={org.metricValue}>{activeCount}</strong>
          <span className={org.metricSub}>Currently operating</span>
        </div>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <AlertTriangle size={17} />
          </span>
          <span className={org.metricLabel}>Suspended</span>
          <strong className={org.metricValue}>{suspendedCount}</strong>
          <span className={org.metricSub}>Require review</span>
        </div>
        <div className={org.metric}>
          <span className={org.metricIcon}>
            <Users size={17} />
          </span>
          <span className={org.metricLabel}>AI agents</span>
          <strong className={org.metricValue}>{agentsCount}</strong>
          <span className={org.metricSub}>Across all companies</span>
        </div>
      </div>

      <div className={org.tableSurface}>
        <div className={org.sectionHeading}>
          <div>
            <h2>Company directory</h2>
            <p>Search and filter the organizations on your platform.</p>
          </div>
          <span className={org.count}>{filtered.length} shown</span>
        </div>
        <div className={org.tableScroll}>
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 font-semibold">Company</th>
                <th className="px-3 py-3 font-semibold">Owner</th>
                <th className="px-3 py-3 font-semibold">Plan</th>
                <th className="px-3 py-3 font-semibold">Resources</th>
                <th className="px-3 py-3 font-semibold">Setup</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap">
                  Created
                </th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-10 text-center text-slate-400"
                  >
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Loading companies…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-10 text-center text-slate-400"
                  >
                    <Building2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    No companies found.
                  </td>
                </tr>
              ) : (
                filtered.map((company) => (
                  <tr
                    key={company.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-3 py-3 align-middle">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {getCompanyLogoUrl(company.id, company.logo_url) ? (
                          <img
                            src={getCompanyLogoUrl(
                              company.id,
                              company.logo_url,
                            )}
                            alt=""
                            className="h-8 w-8 rounded-xl object-cover ring-1 ring-emerald-100"
                          />
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                            {company.name
                              .split(/\s+/)
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedCompany(company)}
                          className="text-left hover:text-emerald-800 hover:underline"
                          aria-label={`Quick view ${company.name}`}
                        >
                          {company.name}
                        </button>
                        {company.slug === "admin_workspace" && (
                          <span className="text-[10px] font-bold bg-sage-100 text-sage-700 border border-sage-200 px-1 py-0.5 rounded uppercase tracking-wide whitespace-nowrap shrink-0">
                            ZeniaOne
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="text-slate-800 font-medium">
                        {company.owner_name || "—"}
                      </div>
                      <div
                        className="text-xs text-slate-500"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {company.owner_email || ""}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <span className="capitalize text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg whitespace-nowrap">
                        {company.plan?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle text-xs text-slate-500">
                      <div className="space-y-0.5">
                        <div className="whitespace-nowrap">
                          {company.agents_count ?? 0} agents
                        </div>
                        <div className="whitespace-nowrap">
                          {company.documents_count ?? 0} docs
                        </div>
                        <div className="whitespace-nowrap">
                          {company.conversations_count ?? 0} conversations
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle min-w-[155px]">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          {company.setup_progress ?? 0}% ready
                        </span>
                        <span className="text-slate-400">
                          {company.setup_completed_steps?.length ?? 0}/
                          {company.setup_total_steps ?? 6}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#08A66A] transition-all"
                          style={{ width: `${company.setup_progress ?? 0}%` }}
                        />
                      </div>
                      <p
                        className="mt-1 max-w-[160px] truncate text-[11px] text-slate-400"
                        title={company.setup_missing_steps?.join(", ")}
                      >
                        {company.setup_missing_steps?.[0]
                          ? `Next: ${company.setup_missing_steps[0]}`
                          : "Workspace ready"}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <StatusBadge
                        tone={company.is_active ? "success" : "error"}
                      >
                        {company.is_active ? "Active" : "Suspended"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-3 align-middle text-slate-500 whitespace-nowrap text-xs">
                      {formatSystemDateTime(company.created_at)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/companies/${company.id}`}
                          className="shrink-0"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-slate-600 hover:text-sage-700 shrink-0 whitespace-nowrap"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCompanyToDelete(company)}
                          title="Delete Permanently"
                          className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCompany && (
        <Drawer
          open={Boolean(selectedCompany)}
          onClose={() => setSelectedCompany(null)}
          title={selectedCompany.name}
          description={`${selectedCompany.owner_name || "No owner name"} · ${selectedCompany.owner_email || "No email"}`}
          className="max-w-md bg-[#F7F8F5]"
          footer={
            <Link
              href={`/admin/companies/${selectedCompany.id}`}
              className="flex w-full items-center justify-between rounded-xl bg-[#087F5B] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#066D4E]"
            >
              Open full workspace <ArrowRight size={17} />
            </Link>
          }
        >
          <span className={org.eyebrow}>WORKSPACE SNAPSHOT</span>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#DCE7DF] bg-white p-4">
              <ShieldCheck
                size={18}
                className={
                  selectedCompany.is_active
                    ? "text-emerald-700"
                    : "text-red-600"
                }
              />
              <strong className="mt-2 block text-sm">
                {selectedCompany.is_active ? "Active" : "Suspended"}
              </strong>
              <span className="text-xs text-slate-500">Operating status</span>
            </div>
            <div className="rounded-xl border border-[#DCE7DF] bg-white p-4">
              <Building2 size={18} className="text-emerald-700" />
              <strong className="mt-2 block text-sm capitalize">
                {selectedCompany.plan?.replaceAll("_", " ") || "Unknown"}
              </strong>
              <span className="text-xs text-slate-500">Current plan</span>
            </div>
            <div className="rounded-xl border border-[#DCE7DF] bg-white p-4">
              <Users size={18} className="text-emerald-700" />
              <strong className="mt-2 block text-sm">
                {selectedCompany.agents_count ?? 0} agents
              </strong>
              <span className="text-xs text-slate-500">Assigned workforce</span>
            </div>
            <div className="rounded-xl border border-[#DCE7DF] bg-white p-4">
              <MessageSquare size={18} className="text-emerald-700" />
              <strong className="mt-2 block text-sm">
                {selectedCompany.conversations_count ?? 0} conversations
              </strong>
              <span className="text-xs text-slate-500">
                Stored interactions
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#DCE7DF] bg-white p-4 text-sm text-slate-600">
            <FileText size={17} className="text-emerald-700" />
            {selectedCompany.documents_count ?? 0} knowledge documents
          </div>
          <div className="mt-4 rounded-xl border border-[#DCE7DF] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <strong className="block text-sm text-[#14261F]">
                  Setup readiness
                </strong>
                <span className="text-xs text-slate-500">
                  {selectedCompany.setup_completed_steps?.length ?? 0} of{" "}
                  {selectedCompany.setup_total_steps ?? 6} essentials completed
                </span>
              </div>
              <strong className="text-sm text-[#087F5B]">
                {selectedCompany.setup_progress ?? 0}%
              </strong>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E8F0E9]">
              <div
                className="h-full rounded-full bg-[#08A66A]"
                style={{ width: `${selectedCompany.setup_progress ?? 0}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(selectedCompany.setup_completed_steps || []).map((step) => (
                <span
                  key={step}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800"
                >
                  <CheckCircle2 size={11} />
                  {step}
                </span>
              ))}
              {(selectedCompany.setup_missing_steps || [])
                .slice(0, 2)
                .map((step) => (
                  <span
                    key={step}
                    className="rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-500"
                  >
                    {step}
                  </span>
                ))}
            </div>
          </div>
        </Drawer>
      )}

      {isCreateOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#CFE9FA]/75 p-4 backdrop-blur-md"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isCreating)
                setIsCreateOpen(false);
            }}
          >
            <form
              onSubmit={handleCreateCompany}
              className="my-6 w-full max-w-4xl overflow-hidden rounded-2xl border border-[#DCE7DF] bg-[#F9FBF8] shadow-2xl"
              aria-label="Create a company"
            >
              <div className="flex items-start justify-between border-b border-[#DCE7DF] bg-[#073B2A] px-6 py-5 text-white">
                <div>
                  <span className="text-xs font-bold tracking-[0.16em] text-emerald-200">
                    NEW TENANT WORKSPACE
                  </span>
                  <h2 className="mt-1 text-xl font-bold">Create company</h2>
                  <p className="mt-1 text-sm text-emerald-100">
                    Create the workspace first, then complete its live setup
                    checklist.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg p-2 text-emerald-100 hover:bg-white/10"
                  aria-label="Close create company"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid lg:grid-cols-[260px_1fr]">
                <aside className="border-b border-[#DCE7DF] bg-[#EEF5EF] p-6 lg:border-b-0 lg:border-r">
                  <span className="text-xs font-bold tracking-[0.15em] text-[#087F5B]">
                    SETUP STATUS
                  </span>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <strong className="text-3xl tracking-tight text-[#14261F]">
                        {draftProgress}%
                      </strong>
                      <p className="mt-1 text-xs text-slate-500">
                        Ready to create
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[#087F5B] shadow-sm">
                      {draftReady}/3
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#D9E8DC]">
                    <div
                      className="h-full rounded-full bg-[#08A66A] transition-all duration-300"
                      style={{ width: `${draftProgress}%` }}
                    />
                  </div>
                  <div className="mt-7 space-y-4">
                    {draftSteps.map((step, index) => (
                      <div key={step.label} className="flex gap-3">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.ready ? "bg-[#087F5B] text-white" : "border border-[#BDD6C2] bg-white text-[#6B7F72]"}`}
                        >
                          {step.ready ? <CheckCircle2 size={14} /> : index + 1}
                        </span>
                        <div>
                          <strong className="block text-sm text-[#253A30]">
                            {step.label}
                          </strong>
                          <span className="text-xs text-slate-500">
                            {step.ready
                              ? "Added"
                              : index === 0
                                ? "Required before creation"
                                : "Can be completed now or later"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 rounded-xl border border-[#CFE1D2] bg-white/80 p-3 text-xs leading-5 text-[#50665A]">
                    <strong className="block text-[#253A30]">
                      After creation
                    </strong>
                    Assign an AI agent, add business hours, knowledge and
                    channels from the company workspace.
                  </div>
                </aside>
                <div className="p-6">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#14261F]">
                        Company profile
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Start with the details your AI needs to understand the
                        business.
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      Step 1 of 3
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                      Company name
                      <input
                        required
                        minLength={2}
                        value={createForm.name}
                        onChange={(e) =>
                          updateCreateField("name", e.target.value)
                        }
                        placeholder="Acme Healthcare"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Industry
                      <input
                        value={createForm.industry}
                        onChange={(e) =>
                          updateCreateField("industry", e.target.value)
                        }
                        placeholder="Healthcare, retail…"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Starting plan
                      <SmartSelect
                        value={createForm.plan}
                        onChange={(value) => updateCreateField("plan", value)}
                        searchable={false}
                        className="mt-1.5"
                        options={[
                          { value: "free_trial", label: "Free trial" },
                          { value: "starter", label: "Starter" },
                          { value: "professional", label: "Professional" },
                          { value: "enterprise", label: "Enterprise" },
                        ]}
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Business email
                      <input
                        type="email"
                        value={createForm.business_email}
                        onChange={(e) =>
                          updateCreateField("business_email", e.target.value)
                        }
                        placeholder="hello@company.com"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Business phone
                      <input
                        value={createForm.business_phone}
                        onChange={(e) =>
                          updateCreateField("business_phone", e.target.value)
                        }
                        placeholder="+91…"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-[#DCE7DF] bg-[#F5F8F5] px-3 py-2.5 text-xs text-slate-500">
                      <span>
                        Locale will start with{" "}
                        <strong className="font-semibold text-[#304A3C]">
                          India · Asia/Kolkata
                        </strong>
                      </span>
                      <span>
                        Address, hours and detailed AI context are added after
                        creation.
                      </span>
                    </div>
                    {createError && (
                      <p
                        role="alert"
                        className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                      >
                        {createError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-[#DCE7DF] bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">
                  You will be the provisional owner until the company team is
                  invited.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCreating}
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="bg-[#087F5B] text-white hover:bg-[#066D4E]"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create workspace
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>,
          document.body,
        )}

      {companyToDelete && (
        <Modal
          open={Boolean(companyToDelete)}
          onClose={() => !isDeleting && setCompanyToDelete(null)}
          title="Delete company permanently?"
          description={`This action cannot be undone for ${companyToDelete.name}.`}
          className="max-w-md"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setCompanyToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteCompany}
                disabled={isDeleting}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete permanently"
                )}
              </Button>
            </>
          }
        >
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3 text-red-700">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-6">
                All associated agents, knowledge bases, vectors, usage data and
                other company records will be permanently removed.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
