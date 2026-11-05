"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SmartSelect } from "@/components/ui/smart-select";
import { API_BASE_URL } from "@/lib/api/client";
import {
  Pin,
  Edit3,
  Loader2,
  Square,
  Play,
  RefreshCw,
  Download,
  Activity,
  Archive,
  Trash2,
} from "lucide-react";

interface VoiceTuningPanelProps {
  voice: any;
  agents: any[];
  assignedAgents: any[];
  selectedVoiceId: string | null;
  setSelectedVoiceId: (id: string | null) => void;
  setCustomVoices: React.Dispatch<React.SetStateAction<any[]>>;
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
  sliderSaveStatus: Record<string, boolean>;
  isAudioLiveTuned: Record<string, boolean>;
  updatingAgentId: string | null;
  handleUpdateVoice: (agentId: string, voiceId: string) => Promise<void>;
}

export default function VoiceTuningPanel({
  voice,
  agents,
  assignedAgents,
  selectedVoiceId,
  setSelectedVoiceId,
  setCustomVoices,
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
  handleUpdateVoice,
}: VoiceTuningPanelProps) {
  if (!voice) return null;

  return (
    <div className="p-6 flex flex-col h-full space-y-5">
      {/* Compact Voice Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-xl shadow-sm shrink-0">
            {voice.name?.charAt(0)?.toUpperCase() || "C"}
          </div>
          <div className="flex flex-col">
            <h2 className="text-sm font-extrabold text-slate-900 leading-tight flex items-center gap-1.5">
              {voice.name}
              {voice.is_pinned && (
                <span className="text-xs" title="Pinned">
                  📌
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                variant="secondary"
                className="text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border-none px-1 py-0 rounded-md"
              >
                {voice.is_archived ? "📦 Archived" : "✨ Cloned"}
              </Badge>
              <div className="text-[9px] font-mono text-slate-400">
                ID: {voice.id.substring(0, 10)}...
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={async () => {
              const newPinned = !voice.is_pinned;
              try {
                const formData = new FormData();
                formData.append("is_pinned", newPinned.toString());
                const res = await fetch(
                  `${API_BASE_URL}/companies/admin_workspace/voices/${voice.id}`,
                  {
                    method: "PATCH",
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem("zenaipex_token")}`,
                    },
                    body: formData,
                  },
                );
                if (res.ok) {
                  setCustomVoices((prev) =>
                    prev.map((v) =>
                      v.id === voice.id ? { ...v, is_pinned: newPinned } : v,
                    ),
                  );
                }
              } catch (e) {
                setPreviewError("Failed to pin voice");
              }
            }}
            className={`p-1.5 rounded-lg border transition-colors ${voice.is_pinned ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-400 hover:text-slate-600 border-slate-100 hover:bg-slate-100"}`}
            title={voice.is_pinned ? "Unpin Voice" : "Pin to Top"}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={async () => {
              const newName = prompt(
                "Enter new name for this voice:",
                voice.name,
              );
              if (newName && newName.trim() !== voice.name) {
                try {
                  const formData = new FormData();
                  formData.append("name", newName.trim());
                  const res = await fetch(
                    `${API_BASE_URL}/companies/admin_workspace/voices/${voice.id}`,
                    {
                      method: "PATCH",
                      headers: {
                        Authorization: `Bearer ${localStorage.getItem("zenaipex_token")}`,
                      },
                      body: formData,
                    },
                  );
                  if (res.ok) {
                    setCustomVoices((prev) =>
                      prev.map((v) =>
                        v.id === voice.id
                          ? { ...v, name: newName.trim() }
                          : v,
                      ),
                    );
                  }
                } catch (e) {
                  setPreviewError("Failed to edit voice");
                }
              }
            }}
            className="p-1.5 rounded-lg border bg-slate-50 text-slate-400 hover:text-slate-600 border-slate-100 hover:bg-slate-100 transition-colors"
            title="Edit Voice"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Audio Player */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 p-3 flex flex-col gap-3">
        {/* Custom Text Input */}
        <div>
          <textarea
            placeholder="Type something to test this voice..."
            rows={2}
            maxLength={150}
            value={testText[voice.id] || ""}
            onChange={(e) =>
              setTestText((prev) => ({
                ...prev,
                [voice.id]: e.target.value,
              }))
            }
            className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 resize-none bg-white text-slate-700 placeholder-slate-400 transition-all"
          />
          <div className="text-[9px] text-slate-400 text-right mt-0.5">
            {(testText[voice.id] || "").length}/150
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const audioEl = document.getElementById(
                  `audio-panel-${voice.id}`,
                ) as HTMLAudioElement;
                if (audioEl && testAudioSrc[voice.id]) {
                  if (isLivePlaying[voice.id]) {
                    audioEl.pause();
                    setIsLivePlaying((p) => ({
                      ...p,
                      [voice.id]: false,
                    }));
                  } else {
                    const spd =
                      voiceSettings[voice.id]?.speed ??
                      voice.speed ??
                      1.15;
                    const vol =
                      voiceSettings[voice.id]?.volume ??
                      voice.volume ??
                      1.35;
                    audioEl.playbackRate = spd;
                    if (gainNodesRef.current[voice.id]) {
                      gainNodesRef.current[voice.id].gain.value = vol;
                    }
                    audioEl.currentTime = 0;
                    audioEl.play().catch((e) => console.warn(e));
                    setIsLivePlaying((p) => ({
                      ...p,
                      [voice.id]: true,
                    }));
                  }
                } else {
                  handleTestCustomVoice(voice);
                }
              }}
              disabled={
                isGeneratingVoiceId === voice.id ||
                testingCustomVoiceId === voice.id
              }
              className={`h-7 px-2.5 text-xs font-bold gap-1.5 rounded-lg shadow-2xs transition-all ${
                isLivePlaying[voice.id]
                  ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
              }`}
            >
              {isGeneratingVoiceId === voice.id ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Synthesizing...
                </>
              ) : isLivePlaying[voice.id] ? (
                <>
                  <Square className="h-3 w-3 fill-current" /> Stop Audio
                </>
              ) : (
                <>
                  <Play className="h-3 w-3 fill-current" /> Test Audio
                </>
              )}
            </Button>
            <SmartSelect
              value={testLanguage[voice.id] || "en-IN"}
              onChange={(value) => {
                setTestLanguage((prev) => ({
                  ...prev,
                  [voice.id]: value,
                }));
                handleTestCustomVoice(voice, value, true);
              }}
              searchable={false}
              className="w-20 [&>button]:h-8 [&>button]:rounded-md [&>button]:border-slate-200 [&>button]:px-2 [&>button]:text-[11px]"
              options={[
                { value: "en-IN", label: "Eng" },
                { value: "hi-IN", label: "Hin" },
                { value: "gu-IN", label: "Guj" },
              ]}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <SmartSelect
              value={(
                voiceSettings[voice.id]?.speed ??
                voice.speed ??
                playbackRate[voice.id] ??
                1.15
              ).toFixed(2)}
              onChange={(value) =>
                handleVoiceParamChange(
                  voice.id,
                  "speed",
                  parseFloat(value),
                )
              }
              searchable={false}
              className="w-28 [&>button]:h-8 [&>button]:rounded-md [&>button]:border-amber-300 [&>button]:px-2 [&>button]:text-[11px] [&>button]:text-amber-900"
              options={[
                { value: "0.80", label: "0.80x Slow" },
                { value: "1.00", label: "1.00x Normal" },
                { value: "1.15", label: "1.15x Natural" },
                { value: "1.30", label: "1.30x Quick" },
                { value: "1.50", label: "1.50x Fast" },
              ]}
            />
            {testAudioSrc[voice.id] && (
              <>
                <button
                  onClick={() =>
                    handleTestCustomVoice(voice, undefined, true)
                  }
                  disabled={
                    isGeneratingVoiceId === voice.id ||
                    testingCustomVoiceId === voice.id
                  }
                  className={`p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors ${isGeneratingVoiceId === voice.id ? "opacity-50 cursor-not-allowed" : ""}`}
                  title="Regenerate Voice from AI Engine (Slow)"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${isGeneratingVoiceId === voice.id ? "animate-spin" : ""}`}
                  />
                </button>
                <a
                  href={`data:audio/${testAudioSrc[voice.id]?.startsWith("UklGR") ? "wav" : "mp3"};base64,${testAudioSrc[voice.id]}`}
                  download={`${voice.name.replace(/\s+/g, "_")}_test.${testAudioSrc[voice.id]?.startsWith("UklGR") ? "wav" : "mp3"}`}
                  className="p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
                  title="Download Audio"
                >
                  <Download className="h-3 w-3" />
                </a>
              </>
            )}
          </div>
        </div>

        {testAudioSrc[voice.id] ? (
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <audio
                id={`audio-panel-${voice.id}`}
                controls
                src={`data:audio/${testAudioSrc[voice.id]?.startsWith("UklGR") ? "wav" : "mp3"};base64,${testAudioSrc[voice.id]}`}
                onPlay={() => {
                  setIsLivePlaying((p) => ({
                    ...p,
                    [voice.id]: true,
                  }));
                  const audioEl = document.getElementById(
                    `audio-panel-${voice.id}`,
                  ) as HTMLAudioElement;
                  if (audioEl) {
                    const curSpd =
                      voiceSettings[voice.id]?.speed ??
                      voice.speed ??
                      1.15;
                    audioEl.playbackRate = curSpd;
                    const curVol =
                      voiceSettings[voice.id]?.volume ??
                      voice.volume ??
                      1.35;
                    if (gainNodesRef.current[voice.id]) {
                      gainNodesRef.current[voice.id].gain.value = curVol;
                    } else {
                      audioEl.volume = Math.min(1.0, curVol / 2.0);
                    }
                  }
                }}
                onPause={() =>
                  setIsLivePlaying((p) => ({
                    ...p,
                    [voice.id]: false,
                  }))
                }
                onEnded={() => {
                  setIsLivePlaying((p) => ({
                    ...p,
                    [voice.id]: false,
                  }));
                  setTestingCustomVoiceId(null);
                }}
                className="w-full h-9 outline-none rounded-md bg-white border border-slate-200/80 shadow-2xs"
              />
            </div>
            <div className="flex items-center justify-between px-1 text-[9px]">
              <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${isLivePlaying[voice.id] ? "bg-emerald-500 animate-ping" : "bg-slate-300"}`}
                />
                {isLivePlaying[voice.id] ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Activity className="h-3 w-3 animate-pulse text-emerald-600" />{" "}
                    Live Playing
                  </span>
                ) : (
                  <span>Ready to test</span>
                )}
              </span>
              {isAudioLiveTuned[voice.id] && (
                <span className="text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center gap-1 shadow-2xs">
                  ⚡ Live Tuned:{" "}
                  {(voiceSettings[voice.id]?.speed ?? 1.15).toFixed(2)}x ·{" "}
                  {Math.round(
                    (voiceSettings[voice.id]?.volume ?? 1.35) * 100,
                  )}
                  % Vol
                </span>
              )}
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full h-9 bg-white border-slate-200 hover:border-emerald-400 hover:text-emerald-700 text-slate-600 transition-all rounded-lg shadow-sm font-bold text-[11px]"
            onClick={() => handleTestCustomVoice(voice)}
            disabled={
              isGeneratingVoiceId === voice.id ||
              testingCustomVoiceId === voice.id
            }
          >
            {testingCustomVoiceId === voice.id ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin text-emerald-500" />{" "}
                Synthesizing...
              </>
            ) : (
              <>
                <Play className="mr-1.5 h-4 w-4 text-emerald-500" />{" "}
                Generate Preview
              </>
            )}
          </Button>
        )}
      </div>

      {/* Tuning Sliders Container */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between pb-0.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            🎛️ Voice Tuning & Calibration
          </span>
          {sliderSaveStatus[voice.id] ? (
            <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200/80 flex items-center gap-1 shadow-sm transition-all animate-pulse">
              ✓ Saved to Database
            </span>
          ) : (
            <span className="text-[9px] text-slate-400 font-medium">
              Auto-synced
            </span>
          )}
        </div>

        {/* Voice Speed Slider */}
        <div className="space-y-1.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 shadow-sm transition-all hover:border-emerald-200">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-emerald-900 flex items-center gap-1.5">
              ⚡ Voice Speed
            </span>
            <span className="text-emerald-800 font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-100 text-[10px] shadow-2xs">
              {(
                voiceSettings[voice.id]?.speed ??
                voice.speed ??
                1.15
              ).toFixed(2)}
              x
            </span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.5"
            step="0.05"
            value={
              voiceSettings[voice.id]?.speed ??
              voice.speed ??
              1.15
            }
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              handleVoiceParamChange(voice.id, "speed", val);
            }}
            onPointerUp={() => triggerInstantAudioPreview(voice.id)}
            className="w-full h-1.5 bg-emerald-200/80 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-all"
          />
          <div className="flex justify-between text-[8px] font-medium text-emerald-700/80">
            <span>0.8x Slow</span>
            <span>1.15x Natural</span>
            <span>1.5x Fast</span>
          </div>
        </div>

        {/* Volume Boost Slider */}
        <div className="space-y-1.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 shadow-sm transition-all hover:border-emerald-200">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-emerald-900 flex items-center gap-1.5">
              🔊 Volume Boost
            </span>
            <span className="text-emerald-800 font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-100 text-[10px] shadow-2xs">
              {Math.round(
                (voiceSettings[voice.id]?.volume ??
                  voice.volume ??
                  1.35) * 100,
              )}
              %
            </span>
          </div>
          <input
            type="range"
            min="0.8"
            max="2.0"
            step="0.05"
            value={
              voiceSettings[voice.id]?.volume ??
              voice.volume ??
              1.35
            }
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              handleVoiceParamChange(voice.id, "volume", val);
            }}
            onPointerUp={() => triggerInstantAudioPreview(voice.id)}
            className="w-full h-1.5 bg-emerald-200/80 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-all"
          />
          <div className="flex justify-between text-[8px] font-medium text-emerald-700/80">
            <span>80% Standard</span>
            <span>135% Dynamic Loud</span>
            <span>200% Max Boost</span>
          </div>
        </div>

        {/* Clarity & Similarity Slider */}
        <div className="space-y-1.5 bg-gradient-to-r from-emerald-50/70 to-emerald-100/40 p-2.5 rounded-xl border border-emerald-200/70 shadow-sm transition-all hover:border-emerald-300">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-emerald-900 flex items-center gap-1.5">
              🎯 Clarity & Similarity
            </span>
            <span className="text-emerald-800 font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-200 text-[10px] shadow-2xs">
              {voiceSettings[voice.id]?.clarity ??
                voice.clarity ??
                94}
              %
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={
              voiceSettings[voice.id]?.clarity ??
              voice.clarity ??
              94
            }
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              handleVoiceParamChange(voice.id, "clarity", val);
            }}
            onPointerUp={() => triggerInstantAudioPreview(voice.id)}
            className="w-full h-1.5 bg-emerald-200/80 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-all"
          />
          <div className="flex justify-between text-[8px] font-medium text-emerald-700/80">
            <span>0% Soft</span>
            <span>50% Balanced</span>
            <span>100% Studio Precision</span>
          </div>
        </div>

        {/* Stability (Monotone) Slider */}
        <div className="space-y-1.5 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 shadow-sm transition-all hover:border-emerald-200">
          <div className="flex justify-between items-center text-[10px] font-bold">
            <span className="text-emerald-900 flex items-center gap-1.5">
              ⚖️ Stability & Tone
            </span>
            <span className="text-emerald-800 font-mono font-bold bg-white/90 px-1.5 py-0.5 rounded-md border border-emerald-100 text-[10px] shadow-2xs">
              {voiceSettings[voice.id]?.stability ??
                voice.stability ??
                85}
              %
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={
              voiceSettings[voice.id]?.stability ??
              voice.stability ??
              85
            }
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              handleVoiceParamChange(voice.id, "stability", val);
            }}
            onPointerUp={() => triggerInstantAudioPreview(voice.id)}
            className="w-full h-1.5 bg-emerald-200/80 rounded-lg appearance-none cursor-pointer accent-emerald-600 transition-all"
          />
          <div className="flex justify-between text-[8px] font-medium text-emerald-700/80">
            <span>0% Dynamic Range</span>
            <span>50% Conversational</span>
            <span>100% Monotone</span>
          </div>
        </div>
      </div>

      {/* Agent Assignment */}
      <div className="pt-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Assigned Agent
          </span>
          {assignedAgents.length > 0 && (
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
              {assignedAgents.length} Active
            </span>
          )}
        </div>

        {/* Assigned Agent Tags */}
        {assignedAgents.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200/80">
            {assignedAgents.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-800 text-[11px] font-bold px-2 py-1 rounded-lg shadow-2xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>{a.name}</span>
                <span className="text-[9px] font-normal text-slate-400">
                  ({a.company_name})
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 italic px-2 py-1 bg-slate-50 rounded-lg border border-dashed border-slate-200">
            Currently not assigned to any agent.
          </div>
        )}

        {/* Assign/Reassign Dropdown */}
        <SmartSelect
          value={assignedAgents[0]?.id || ""}
          disabled={!!updatingAgentId}
          onChange={(value) => handleUpdateVoice(value, voice.id)}
          placeholder={
            assignedAgents.length > 0
              ? "Switch or Reassign to Agent…"
              : "Assign to Agent…"
          }
          searchPlaceholder="Search agents…"
          options={agents.map((a) => ({
            value: a.id,
            label: `${a.name} (${a.company_name})`,
            badge:
              a.tts_voice === voice.id || a.tts_voice === voice.voice_id
                ? "Current"
                : undefined,
          }))}
        />
      </div>

      {/* Actions */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <button
          onClick={async () => {
            const newArchived = !voice.is_archived;
            if (
              !newArchived ||
              confirm("Are you sure you want to archive this voice?")
            ) {
              try {
                const formData = new FormData();
                formData.append("is_archived", newArchived.toString());
                const res = await fetch(
                  `${API_BASE_URL}/companies/admin_workspace/voices/${voice.id}`,
                  {
                    method: "PATCH",
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem("zenaipex_token")}`,
                    },
                    body: formData,
                  },
                );
                if (res.ok) {
                  setCustomVoices((prev) =>
                    prev.map((v) =>
                      v.id === voice.id ? { ...v, is_archived: newArchived } : v,
                    ),
                  );
                  if (voiceFilter === "active" && newArchived) {
                    setSelectedVoiceId(null);
                  }
                }
              } catch (e) {
                setPreviewError("Failed to archive voice");
              }
            }
          }}
          className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold flex justify-center items-center gap-1.5 transition-colors ${voice.is_archived ? "text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-100" : "text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-100"}`}
        >
          <Archive className="h-3 w-3" />{" "}
          {voice.is_archived ? "Unarchive" : "Archive"}
        </button>
        <button
          onClick={async () => {
            if (
              confirm(
                "Are you sure you want to permanently delete this voice?",
              )
            ) {
              try {
                const res = await fetch(
                  `${API_BASE_URL}/companies/admin_workspace/voices/${voice.id}`,
                  {
                    method: "DELETE",
                    headers: {
                      Authorization: `Bearer ${localStorage.getItem("zenaipex_token")}`,
                    },
                  },
                );
                if (res.ok) {
                  setSelectedVoiceId(null);
                  setCustomVoices((prev) =>
                    prev.filter((v) => v.id !== voice.id),
                  );
                }
              } catch (e) {
                setPreviewError("Failed to delete voice");
              }
            }
          }}
          className="flex-1 text-center py-1.5 rounded-lg text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 flex justify-center items-center gap-1.5 transition-colors"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>
    </div>
  );
}
