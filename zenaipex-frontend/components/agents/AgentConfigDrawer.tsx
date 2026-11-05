"use client";

import React from "react";
import { X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartSelect } from "@/components/ui/smart-select";

interface AgentConfigDrawerProps {
  agent: any | null;
  onClose: () => void;
  editFormData: {
    name: string;
    description: string;
    tts_voice: string;
    voice_engine: string;
    llm_model: string;
    status: string;
    default_language: string;
  };
  setEditFormData: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  isSaving: boolean;
  customVoices: any[];
  voiceRuntimeModes: readonly any[];
  voices: any[];
}

export default function AgentConfigDrawer({
  agent,
  onClose,
  editFormData,
  setEditFormData,
  onSubmit,
  isSaving,
  customVoices,
  voiceRuntimeModes,
  voices,
}: AgentConfigDrawerProps) {
  if (!agent) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Platform Admin Config
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              {agent.name}
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Workspace: {agent.company_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body Form */}
        <form
          id="agent-edit-form"
          onSubmit={onSubmit}
          className="p-6 space-y-5 overflow-y-auto flex-1"
        >
          {/* Agent Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Agent Display Name
            </label>
            <input
              type="text"
              value={editFormData.name}
              onChange={(e) =>
                setEditFormData({ ...editFormData, name: e.target.value })
              }
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Description / Role
            </label>
            <textarea
              value={editFormData.description}
              onChange={(e) =>
                setEditFormData({
                  ...editFormData,
                  description: e.target.value,
                })
              }
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Voice Persona Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Voice Persona (Sarvam Bulbul v3)</span>
              <span className="text-[11px] font-normal text-emerald-600">
                11 Available
              </span>
            </label>
            <SmartSelect
              value={editFormData.tts_voice}
              onChange={(value) =>
                setEditFormData({ ...editFormData, tts_voice: value })
              }
              searchPlaceholder="Search voice…"
              options={[
                ...customVoices.map((v) => ({
                  value: v.id,
                  label: v.name,
                  group: `My Cloned Voices (${customVoices.length})`,
                  badge: "Cloned",
                })),
                ...voices.map((v) => ({
                  value: v.id,
                  label: v.name,
                  group: `${v.gender} Voices`,
                  description: v.tone,
                  badge: v.gender,
                })),
              ]}
            />
          </div>

          {/* Phone voice runtime */}
          <div className="space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700">
                  Phone Voice Runtime
                </label>
                <p className="mt-1 text-[11px] text-slate-500">
                  Only one mode remains active; new calls use the selected flow.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Single select
              </span>
            </div>
            <div className="grid gap-2">
              {voiceRuntimeModes.map((mode) => {
                const selected = editFormData.voice_engine === mode.value;
                const toneClasses =
                  mode.tone === "blue"
                    ? selected
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/40"
                    : mode.tone === "emerald"
                      ? selected
                        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
                        : "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40"
                      : selected
                        ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100"
                        : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/40";
                return (
                  <button
                    key={mode.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      setEditFormData({
                        ...editFormData,
                        voice_engine: mode.value,
                      })
                    }
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${toneClasses}`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-current" : "border-slate-300"}`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${selected ? "bg-current" : "bg-transparent"}`}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">
                          {mode.shortLabel}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selected ? "bg-white/80 text-slate-700" : "bg-slate-100 text-slate-500"}`}
                        >
                          {mode.badge}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-slate-600">
                        {mode.label}
                      </span>
                      <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                        {mode.detail}
                      </span>
                    </span>
                    {selected && (
                      <Check
                        className="h-4 w-4 shrink-0 text-current"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              Recommended: Gemini + Clone. If Gemini STT fails, the configured
              fallback provider is used automatically.
            </p>
          </div>

          {/* LLM Model Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              AI Intelligence Model (Brain)
            </label>
            <SmartSelect
              value={editFormData.llm_model}
              onChange={(value) =>
                setEditFormData({ ...editFormData, llm_model: value })
              }
              searchPlaceholder="Search models…"
              options={[
                {
                  value: "sarvam-105b",
                  label: "Sarvam AI · sarvam-105b",
                  badge: "Recommended",
                },
                {
                  value: "sarvam-105b-conversations",
                  label: "Sarvam AI · sarvam-105b-conversations",
                },
                {
                  value: "gemini-1.5-flash",
                  label: "Google · gemini-1.5-flash",
                },
                {
                  value: "gemini-2.0-flash",
                  label: "Google · gemini-2.0-flash",
                },
                {
                  value: "gemini-3.5-flash-lite",
                  label: "Google · gemini-3.5-flash-lite",
                  badge: "Fast Voice",
                },
                {
                  value: "llama-3.3-70b-versatile",
                  label: "Groq · llama-3.3-70b-versatile",
                  badge: "Ultra-Fast",
                },
              ]}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Agent Deployment Status
            </label>
            <SmartSelect
              value={editFormData.status}
              onChange={(value) =>
                setEditFormData({ ...editFormData, status: value })
              }
              searchable={false}
              options={[
                {
                  value: "active",
                  label: "Active",
                  description: "Serving customer calls and voice mode",
                  badge: "Live",
                },
                {
                  value: "draft",
                  label: "Draft / Paused",
                  description: "Hidden from callers",
                  badge: "Paused",
                },
              ]}
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Default Language
            </label>
            <SmartSelect
              value={editFormData.default_language}
              onChange={(value) =>
                setEditFormData({
                  ...editFormData,
                  default_language: value,
                })
              }
              searchable={false}
              options={[
                {
                  value: "en-IN",
                  label: "Hinglish / Indian English",
                  badge: "en-IN",
                },
                { value: "hi-IN", label: "Pure Hindi", badge: "hi-IN" },
                { value: "gu-IN", label: "Gujarati", badge: "gu-IN" },
              ]}
            />
          </div>
          <div
            className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-slate-700 space-y-2"
            aria-live="polite"
          >
            <strong className="text-emerald-900">
              Review agent impact before saving
            </strong>
            {editFormData.tts_voice !==
              (agent.tts_voice || "ritu") && (
              <p>
                Voice: {agent.tts_voice || "ritu"} →{" "}
                {editFormData.tts_voice}. Future responses will use the
                selected voice.
              </p>
            )}
            {editFormData.llm_model !==
              (agent.llm_model || "sarvam-105b") && (
              <p>
                Model: {agent.llm_model || "sarvam-105b"} →{" "}
                {editFormData.llm_model}. Future requests will use this
                model.
              </p>
            )}
            {editFormData.status !==
              (agent.status || "active") && (
              <p
                className={
                  editFormData.status === "draft"
                    ? "text-amber-800 font-semibold"
                    : ""
                }
              >
                Status: {agent.status || "active"} →{" "}
                {editFormData.status}.{" "}
                {editFormData.status === "draft"
                  ? "The agent will stop serving new calls."
                  : "The agent can serve new calls."}
              </p>
            )}
            {editFormData.default_language !==
              (agent.default_language || "en-IN") && (
              <p>
                Default language:{" "}
                {agent.default_language || "en-IN"} →{" "}
                {editFormData.default_language}.
              </p>
            )}
            {editFormData.tts_voice ===
              (agent.tts_voice || "ritu") &&
              editFormData.llm_model ===
                (agent.llm_model || "sarvam-105b") &&
              editFormData.status ===
                (agent.status || "active") &&
              editFormData.default_language ===
                (agent.default_language || "en-IN") && (
                <p>Voice, model, status and language are unchanged.</p>
              )}
          </div>
        </form>

        {/* Drawer Footer */}
        <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/80">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl h-10 px-5 text-xs font-bold text-slate-600"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="agent-edit-form"
            disabled={isSaving}
            className="rounded-xl h-10 px-6 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Save Agent Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
