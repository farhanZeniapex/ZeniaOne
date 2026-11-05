"use client";

import React from "react";
import { VoiceCloningStudio } from "@/components/VoiceCloningStudio";
import VoiceTuningPanel from "@/components/agents/VoiceTuningPanel";
import { SmartSelect } from "@/components/ui/smart-select";
import { API_BASE_URL } from "@/lib/api/client";
import {
  Mic,
  Users,
  Sliders,
  Play,
  Square,
  Loader2,
} from "lucide-react";

export interface CustomVoiceGalleryProps {
  isVoiceStudioOpen: boolean;
  setIsVoiceStudioOpen: (open: boolean) => void;
  loadCustomVoices: () => Promise<void> | void;
  filteredVoices: any[];
  viewMode: "grid" | "list";
  selectedVoiceId: string | null;
  setSelectedVoiceId: (id: string | null) => void;
  getVoiceForPicker: (voiceId: string) => any;
  previewingVoiceId: string | null;
  handlePlayVoicePreview: (voice: any) => void;
  assignedAgentsForVoice: (agents: any[], voice: any) => any[];
  agents: any[];
  handleUpdateVoice: (agentId: string, voiceId: string) => Promise<void>;
  isPreviewLoading: boolean;
  setCustomVoices: React.Dispatch<React.SetStateAction<any[]>>;
  setSuccessToast: (msg: string | null) => void;
  setPreviewError: (msg: string | null) => void;
  voiceFilter?: string;
  testText: Record<string, string>;
  setTestText: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isGeneratingVoiceId: string | null;
  testingCustomVoiceId: string | null;
  setTestingCustomVoiceId: (id: string | null) => void;
  isLivePlaying: Record<string, boolean>;
  setIsLivePlaying: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  testAudioSrc: Record<string, string>;
  voiceSettings: Record<string, any>;
  gainNodesRef: React.MutableRefObject<Record<string, any>>;
  handleTestCustomVoice: (voice: any, lang?: string, forceRegen?: boolean) => void;
  testLanguage: Record<string, string>;
  setTestLanguage: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  playbackRate: Record<string, number>;
  handleVoiceParamChange: (voiceId: string, param: any, value: number) => any;
  triggerInstantAudioPreview: (voiceId: string) => void;
  sliderSaveStatus?: any;
  isAudioLiveTuned?: any;
  updatingAgentId: string | null;
}

