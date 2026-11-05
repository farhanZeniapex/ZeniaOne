"use client";

import React from "react";
import { SmartSelect } from "@/components/ui/smart-select";
import { Button } from "@/components/ui/button";
import {
  Users,
  Sparkles,
  Play,
  Square,
  Loader2,
} from "lucide-react";

export interface VoiceCatalogTabsProps {
  activeTab: "voices" | "gemini_voices" | "azure_voices";
  setActiveTab: (tab: any) => void;
  viewMode: "grid" | "list";
  genderFilter: string;
  geminiStyleFilter: string;
  orderedPlatformVoices: any[];
  orderedGeminiVoices: any[];
  orderedAzureVoices: any[];
  AZURE_VOICES: readonly any[];
  agents: any[];
  previewingVoiceId: string | null;
  isPreviewLoading: boolean;
  handlePlayVoicePreview: (voice: any) => void;
  handleUpdateVoice: (agentId: string, voiceId: string) => Promise<void> | void;
  getVoiceAcoustics: (voiceId: any) => any;
  assignedAgentsForVoice: (agents: any[], voice: any) => any[];
}

export default function VoiceCatalogTabs({
  activeTab,
  setActiveTab,
  viewMode,
  genderFilter,
  geminiStyleFilter,
  orderedPlatformVoices,
  orderedGeminiVoices,
  orderedAzureVoices,
  AZURE_VOICES,
  agents,
  previewingVoiceId,
  isPreviewLoading,
  handlePlayVoicePreview,
  handleUpdateVoice,
  getVoiceAcoustics,
  assignedAgentsForVoice,
}: VoiceCatalogTabsProps) {
  return (
    <>
      {activeTab === "voices" && (
        <div className="space-y-4">
          {/* 11 Voice Studio Cards */}
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                : "flex flex-col gap-2"
            }
          >
            {orderedPlatformVoices
              .filter((v) => genderFilter === "all" || v.gender === genderFilter)
              .map((voice) => {
                const isPlaying = previewingVoiceId === voice.id;
                const assignedAgents = assignedAgentsForVoice(agents, voice);
                const acoustics = getVoiceAcoustics(voice.id);
                const isMale = voice.gender === "Male";

                if (viewMode === "list") {
                  return (
                    <div
                      key={voice.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold ${
                            isMale
                              ? "border-blue-200 bg-blue-50 text-blue-800"
                              : "border-purple-200 bg-purple-50 text-purple-800"
                          }`}
                        >
                          {voice.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-extrabold text-slate-900">{voice.name}</h3>
                            <span className="rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                              Platform Voice
                            </span>
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                isMale
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-purple-50 text-purple-700 border-purple-200"
                              }`}
                            >
                              {isMale ? "♂ Male" : "♀ Female"}
                            </span>
                          </div>
                          <p className="truncate text-[11px] text-emerald-700">{voice.tone} · {voice.accent || "Indian"}</p>
                          <p className="truncate text-[11px] text-slate-500">{voice.description}</p>
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
                          onChange={(agentId) => handleUpdateVoice(agentId, voice.id)}
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
                        onClick={() => handlePlayVoicePreview(voice)}
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
                    className={`relative flex min-h-[260px] flex-col justify-between space-y-3 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all ${
                      isPlaying
                        ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg"
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
                                : "border-purple-200 bg-purple-50 text-purple-800"
                            }`}
                          >
                            {voice.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold tracking-tight text-slate-900">{voice.name}</h3>
                              <span className="rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                                Platform Voice
                              </span>
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                                  isMale
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-purple-50 text-purple-700 border-purple-200"
                                }`}
                              >
                                {isMale ? "♂ Male" : "♀ Female"}
                              </span>
                            </div>
                            <span className="mt-1 inline-block rounded-md bg-emerald-50/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              {voice.tone}
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
                        <span className="truncate font-medium text-slate-700" title={assignedAgents.map((agent) => agent.name).join(", ")}>
                          {assignedAgents.length > 0 ? assignedAgents.map((agent) => agent.name).join(", ") : "Unassigned"}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="mb-2.5 text-[11px] leading-relaxed text-slate-600 line-clamp-2 min-h-[34px]">
                        {voice.description}
                      </p>

                      {/* Provider Spec Pill */}
                      <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 p-2 text-[10px] font-mono text-emerald-700">
                        <span className="font-bold">Provider:</span>
                        <span>Sarvam AI · Bulbul v3</span>
                        <span>{voice.accent || "Indian"} · Pitch {acoustics.pitch.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Bottom Action Section */}
                    <div className="space-y-3 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handlePlayVoicePreview(voice)}
                        disabled={isPreviewLoading && previewingVoiceId === voice.id}
                        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${
                          isPreviewLoading && previewingVoiceId === voice.id
                            ? "bg-slate-200 text-slate-600 cursor-not-allowed"
                            : isPlaying
                              ? "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/20"
                              : "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800"
                        }`}
                      >
                        {isPreviewLoading && previewingVoiceId === voice.id ? (
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
                          onChange={(value) => handleUpdateVoice(value, voice.id)}
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
              })}
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 2B: GEMINI LIVE VOICES ─────────────────── */}
      {activeTab === "gemini_voices" && (
        <div className="space-y-4">
          {geminiStyleFilter === "indian" && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50/90 to-amber-100/40 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl shrink-0">🇮🇳</span>
                <div>
                  <p className="text-xs font-bold text-amber-950 flex items-center gap-2">
                    Gemini Live Indic-Tuned Personas ({orderedGeminiVoices.length} Voices)
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-200/80 text-amber-900 text-[9px] font-extrabold uppercase">High Clarity</span>
                  </p>
                  <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                    These Gemini voices have the highest acoustic resonance for Hindi, Hinglish, and Gujarati phonemes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("voices")}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-xs transition inline-flex items-center gap-1.5"
              >
                <span>View 100% Indian Sarvam Personas</span>
                <span>→</span>
              </button>
            </div>
          )}
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
                : "flex flex-col gap-2"
            }
          >
              {orderedGeminiVoices.map((voice) => {
                const assignedAgents = assignedAgentsForVoice(agents, voice);
                const previewVoice = {
                  id: voice.id,
                  name: voice.name,
                  gender: voice.gender,
                  provider: "Google Gemini Live",
                  enabled: true,
                  description: voice.description,
                  tone: voice.tone,
                  sampleText: `Hello, this is ${voice.name}, a ${voice.tone.toLowerCase()} Gemini Live voice.`,
                  isGemini: true,
                };

                const isMale = voice.gender === "Male";

                if (viewMode === "list") {
                  return (
                    <div key={voice.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold ${isMale ? "border-blue-200 bg-blue-50 text-blue-800" : "border-purple-200 bg-purple-50 text-purple-800"}`}>{voice.name.charAt(0)}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-extrabold text-slate-900">{voice.name}</h3>
                            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-800">Gemini Live</span>
                            <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${isMale ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                              {isMale ? "♂ Male" : "♀ Female"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5 mb-1">
                            <span className="text-[11px] font-semibold text-emerald-700">{voice.tone}</span>
                            {voice.styles?.map((st: any) => (
                              <span key={st} className="rounded-md bg-slate-100 border border-slate-200/80 px-1.5 py-0.2 text-[9px] font-semibold text-slate-700 capitalize">
                                {st === "indian" ? "🇮🇳 Indic" : st === "cold" ? "🧊 Cold" : st === "natural" ? "🌿 Natural" : st === "human" ? "💖 Warm" : "💼 Pro"}
                              </span>
                            ))}
                          </div>
                          {voice.useCase && (
                            <p className="truncate text-[10px] text-slate-600 mb-0.5">
                              <strong className="text-slate-800">🎯 Best for:</strong> {voice.useCase}
                            </p>
                          )}
                          <p className="truncate text-[11px] text-slate-500">{voice.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 sm:w-44">
                        <Users className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span className="truncate" title={assignedAgents.map((agent) => agent.name).join(", ")}>{assignedAgents.length > 0 ? assignedAgents.map((agent) => agent.name).join(", ") : "Unassigned"}</span>
                      </div>
                      <div className="min-w-[190px]" onClick={(event) => event.stopPropagation()}>
                        <SmartSelect
                          value={assignedAgents[0]?.id || ""}
                          placeholder={assignedAgents.length > 0 ? assignedAgents[0].name : "Select company agent…"}
                          searchPlaceholder="Search agents or companies…"
                          onChange={(agentId) => handleUpdateVoice(agentId, voice.id)}
                          options={agents.map((agent) => ({
                            value: agent.id,
                            label: `${agent.name} · ${agent.company_name}`,
                            badge: assignedAgents.some((assigned) => assigned.id === agent.id) ? "Current" : undefined,
                          }))}
                          className="[&>button]:h-8 [&>button]:text-[10px]"
                        />
                      </div>
                      <button type="button" onClick={() => handlePlayVoicePreview(previewVoice)} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-bold ${previewingVoiceId === voice.id ? "bg-red-600 text-white" : "bg-emerald-700 text-white"}`}>
                        {previewingVoiceId === voice.id ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                        {previewingVoiceId === voice.id ? "Stop" : "Listen"}
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={voice.id} className={`relative flex min-h-[260px] flex-col justify-between space-y-3 overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all ${previewingVoiceId === voice.id ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg" : "border-slate-200/80 hover:border-emerald-300 hover:shadow-md"}`}>
                    {previewingVoiceId === voice.id && <div className="absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />}
                    <div>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold shadow-sm ${isMale ? "border-blue-200 bg-blue-50 text-blue-800" : "border-purple-200 bg-purple-50 text-purple-800"}`}>{voice.name.charAt(0)}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-extrabold tracking-tight text-slate-900">{voice.name}</h3>
                              <span className="rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800">Gemini Live</span>
                              <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${isMale ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                                {isMale ? "♂ Male" : "♀ Female"}
                              </span>
                            </div>
                            <span className="mt-1 inline-block rounded-md bg-emerald-50/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{voice.tone}</span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{assignedAgents.length} {assignedAgents.length === 1 ? "Agent" : "Agents"}</span>
                      </div>
                      <div className="mb-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                        <Users className="h-3 w-3 shrink-0 text-emerald-600" />
                        <span className="font-semibold text-slate-600">Assigned:</span>
                        <span className="truncate" title={assignedAgents.map((agent) => agent.name).join(", ")}>
                          {assignedAgents.length > 0 ? assignedAgents.map((agent) => agent.name).join(", ") : "Unassigned"}
                        </span>
                      </div>
                      <p className="mb-2 text-[11px] leading-relaxed text-slate-600">{voice.description}</p>
                      {voice.useCase && (
                        <div className="mb-2.5 rounded-lg border border-slate-200/60 bg-slate-50/80 px-2.5 py-1.5 text-[10px] text-slate-600">
                          <strong className="text-slate-800">🎯 Best for:</strong> {voice.useCase}
                        </div>
                      )}
                      <div className="mb-2.5 flex items-center gap-1 flex-wrap">
                        {voice.styles?.map((st: any) => (
                          <span key={st} className="rounded-md bg-white border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 capitalize shadow-2xs">
                            {st === "indian" ? "🇮🇳 Indic" : st === "cold" ? "🧊 Cold Calling" : st === "natural" ? "🌿 Natural" : st === "human" ? "💖 Human & Warm" : "💼 Professional"}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 p-2 text-[10px] font-mono text-emerald-700">
                        <span className="font-bold">Provider:</span>
                        <span>Google Gemini Live</span>
                        <span>Native audio</span>
                      </div>
                    </div>
                    <div className="space-y-3 border-t border-slate-100 pt-3">
                      <button type="button" onClick={() => handlePlayVoicePreview(previewVoice)} className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${previewingVoiceId === voice.id ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800"}`}>
                        {previewingVoiceId === voice.id ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                        {previewingVoiceId === voice.id ? "Stop voice sample" : "Listen voice sample"}
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
                          onChange={(agentId) => handleUpdateVoice(agentId, voice.id)}
                          options={agents.map((agent) => ({
                            value: agent.id,
                            label: `${agent.name} (${agent.company_name})`,
                            badge: assignedAgents.some((assigned) => assigned.id === agent.id) ? "Current" : undefined,
                          }))}
                          className="w-full [&>button]:h-9 [&>button]:text-[11px]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ─────────────────── TAB 2C: AZURE STANDARD VOICES ─────────────────── */}
      {activeTab === "azure_voices" && (
        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-[#DCE7DF] bg-white shadow-[0_5px_18px_#1b3b300a]">
            <div className="flex flex-col gap-2 border-b border-[#E8EEE9] bg-gradient-to-r from-emerald-50/70 via-white to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-700" />
                  <h2 className="text-lg font-extrabold text-slate-900">Azure Speech Voices</h2>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">{AZURE_VOICES.length} F0 eligible</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">Indian Standard Neural voices available in Azure&apos;s free F0 quota.</p>
              </div>
              <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">Azure key required for live calls</span>
            </div>
            <div className={viewMode === "grid" ? "grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-2 p-4"}>
              {orderedAzureVoices.map((voice) => {
                const previewVoice = {
                  id: voice.id,
                  name: voice.name,
                  gender: voice.gender,
                  provider: "Azure Speech",
                  enabled: true,
                  description: voice.description,
                  tone: voice.tone,
                  sampleText: `Hello, this is ${voice.name}, an Azure ${voice.language} voice.`,
                };
                return (
                  <div key={voice.id} className={viewMode === "grid" ? "flex min-h-[180px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" : "flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center"}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-sm font-extrabold text-emerald-800">{voice.name.charAt(0)}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-extrabold text-slate-900">{voice.name}</h3>
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">{voice.gender}</span>
                        </div>
                        <p className="truncate text-[11px] text-emerald-700">{voice.language} · Azure Standard Neural</p>
                        <p className="truncate text-[11px] text-slate-500">{voice.id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="hidden text-[10px] text-slate-400 sm:inline">Catalog only</span>
                      <Button onClick={() => handlePlayVoicePreview(previewVoice)} className="shrink-0 bg-emerald-700 text-[11px] font-bold hover:bg-emerald-800">
                        {previewingVoiceId === voice.id ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
                        {previewingVoiceId === voice.id ? "Stop" : "Preview"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

    </>
  );
}
