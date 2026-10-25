"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api/client";
import { Channel } from "@/lib/api/channels";
import {
  MessageSquare,
  Phone,
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  ChevronRight,
  Plus,
  AlertTriangle,
  Server,
  Hash,
  Activity,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import org from "../organization.module.css";
import { SmartSelect } from "@/components/ui/smart-select";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";

function ChannelIcon({ type }: { type: string }) {
  if (
    type === "enablex_voice" ||
    type === "twilio_voice" ||
    type === "exotel_voice" ||
    type === "exotel"
  ) {
    return <Phone className="h-3.5 w-3.5 text-emerald-700" />;
  }
  if (type === "web_chat" || type === "whatsapp") {
    return <MessageSquare className="h-3.5 w-3.5 text-emerald-700" />;
  }
  return <Server className="h-3.5 w-3.5 text-slate-400" />;
}

function channelTypeLabel(type: string) {
  const labels: Record<string, string> = {
    exotel_voice: "Exotel voice",
    twilio_voice: "Twilio voice",
    enablex_voice: "EnableX voice",
    web_chat: "Web chat",
    whatsapp: "WhatsApp",
  };
  return labels[type] || type.replace(/[_-]+/g, " ");
}

export default function AdminChannelsPage() {
  const router = useRouter();

  // Data State
  const [channels, setChannels] = useState<Channel[]>([]);
  const [companiesMap, setCompaniesMap] = useState<Record<string, string>>({});
  const [agentsMap, setAgentsMap] = useState<Record<string, string>>({});

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All Types");
  const [filterStatus, setFilterStatus] = useState("All Status");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: "",
    type: "exotel_voice",
    phone_number: "",
    agent_id: "",
    company_id: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateChannel = async () => {
    setIsCreating(true);
    try {
      const companyId =
        newChannel.company_id || Object.keys(companiesMap)[0] || "";
      if (!companyId) {
        alert("Please select a company");
        setIsCreating(false);
        return;
      }
      await fetchApi("/admin/channels", {
        method: "POST",
        body: JSON.stringify({
          ...newChannel,
          company_id: companyId,
        }),
      });
      setIsModalOpen(false);
      setNewChannel({
        name: "",
        type: "exotel_voice",
        phone_number: "",
        agent_id: "",
        company_id: "",
      });
      loadData();
    } catch (e) {
      alert("Failed to create channel");
    } finally {
      setIsCreating(false);
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [chanRes, compRes, agentRes] = await Promise.all([
        fetchApi<any>(`/admin/channels`),
        fetchApi<any>(`/admin/companies`),
        fetchApi<any>(`/admin/agents`),
      ]);
      setChannels(chanRes.channels || []);

      const cMap: Record<string, string> = {};
      if (compRes.companies)
        compRes.companies.forEach((c: any) => {
          cMap[c.id] = c.name;
        });
      setCompaniesMap(cMap);

      const aMap: Record<string, string> = {};
      if (agentRes.agents)
        agentRes.agents.forEach((a: any) => {
          aMap[a.id] = a.name;
        });
      setAgentsMap(aMap);
    } catch (err: any) {
      console.error("Failed to load channels", err);
      setError("We couldn't retrieve your communication channels right now.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter Logic
  const filteredChannels = channels.filter((channel) => {
    const matchesSearch =
      channel.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.phone_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      companiesMap[channel.company_id]
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      agentsMap[channel.agent_id]
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());

    const isVoice =
      channel.type === "twilio_voice" ||
      channel.type === "exotel_voice" ||
      channel.type === "exotel" ||
      channel.type === "enablex_voice";
    const isChat = channel.type === "web_chat" || channel.type === "whatsapp";

    const matchesType =
      filterType === "All Types" ||
      (filterType === "Voice" && isVoice) ||
      (filterType === "Chat" && isChat);

    const matchesStatus =
      filterStatus === "All Status" ||
      (filterStatus === "Active" && channel.is_active) ||
      (filterStatus === "Inactive" && !channel.is_active);

    return matchesSearch && matchesType && matchesStatus;
  });

  // KPIs
  const totalChannels = channels.length;
  const activeChannels = channels.filter((c) => c.is_active).length;
  const voiceChannels = channels.filter(
    (c) =>
      c.type === "twilio_voice" ||
      c.type === "exotel_voice" ||
      c.type === "exotel" ||
      c.type === "enablex_voice",
  ).length;
  const chatChannels = channels.filter(
    (c) => c.type === "web_chat" || c.type === "whatsapp",
  ).length;

  const handleOpenChannel = (channel: Channel) => {
    router.push(
      `/admin/channels/${channel.id}?companyId=${channel.company_id}`,
    );
  };

  const handleKpiClick = (type: string, status: string) => {
    setFilterType(type);
    setFilterStatus(status);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 text-center">
        <div>
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-slate-900">
            Unable to load channels
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={org.page}>
      {/* ── Header ───────────────────────────────────────────── */}
      <div className={org.pageHeader}>
        <div>
          <span className={org.eyebrow}>
            <Activity size={14} /> COMMUNICATION OPERATIONS
          </span>
          <div className="flex items-center gap-3">
            <h1 className={org.title}>
              Channels
              {isLoading && (
                <RefreshCw className="h-5 w-5 animate-spin text-sage-500" />
              )}
            </h1>
          </div>
          <p className={org.subtitle}>
            Monitor voice and chat connections across your organization.
          </p>
        </div>
        <div className={org.toolbar}>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Create Channel
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 bg-slate-100 rounded-xl border border-slate-200"
            ></div>
          ))}
        </div>
      ) : (
        <div className={org.metrics}>
          <button
            onClick={() => handleKpiClick("All Types", "All Status")}
            aria-pressed={
              filterType === "All Types" && filterStatus === "All Status"
            }
            className={org.metricButton}
          >
            <span className={org.metricIcon}>
              <Server size={17} />
            </span>
            <span className={org.metricLabel}>Total channels</span>
            <strong className={org.metricValue}>{totalChannels}</strong>
            <span className={org.metricSub}>All configured channels</span>
          </button>
          <button
            onClick={() => handleKpiClick("All Types", "Active")}
            aria-pressed={filterStatus === "Active"}
            className={org.metricButton}
          >
            <span className={org.metricIcon}>
              <Activity size={17} />
            </span>
            <span className={org.metricLabel}>Active</span>
            <strong className={org.metricValue}>{activeChannels}</strong>
            <span className={org.metricSub}>Operational channels</span>
          </button>
          <button
            onClick={() => handleKpiClick("Voice", "All Status")}
            aria-pressed={filterType === "Voice"}
            className={org.metricButton}
          >
            <span className={org.metricIcon}>
              <Phone size={17} />
            </span>
            <span className={org.metricLabel}>Voice / telephony</span>
            <strong className={org.metricValue}>{voiceChannels}</strong>
            <span className={org.metricSub}>Exotel & Twilio lines</span>
          </button>
          <button
            onClick={() => handleKpiClick("Chat", "All Status")}
            aria-pressed={filterType === "Chat"}
            className={org.metricButton}
          >
            <span className={org.metricIcon}>
              <MessageSquare size={17} />
            </span>
            <span className={org.metricLabel}>Web / chat</span>
            <strong className={org.metricValue}>{chatChannels}</strong>
            <span className={org.metricSub}>Digital properties</span>
          </button>
        </div>
      )}

      {/* ── Content Table Area ───────────────────────────────────────────── */}
      <div className={`${org.tableSurface} mt-5`}>
        <div className={org.sectionHeading}>
          <div>
            <h2>Channel directory</h2>
            <p>
              Select a channel to inspect its connection, calls and
              configuration.
            </p>
          </div>
          <span className={org.count}>{filteredChannels.length} shown</span>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-4 pt-3 pb-3 gap-3">
          <div className="flex gap-2 items-center flex-wrap">
            <SmartSelect
              value={filterType}
              onChange={setFilterType}
              searchable={false}
              className="w-32 [&>button]:h-8 [&>button]:rounded-lg [&>button]:px-3 [&>button]:text-xs"
              options={[
                { value: "All Types", label: "All Types" },
                { value: "Voice", label: "Voice" },
                { value: "Chat", label: "Chat" },
              ]}
            />
            <SmartSelect
              value={filterStatus}
              onChange={setFilterStatus}
              searchable={false}
              className="w-32 [&>button]:h-8 [&>button]:rounded-lg [&>button]:px-3 [&>button]:text-xs"
              options={[
                { value: "All Status", label: "All Status" },
                { value: "Active", label: "Active", badge: "Ready" },
                { value: "Inactive", label: "Inactive", badge: "Review" },
              ]}
            />
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-sm ml-2">
              <button
                onClick={() => setViewMode("table")}
                aria-label="Table view"
                aria-pressed={viewMode === "table"}
                className={`p-1 rounded-md transition-all ${viewMode === "table" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                className={`p-1 rounded-md transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search channels..."
              className="h-8 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-slate-400 focus:bg-white transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table View */}
        {isLoading ? (
          <div className="p-12 text-center text-sm text-slate-400">
            Loading channels…
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className={org.empty}>
            <span className={org.emptyIcon}>
              <Server size={25} />
            </span>
            <strong>No channels found</strong>
            <p>
              Try another search or filter, or create a new communication
              channel.
            </p>
          </div>
        ) : viewMode === "table" ? (
          <div className={org.tableScroll}>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 text-left">Channel</th>
                  <th className="px-5 py-3 text-left">Endpoint</th>
                  <th className="px-5 py-3 text-left">Company</th>
                  <th className="px-5 py-3 text-left">AI Agent</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Activity</th>
                  <th className="px-5 py-3 text-right sticky right-0 bg-slate-50/80 shadow-[-4px_0_12px_rgba(0,0,0,0.03)]">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {filteredChannels.map((channel) => {
                  return (
                    <tr
                      key={channel.id}
                      onClick={() => handleOpenChannel(channel)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleOpenChannel(channel)
                      }
                      tabIndex={0}
                      className={`transition-all duration-200 cursor-pointer group focus:outline-none focus:bg-slate-50 ${channel.is_active ? "hover:bg-slate-50/70" : "opacity-60 bg-slate-50/40 hover:opacity-100 hover:bg-slate-50/70 grayscale-[20%]"}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <ChannelIcon type={channel.type} />
                          <div>
                            <p className="font-medium text-slate-900 text-sm">
                              {channel.name}
                            </p>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                              {channelTypeLabel(channel.type)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {channel.phone_number ? (
                          <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {channel.phone_number}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Web / App
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-slate-700">
                          {companiesMap[channel.company_id] ||
                            "Workspace unavailable"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        {channel.agent_id ? (
                          <p className="text-sm text-slate-700">
                            {agentsMap[channel.agent_id] || "Agent unavailable"}
                          </p>
                        ) : (
                          <p className="text-sm text-slate-400 italic">
                            Unassigned
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge
                          tone={channel.is_active ? "success" : "neutral"}
                        >
                          {channel.is_active ? "Active" : "Inactive"}
                        </StatusBadge>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                          {channel.updated_at
                            ? formatDistanceToNow(
                                new Date(channel.updated_at),
                                { addSuffix: true },
                              )
                            : "Recent"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-right sticky right-0 bg-white group-hover:bg-slate-50/70 transition-colors">
                        <ChevronRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity ml-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/30">
            {filteredChannels.map((channel) => {
              return (
                <div
                  key={channel.id}
                  onClick={() => handleOpenChannel(channel)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleOpenChannel(channel)
                  }
                  tabIndex={0}
                  className={`group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer active:scale-[0.99] focus:outline-none focus:border-slate-400 ${!channel.is_active ? "opacity-60 grayscale-[20%] hover:opacity-100" : ""}`}
                >
                  <div className="px-4 py-3 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                      <ChannelIcon type={channel.type} />
                      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        {channelTypeLabel(channel.type)}
                      </p>
                    </div>
                    <StatusBadge
                      tone={channel.is_active ? "success" : "neutral"}
                    >
                      {channel.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </div>

                  <div className="p-4 flex-1 flex flex-col relative">
                    <ChevronRight className="absolute right-4 top-4 w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity" />

                    <h3 className="text-sm font-semibold text-slate-900 mb-1 pr-6">
                      {channel.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {companiesMap[channel.company_id] ||
                        "Workspace unavailable"}
                    </p>

                    <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Endpoint
                      </span>
                      {channel.phone_number ? (
                        <span className="font-mono text-xs text-slate-700">
                          {channel.phone_number}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Web / App
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">
                          Agent
                        </span>
                        <span className="font-semibold text-slate-700">
                          {channel.agent_id
                            ? agentsMap[channel.agent_id] || "Agent unavailable"
                            : "Unassigned"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">
                          Activity
                        </span>
                        <span className="font-semibold text-slate-600">
                          {channel.updated_at
                            ? formatDistanceToNow(
                                new Date(channel.updated_at),
                                { addSuffix: true },
                              )
                            : "Recent"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {isModalOpen && (
        <Modal
          open={isModalOpen}
          onClose={() => !isCreating && setIsModalOpen(false)}
          title="Create new channel"
          description="Connect a voice or web channel to a company workspace."
          className="max-w-md"
          footer={
            <div className="flex w-full justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                disabled={isCreating}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                disabled={isCreating || !newChannel.name}
                className="rounded-xl bg-[#087F5B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#066D4E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Create channel"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Channel Name
              </label>
              <input
                type="text"
                value={newChannel.name}
                onChange={(e) =>
                  setNewChannel({ ...newChannel, name: e.target.value })
                }
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-none focus:border-slate-400"
                placeholder="e.g., Exotel Sales Line"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Provider / Type
              </label>
              <SmartSelect
                value={newChannel.type}
                onChange={(value) =>
                  setNewChannel({ ...newChannel, type: value })
                }
                searchable={false}
                options={[
                  { value: "exotel_voice", label: "Exotel Voice" },
                  { value: "twilio_voice", label: "Twilio Voice" },
                  { value: "enablex_voice", label: "EnableX Voice" },
                  { value: "web_chat", label: "Web Chat" },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Phone Number (Optional)
              </label>
              <input
                type="text"
                value={newChannel.phone_number}
                onChange={(e) =>
                  setNewChannel({ ...newChannel, phone_number: e.target.value })
                }
                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 outline-none focus:border-slate-400"
                placeholder="e.g., +919876543210"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Company <span className="text-red-400">*</span>
              </label>
              <SmartSelect
                value={newChannel.company_id}
                onChange={(value) =>
                  setNewChannel({ ...newChannel, company_id: value })
                }
                placeholder="Select Company"
                searchPlaceholder="Search companies…"
                options={Object.entries(companiesMap).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Assign Agent
              </label>
              <SmartSelect
                value={newChannel.agent_id}
                onChange={(value) =>
                  setNewChannel({ ...newChannel, agent_id: value })
                }
                placeholder="No Agent Selected"
                searchPlaceholder="Search agents…"
                options={Object.entries(agentsMap).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