export default function CustomVoiceGallery({
  isVoiceStudioOpen,
  setIsVoiceStudioOpen,
  loadCustomVoices,
  filteredVoices,
  viewMode,
  selectedVoiceId,
  setSelectedVoiceId,
  getVoiceForPicker,
  previewingVoiceId,
  handlePlayVoicePreview,
  assignedAgentsForVoice,
  agents,
  handleUpdateVoice,
  isPreviewLoading,
  setCustomVoices,
  setSuccessToast,
  setPreviewError,
  voiceFilter,
  testText,
  setTestText,
  isGeneratingVoiceId,
  testingCustomVoiceId,
  setTestingCustomVoiceId,
  isLivePlaying,
  setIsLivePlaying,
  testAudioSrc,
  voiceSettings,
  gainNodesRef,
  handleTestCustomVoice,
  testLanguage,
  setTestLanguage,
  playbackRate,
  handleVoiceParamChange,
  triggerInstantAudioPreview,
  sliderSaveStatus,
  isAudioLiveTuned,
  updatingAgentId,
}: CustomVoiceGalleryProps) {
  return (
        <div className="flex flex-col gap-6 items-start relative">
          {/* Studio Modal */}
          <VoiceCloningStudio
            isOpen={isVoiceStudioOpen}
            onClose={() => setIsVoiceStudioOpen(false)}
            onVoiceCreated={(v) => {
              loadCustomVoices();
              setIsVoiceStudioOpen(false);
            }}
          />

          {/* Right Panel: Gallery */}
          <div className="w-full flex-1 pb-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
              {/* LEFT SIDE (70%): Gallery Grid / List */}
              <div
                className={`col-span-1 lg:col-span-8 ${viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "flex flex-col gap-2"}`}
              >
                {filteredVoices.length === 0 ? (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-200 border-dashed">
                    <Mic className="h-12 w-12 text-slate-300 mb-4" />
                    <h4 className="text-sm font-bold text-slate-700">
                      No Custom Voices Found
                    </h4>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm">
                      Try adjusting your search or filter settings.
                    </p>
                  </div>
                ) : (
                  filteredVoices.map((voice) => {
                    const isSelected = selectedVoiceId === voice.id;
                    const previewVoice = getVoiceForPicker(voice.voice_id || voice.id);
                    const isPlaying = previewingVoiceId === previewVoice.id || previewingVoiceId === voice.id;
                    const assignedAgents = assignedAgentsForVoice(agents, voice);
                    const isMale = voice.gender === "Male";
                    const isFemale = voice.gender === "Female";

                    if (viewMode === "list") {
                      return (
                        <div
                          key={voice.id}
                          onClick={() => setSelectedVoiceId(voice.id)}
                          className={`flex flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:flex-row sm:items-center cursor-pointer ${
                            isSelected ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-slate-200"
                          }`}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold ${
                                isMale
                                  ? "border-blue-200 bg-blue-50 text-blue-800"
                                  : isFemale
                                    ? "border-purple-200 bg-purple-50 text-purple-800"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                              }`}
                            >
                              {voice.name?.charAt(0)?.toUpperCase() || "C"}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-sm font-extrabold text-slate-900">{voice.name}</h3>
                                <span className="rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                                  ✨ Cloned
                                </span>
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                    isMale
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : isFemale
                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  }`}
                                >
                                  {isMale ? "♂ Male" : isFemale ? "♀ Female" : "✨ Active"}
                                </span>
                              </div>
                              <p className="truncate text-[11px] text-emerald-700">Cloned Voice Persona</p>
                              <p className="truncate text-[11px] text-slate-500">{voice.description || "Custom cloned voice"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 sm:w-44">
                            <Users className="h-3 w-3 shrink-0 text-emerald-600" />
                            <span className="truncate" title={assignedAgents.map((a) => a.name).join(", ")}>
                              {assignedAgents.length > 0 ? assignedAgents.map((a) => a.name).join(", ") : "Unassigned"}
                            </span>
                          </div>
                          <div className="min-w-[190px]" onClick={(event) => event.stopPropagation()}>
                            <SmartSelect
                              value={assignedAgents[0]?.id || ""}
                              placeholder={assignedAgents.length > 0 ? assignedAgents[0].name : "Select company agent…"}
                              searchPlaceholder="Search agents or companies…"
                              onChange={(agentId) => handleUpdateVoice(agentId, voice.voice_id || voice.id)}
                              options={agents.map((agent) => ({
                                value: agent.id,
                                label: `${agent.name} · ${agent.company_name}`,
                                badge: assignedAgents.some((assigned) => assigned.id === agent.id) ? "Current" : undefined,
                              }))}
                              className="[&>button]:h-8 [&>button]:text-[10px]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handlePlayVoicePreview(previewVoice);
                            }}
                            className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                              isPlaying ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800"
                            }`}
                          >
                            {isPlaying ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                            {isPlaying ? "Stop" : "Listen"}
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={voice.id}
                        onClick={() => setSelectedVoiceId(voice.id)}
                        className={`relative flex min-h-[260px] flex-col justify-between space-y-3 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all cursor-pointer ${
                          isPlaying
                            ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg"
                            : isSelected
                              ? "border-emerald-500 ring-1 ring-emerald-500/20 shadow-md"
                              : "border-slate-200/80 hover:border-emerald-300 hover:shadow-md"
                        }`}
                      >
                        {isPlaying && (
                          <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />
                        )}

                        <div>
                          {/* Top Row: Avatar, Name, Badges, Usage Count */}
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold shadow-sm ${
                                  isMale
                                    ? "border-blue-200 bg-blue-50 text-blue-800"
                                    : isFemale
                                      ? "border-purple-200 bg-purple-50 text-purple-800"
                                      : "border-emerald-200 bg-emerald-50 text-emerald-800"
                                }`}
                              >
                                {voice.name?.charAt(0)?.toUpperCase() || "C"}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-extrabold tracking-tight text-slate-900 truncate max-w-[130px]">
                                    {voice.name}
                                  </h3>
                                  <span className="rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                                    ✨ Cloned
                                  </span>
                                  <span
                                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                      isMale
                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                        : isFemale
                                          ? "bg-purple-50 text-purple-700 border-purple-200"
                                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}
                                  >
                                    {isMale ? "♂ Male" : isFemale ? "♀ Female" : "✨ Active"}
                                  </span>
                                </div>
                                <span className="mt-1 inline-block rounded-md bg-emerald-50/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  Cloned Voice Persona
                                </span>
                              </div>
                            </div>

                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {assignedAgents.length} {assignedAgents.length === 1 ? "Agent" : "Agents"}
                            </span>
                          </div>

                          {/* Assigned Row */}
                          <div className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                            <Users className="h-3 w-3 shrink-0 text-emerald-600" />
                            <span className="font-semibold text-slate-600">Assigned:</span>
                            <span className="truncate font-medium text-slate-700" title={assignedAgents.map((a) => a.name).join(", ")}>
                              {assignedAgents.length > 0 ? assignedAgents.map((a) => a.name).join(", ") : "Unassigned"}
                            </span>
                          </div>

                          {/* Description */}
                          <p className="mb-2.5 text-[11px] leading-relaxed text-slate-600 line-clamp-2 min-h-[34px]">
                            {voice.description || "Custom enterprise cloned voice persona."}
                          </p>

                          {/* Provider Spec Pill */}
                          <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 p-2 text-[10px] font-mono text-emerald-700">
                            <span className="font-bold">Provider:</span>
                            <span>Sarvam Cloned</span>
                            <span>High Clarity · Active</span>
                          </div>
                        </div>

                        {/* Bottom Action Section */}
                        <div className="space-y-3 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handlePlayVoicePreview(previewVoice)}
                            disabled={isPreviewLoading && previewingVoiceId === previewVoice.id}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${
                              isPreviewLoading && previewingVoiceId === previewVoice.id
                                ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                                : isPlaying
                                  ? "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/20"
                                  : "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800"
                            }`}
                          >
                            {isPreviewLoading && previewingVoiceId === previewVoice.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Loading voice sample...</span>
                              </>
                            ) : isPlaying ? (
                              <>
                                <Square className="h-3 w-3 fill-current" />
                                <span>Stop voice sample</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3 fill-current" />
                                <span>Listen voice sample</span>
                              </>
                            )}
                          </button>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-500">
                              Assign this voice to platform agent:
                            </label>
                            <SmartSelect
                              value={assignedAgents[0]?.id || ""}
                              placeholder={
                                assignedAgents.length > 0
                                  ? assignedAgents[0].name
                                  : "Choose an agent to assign…"
                              }
                              searchPlaceholder="Search agents…"
                              onChange={(value) => handleUpdateVoice(value, voice.voice_id || voice.id)}
                              options={agents.map((a) => ({
                                value: a.id,
                                label: `${a.name} (${a.company_name})`,
                                badge: assignedAgents.some((assigned) => assigned.id === a.id) ? "Current" : undefined,
                              }))}
                              className="w-full [&>button]:h-9 [&>button]:text-[11px]"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="col-span-1 lg:col-span-4 lg:sticky lg:top-24 self-start">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
                  {/* Sticky Header */}
                  <div className="py-3 px-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2.5">
                    <Sliders className="h-4 w-4 text-emerald-500" />
                    <h3 className="font-bold text-slate-800 text-sm">
                      Voice Settings
                    </h3>
                    {(() => {
                      const headerVoice = filteredVoices.find(
                        (item) => item.id === selectedVoiceId,
                      );
                      if (!headerVoice) return null;
                      return (
                        <select
                          value={headerVoice.gender || "Female"}
                          onChange={async (event) => {
                            const gender = event.target.value as "Male" | "Female";
                            try {
                              const formData = new FormData();
                              formData.append("gender", gender);
                              const res = await fetch(
                                `${API_BASE_URL}/companies/admin_workspace/voices/${headerVoice.id}`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    Authorization: `Bearer ${localStorage.getItem("zenaipex_token")}`,
                                  },
                                  body: formData,
                                },
                              );
                              if (!res.ok) throw new Error("Gender update failed");
                              setCustomVoices((prev) =>
                                prev.map((item) =>
                                  item.id === headerVoice.id
                                    ? { ...item, gender }
                                    : item,
                                ),
                              );
                              setSuccessToast(`Voice set to ${gender}`);
                            } catch {
                              setPreviewError("Failed to update voice gender");
                            }
                          }}
                          className="ml-auto h-7 max-w-[92px] rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-bold text-slate-700 outline-none focus:border-emerald-400"
                          aria-label="Voice gender"
                        >
                          <option value="Male">♂ Male</option>
                          <option value="Female">♀ Female</option>
                        </select>
                      );
                    })()}
                  </div>

                  {!selectedVoiceId ||
                  !filteredVoices.find((v) => v.id === selectedVoiceId) ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50/30">
                      <div className="h-12 w-12 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center mb-3">
                        <Mic className="h-5 w-5 text-slate-300" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-700">
                        No Voice Selected
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Select a voice from the gallery to view and configure
                        its advanced details.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const voice = filteredVoices.find(
                        (v) => v.id === selectedVoiceId,
                      )!;
                      const assignedAgents = assignedAgentsForVoice(
                        agents,
                        voice,
                      );
                      return (
                        <VoiceTuningPanel
                          voice={voice}
                          agents={agents}
                          assignedAgents={assignedAgents}
                          selectedVoiceId={selectedVoiceId}
                          setSelectedVoiceId={setSelectedVoiceId}
                          setCustomVoices={setCustomVoices}
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
                          handleUpdateVoice={handleUpdateVoice}
                        />
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}
