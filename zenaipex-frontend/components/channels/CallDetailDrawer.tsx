"use client";

import React, { useRef, useState } from "react";
import { format } from "date-fns";
import { Drawer } from "@/components/ui/drawer";
import { Modal } from "@/components/ui/modal";
import { API_BASE_URL } from "@/lib/api/client";
import {
  Edit2,
  Voicemail,
  MessageSquare,
  Loader2,
  Play,
  Volume2,
} from "lucide-react";

interface CustomAudioPlayerProps {
  src: string;
}

const CustomAudioPlayer = ({ src }: CustomAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [isError, setIsError] = useState(false);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => setIsError(true));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsError(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      setVolume(vol);
    }
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    const newSpeed = speeds[nextIdx];
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
      setSpeed(newSpeed);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const m = Math.floor(time / 60)
      .toString()
      .padStart(2, "0");
    const s = Math.floor(time % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3 w-full">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsError(true)}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={isError}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? "bg-emerald-600 text-white shadow-emerald-200"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            } disabled:opacity-50`}
          >
            {isPlaying ? (
              <span className="w-3 h-3 bg-white rounded-xs" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-700">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            {isError && (
              <span className="text-[10px] text-rose-500 font-medium">
                Failed to load audio
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={cycleSpeed}
            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-bold text-slate-600 transition"
          >
            {speed}x
          </button>
          <div className="flex items-center gap-1.5 w-24">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolume}
              className="w-full accent-emerald-600 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
      <input
        type="range"
        min="0"
        max={duration || 100}
        value={currentTime}
        onChange={handleSeek}
        disabled={isError}
        className="w-full accent-emerald-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
};

export interface CallDetailDrawerProps {
  selectedCall: any | null;
  onClose: () => void;
  companyId: string | null;
  channel: any;
  callMessages: any[];
  callDetailProgress: number;
  callDetailStep: string;
  callDetailLoadError: string | null;
  recordingToken: string | null;
  agentsMap: Record<string, string>;
  agentName: string;
  formatSecs: (secs: number) => string;
  getCallContactPhone: (call: any) => string;
  contactEditOpen: boolean;
  setContactEditOpen: (open: boolean) => void;
  contactEditName: string;
  setContactEditName: (name: string) => void;
  contactEditSaving: boolean;
  saveSelectedCallerName: () => Promise<void>;
}

export default function CallDetailDrawer({
  selectedCall,
  onClose,
  companyId,
  channel,
  callMessages,
  callDetailProgress,
  callDetailStep,
  callDetailLoadError,
  recordingToken,
  agentsMap,
  agentName,
  formatSecs,
  getCallContactPhone,
  contactEditOpen,
  setContactEditOpen,
  contactEditName,
  setContactEditName,
  contactEditSaving,
  saveSelectedCallerName,
}: CallDetailDrawerProps) {
  if (!selectedCall) return null;

  return (
    <>
      <Drawer
        open={Boolean(selectedCall)}
        onClose={onClose}
        title="Call details"
        description={`${selectedCall.direction === "outbound" ? "Outbound" : "Inbound"} · ${selectedCall.status || "Active"}`}
        className="max-w-xl bg-[#FCFDFB]"
      >
        <div className="flex flex-col">
          <div className="p-6 border-b border-[#E7EEE9] shrink-0">
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900 mb-1 flex items-baseline gap-2">
                    {selectedCall.contact_name ? (
                      <>
                        <span className="text-slate-900">{selectedCall.contact_name}</span>
                        <span className="text-xs font-normal text-slate-500 font-mono">
                          ({getCallContactPhone(selectedCall) || "Unknown"})
                        </span>
                      </>
                    ) : (
                      <span className="font-mono">
                        {getCallContactPhone(selectedCall) || "Unknown"}
                      </span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setContactEditName(selectedCall.contact_name || "");
                      setContactEditOpen(true);
                    }}
                    className="mb-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                    title="Rename caller permanently"
                  >
                    <Edit2 className="h-3 w-3" />
                    Edit name
                  </button>
                </div>
                <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
                  <span
                    className={`uppercase text-[10px] tracking-wider font-bold border px-2 py-1 rounded-full ${selectedCall.direction === "outbound" ? "text-blue-700 border-blue-200 bg-blue-50" : "text-emerald-700 border-emerald-200 bg-emerald-50"}`}
                  >
                    {selectedCall.direction === "outbound"
                      ? "Outbound"
                      : "Inbound"}
                  </span>
                  <span>&bull;</span>
                  <span className="capitalize">
                    {selectedCall.status === "completed"
                      ? "Completed"
                      : (selectedCall.status || "Active").replace("-", " ")}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">
                  {selectedCall.created_at
                    ? format(new Date(selectedCall.created_at), "dd MMM yyyy")
                    : selectedCall.started_at
                      ? format(
                        new Date(selectedCall.started_at),
                        "dd MMM yyyy",
                      )
                      : "-"}
                </p>
                <p className="text-sm text-slate-500 font-medium">
                  {selectedCall.created_at
                    ? format(new Date(selectedCall.created_at), "hh:mm:ss a")
                    : selectedCall.started_at
                      ? format(
                        new Date(selectedCall.started_at),
                        "hh:mm:ss a",
                      )
                      : "-"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Duration
                </p>
                <p className="text-sm font-semibold mt-1 text-slate-700">
                  {formatSecs(selectedCall.duration_seconds)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Channel
                </p>
                <p className="text-xs font-semibold mt-1 text-slate-700 font-mono truncate">
                  {channel.phone_number || channel.name || "N/A"}
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  From (Caller)
                </p>
                <p className="text-xs font-semibold mt-1 text-slate-700 font-mono truncate" title={selectedCall.contact_name && selectedCall.direction !== "outbound" ? `${selectedCall.contact_name} (${selectedCall.from_phone || selectedCall.caller_phone || "N/A"})` : undefined}>
                  {selectedCall.contact_name && selectedCall.direction !== "outbound" ? (
                    <span>
                      <span className="font-sans font-bold text-slate-900">{selectedCall.contact_name}</span>{" "}
                      <span className="text-slate-500 text-[11px]">({selectedCall.from_phone || selectedCall.caller_phone || "N/A"})</span>
                    </span>
                  ) : (
                    selectedCall.from_phone || selectedCall.caller_phone || "N/A"
                  )}
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  To (Recipient)
                </p>
                <p className="text-xs font-semibold mt-1 text-slate-700 font-mono truncate" title={selectedCall.contact_name && selectedCall.direction === "outbound" ? `${selectedCall.contact_name} (${selectedCall.to_phone || selectedCall.destination_phone || selectedCall.caller_to || "N/A"})` : undefined}>
                  {selectedCall.contact_name && selectedCall.direction === "outbound" ? (
                    <span>
                      <span className="font-sans font-bold text-slate-900">{selectedCall.contact_name}</span>{" "}
                      <span className="text-slate-500 text-[11px]">({selectedCall.to_phone || selectedCall.destination_phone || selectedCall.caller_to || "N/A"})</span>
                    </span>
                  ) : (
                    selectedCall.to_phone || selectedCall.destination_phone || selectedCall.caller_to || "N/A"
                  )}
                </p>
              </div>
              {selectedCall.ended_at && (
                <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Ended At
                  </p>
                  <p className="text-xs font-semibold mt-1 text-slate-700">
                    {format(new Date(selectedCall.ended_at), "hh:mm:ss a")}
                  </p>
                </div>
              )}
              {selectedCall.failure_reason && (
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 col-span-2">
                  <p className="text-[10px] text-rose-500 uppercase font-bold tracking-wider">
                    Provider result
                  </p>
                  <p className="text-xs font-semibold mt-1 text-rose-700">
                    {selectedCall.failure_reason}
                  </p>
                </div>
              )}
              <div className="bg-white p-3 rounded-xl border border-[#E4ECE6]">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Turns
                </p>
                <p className="text-xs font-semibold mt-1 text-slate-700">
                  {selectedCall.turn_count || 0}
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#E4ECE6] col-span-2">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Media Availability
                </p>
                <div className="text-xs font-semibold mt-1 flex gap-2">
                  {selectedCall.recording_url ? (
                    <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                      Recording Available
                    </span>
                  ) : (
                    <span className="text-slate-400 border border-slate-100 px-2 py-0.5 rounded bg-white">
                      No Recording
                    </span>
                  )}
                  {callMessages?.length > 0 ? (
                    <span className="text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                      Transcript Available
                    </span>
                  ) : (
                    <span className="text-slate-400 border border-slate-100 px-2 py-0.5 rounded bg-white">
                      No Transcript
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {callDetailProgress < 100 && (
            <div className="px-6 md:px-8 pt-5 bg-white shrink-0">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
                    <span className="truncate text-xs font-bold text-emerald-800">
                      {callDetailStep}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-emerald-700">
                    {callDetailProgress}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${callDetailProgress}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-emerald-700">
                  Recording aur transcript ko prepare kiya ja raha hai…
                </p>
              </div>
            </div>
          )}

          {selectedCall.recording_url ? (
            <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center">
                <Voicemail className="w-4 h-4 mr-1.5 text-blue-600" /> Call
                Recording
              </h4>
              {recordingToken ? (
                <CustomAudioPlayer
                  src={`${API_BASE_URL}/admin/conversations/${companyId}/${selectedCall.id || selectedCall._id}/recording?token=${recordingToken}`}
                />
              ) : callDetailLoadError ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Recording player unavailable right now. Please retry by reopening the call.
                </div>
              ) : (
                <div className="h-10 w-full animate-pulse rounded-md bg-slate-200" aria-label="Loading recording" />
              )}
            </div>
          ) : (
            <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50 shrink-0">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center">
                <Voicemail className="w-4 h-4 mr-1.5 text-slate-400" /> Call
                Recording
              </h4>
              <p className="text-xs text-slate-400">
                Recording unavailable for this call.
              </p>
            </div>
          )}

          <div className="p-6 md:p-8 flex-1 bg-slate-50/30 flex flex-col">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center justify-center border-b border-slate-100 pb-4 shrink-0">
              <MessageSquare className="w-4 h-4 mr-1.5" /> Full Transcript
            </h4>
            <div className="w-full max-w-[720px] mx-auto px-4 md:px-6 space-y-6 pb-12 flex-1">
              {callDetailProgress < 100 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-80">
                  <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-500" />
                  <p className="text-sm font-medium text-slate-500">Preparing transcript…</p>
                  <p className="mt-1 text-xs text-slate-400">{callDetailProgress}% complete</p>
                </div>
              ) : callMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-70">
                  <MessageSquare className="w-8 h-8 text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500 italic text-center">
                    {callDetailLoadError || "No transcript available for this call."}
                  </p>
                </div>
              ) : (
                callMessages.map((msg, i) => {
                  const timeStr =
                    msg.timestamp || msg.created_at
                      ? format(
                        new Date(msg.timestamp || msg.created_at),
                        "hh:mm:ss a",
                      )
                      : "";
                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${msg.role === "assistant" ? "items-start" : "items-end"}`}
                    >
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 px-1 ${msg.role === "assistant" ? "text-indigo-600" : "text-slate-500"}`}
                      >
                        {msg.role === "assistant"
                          ? selectedCall?.agent_id
                            ? agentsMap[selectedCall.agent_id] ||
                            agentName ||
                            "AI AGENT"
                            : agentName || "AI AGENT"
                          : "CUSTOMER"}
                      </p>
                      <div
                        className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 shadow-sm text-sm border overflow-hidden break-words ${msg.role === "assistant" ? "bg-white border-slate-200 text-slate-800 rounded-tl-sm" : "bg-slate-900 border-slate-800 text-white rounded-tr-sm"}`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content || msg.text}
                        </p>
                      </div>
                      {timeStr && (
                        <span className="text-[9px] font-medium text-slate-400 mt-1.5 px-1">
                          {timeStr}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </Drawer>

      {/* PERMANENT CALLER NAME EDITOR */}
      <Modal
        open={contactEditOpen}
        onClose={() => setContactEditOpen(false)}
        title="Rename caller"
        description={`Ye naam is number ki live calls, history aur future calls me dikhega: ${getCallContactPhone(selectedCall) || "Unknown number"}`}
      >
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">Caller name</label>
            <input
              autoFocus
              value={contactEditName}
              onChange={(event) => setContactEditName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveSelectedCallerName();
              }}
              placeholder="e.g. Farhan Kureshi"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setContactEditOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={contactEditSaving || !contactEditName.trim()}
              onClick={() => void saveSelectedCallerName()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {contactEditSaving ? "Saving…" : "Save name"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
