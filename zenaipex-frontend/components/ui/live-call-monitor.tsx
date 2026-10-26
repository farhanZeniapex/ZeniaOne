import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Phone, PhoneOff, Mic, User, Volume2, Grid, Play, Circle, Info } from "lucide-react";
import { fetchApi } from "@/lib/api/client";
import { CustomAudioPlayer } from "./custom-audio-player";

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface CallData {
  id: string;
  company_id: string;
  status: string;
  call_sid?: string;
  agent_id?: string;
  call_started_at?: string;
  ringing_started_at?: string;
  answered_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  failure_reason?: string;
  recording_url?: string;
  messages: Message[];
}

interface Props {
  callSid: string;
  contactName: string;
  onClose: () => void;
}

export function LiveCallMonitor({ callSid, contactName, onClose }: Props) {
  const [data, setData] = useState<CallData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [recordingToken, setRecordingToken] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  useEffect(() => {
    if (data?.recording_url && !recordingToken) {
      const fetchToken = async () => {
        try {
          const res = await fetchApi<{token: string}>(`/admin/conversations/${data.company_id}/${data.id}/recording-token`);
          setRecordingToken(res.token);
        } catch (e) {
          console.error("Failed to fetch recording token", e);
        }
      };
      fetchToken();
    }
  }, [data?.recording_url, data?.company_id, data?.id, recordingToken]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const fetchCallData = async () => {
      try {
        const res = await fetchApi<CallData>(`/admin/conversations/by-call-sid/${callSid}`);
        setData(res);
        if (["completed", "hung-up", "failed", "busy", "no-answer", "canceled", "cancelled"].includes(String(res.status).toLowerCase())) {
          clearInterval(interval);
        }
      } catch (err) {
        // Conversation not yet created, just wait.
      }
    };
    fetchCallData();
    interval = setInterval(fetchCallData, 1000);
    return () => clearInterval(interval);
  }, [callSid]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data?.messages]);

  const endCall = async () => {
    if (!data || isEnding) return;
    setIsEnding(true);
    try {
      await fetchApi(`/admin/conversations/by-call-sid/${callSid}/end`, { method: "POST" });
    } catch (e) {
      console.error(e);
    } finally {
      setIsEnding(false);
    }
  };

  const getDerivedState = () => {
    if (!data) return "INITIALIZING";
    const st = data.status.toLowerCase();
    if (data.failure_reason) return "FAILED";
    if (st === "no-answer") return "NO_ANSWER";
    if (st === "busy") return "BUSY";
    if (st === "canceled" || st === "cancelled") return "CANCELED";
    if (st === "hung-up" || st === "failed") return "FAILED";
    if (st === "completed" || data.ended_at) return "ENDED";
    if (st === "in-progress" || st === "in_progress" || data.answered_at) return "CONNECTED";
    if (data.ringing_started_at) return "RINGING";
    return "CALLING";
  };

  const state = getDerivedState();

  const getTimerText = () => {
    if (!data) return "";
    if (state === "ENDED" && Number(data.duration_seconds) > 0) {
      const totalSeconds = Math.floor(Number(data.duration_seconds));
      const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
      const secs = (totalSeconds % 60).toString().padStart(2, "0");
      return `${mins}:${secs}`;
    }
    let diff = 0;
    const answeredTime = data.answered_at ? new Date(data.answered_at).getTime() : (data.call_started_at ? new Date(data.call_started_at).getTime() : now);
    
    if (state === "CONNECTED") {
      diff = now - answeredTime;
    } else if (state === "ENDED" && data.ended_at) {
      diff = new Date(data.ended_at).getTime() - answeredTime;
    } else if (state === "RINGING" && data.ringing_started_at) {
      diff = now - new Date(data.ringing_started_at).getTime();
    } else if (["FAILED", "NO_ANSWER", "BUSY", "CANCELED"].includes(state)) {
      return "00:00";
    }
    
    if (diff < 0) diff = 0;
    const totalSeconds = Math.floor(diff / 1000);
    const mins = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const secs = (totalSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const timerText = getTimerText();
  const isSpeaking = data?.messages && data.messages.length > 0 && data.messages[data.messages.length - 1].role === "assistant" && state === "CONNECTED";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#0F1F18]/45 backdrop-blur-sm p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[calc(100dvh-2rem)] max-h-[920px] flex flex-col md:flex-row overflow-hidden relative">
        
        {/* LEFT PANEL: Phone UI */}
        <div className="w-full md:w-5/12 bg-gray-50 flex flex-col shrink-0 relative border-b md:border-b-0 md:border-r border-gray-200 min-h-[450px] md:min-h-0 overflow-y-auto">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6">
              <button onClick={onClose} className="p-2 hover:bg-[#E7F0FF] rounded-full transition-colors">
              <X className="h-6 w-6 text-gray-500" />
            </button>
            <div className="flex items-center gap-2">
              {state === "INITIALIZING" && <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
              {state === "CALLING" && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
              {state === "RINGING" && <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
              {state === "CONNECTED" && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
              {state === "ENDED" && <span className="w-2 h-2 rounded-full bg-gray-400" />}
              {state === "FAILED" && <span className="w-2 h-2 rounded-full bg-red-500" />}
              {state === "NO_ANSWER" && <span className="w-2 h-2 rounded-full bg-amber-500" />}
              {state === "BUSY" && <span className="w-2 h-2 rounded-full bg-amber-500" />}
              {state === "CANCELED" && <span className="w-2 h-2 rounded-full bg-gray-400" />}
              <span className="text-sm font-medium text-gray-600">
                {state === "INITIALIZING" && "Connecting..."}
                {state === "CALLING" && "Calling..."}
                {state === "RINGING" && "Ringing..."}
                {state === "CONNECTED" && "Live Call Active"}
                {state === "ENDED" && "Call Ended"}
                {state === "FAILED" && "Call Failed"}
                {state === "NO_ANSWER" && "No Answer"}
                {state === "BUSY" && "Line Busy"}
                {state === "CANCELED" && "Call Canceled"}
              </span>
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>

          {/* Caller Identity */}
          <div className="flex flex-col items-center mt-4">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-sage-200 to-sage-400 flex items-center justify-center shadow-lg text-white mb-4">
              <User className="h-12 w-12" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">{contactName}</h2>
            <p className="text-lg text-gray-500 font-medium mt-1">
              {["FAILED", "NO_ANSWER", "BUSY", "CANCELED"].includes(state) ? (state === "NO_ANSWER" ? "No answer" : state === "BUSY" ? "Busy" : state === "CANCELED" ? "Canceled" : "Failed") : timerText}
            </p>
          </div>

          {/* Central Visualization */}
          <div className="flex-1 flex flex-col items-center justify-center relative w-full mt-4 md:mt-8 min-h-[200px]">
            <div className="relative w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
              {state === "RINGING" && (
                <>
                  <div className="absolute inset-0 border-2 border-sage-300 rounded-full animate-ping opacity-20 scale-150" style={{ animationDuration: '3s' }}></div>
                  <div className="absolute inset-0 border-2 border-sage-400 rounded-full animate-ping opacity-40 scale-125" style={{ animationDuration: '2s' }}></div>
                </>
              )}
              {state === "CONNECTED" && (
                <div className={`absolute inset-0 rounded-full bg-sage-200 ${isSpeaking ? 'animate-pulse scale-110 opacity-60' : 'opacity-20'} transition-all duration-300`}></div>
              )}
              
              <div className={`relative z-10 w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center shadow-xl transition-all duration-500 ${
                state === "INITIALIZING" || state === "CALLING" || state === "RINGING" ? 'bg-gray-800' :
                state === "ENDED" || ["FAILED", "NO_ANSWER", "BUSY", "CANCELED"].includes(state) ? 'bg-gray-300' : 'bg-sage-600'
              }`}>
                {state === "ENDED" || ["FAILED", "NO_ANSWER", "BUSY", "CANCELED"].includes(state) ? (
                  <PhoneOff className="h-10 w-10 md:h-12 md:w-12 text-gray-500" />
                ) : (
                  <Phone className="h-10 w-10 md:h-12 md:w-12 text-white animate-pulse" />
                )}
              </div>
            </div>
            
            <p className="mt-4 md:mt-8 text-sm font-medium text-gray-500 text-center px-8">
              {state === "INITIALIZING" && "Connecting to provider..."}
              {state === "CALLING" && "Initiating call..."}
              {state === "RINGING" && "Waiting for answer..."}
              {state === "CONNECTED" && isSpeaking && "ZeniaONE is speaking..."}
              {state === "CONNECTED" && !isSpeaking && "Listening for response..."}
              {state === "ENDED" && "Call completed successfully."}
              {state === "FAILED" && (data?.failure_reason || "The voice connection was interrupted or rejected.")}
              {state === "NO_ANSWER" && "The number did not answer."}
              {state === "BUSY" && "The number was busy."}
              {state === "CANCELED" && "The call was canceled before connecting."}
            </p>
            
            {/* Recording Indicator */}
            {(state === "CONNECTED" || state === "RINGING") && (
              <div className="absolute bottom-4 flex items-center gap-2 text-xs font-semibold text-gray-400 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                <Circle className="w-3 h-3 fill-red-500 text-red-500 animate-pulse" /> Recording
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          {!['ENDED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELED'].includes(state) && (
            <div className="pb-6 md:pb-10 pt-4 px-8 w-full mt-auto">
              <div className="flex items-center justify-center gap-4 md:gap-6">
                <button title="Mute (Not supported)" disabled className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm opacity-50 cursor-not-allowed">
                  <Mic className="h-5 w-5" />
                </button>
                <button title="Keypad (Not supported)" disabled className="h-14 w-14 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm opacity-50 cursor-not-allowed">
                  <Grid className="h-5 w-5" />
                </button>
                <button title="Speaker (Not supported)" disabled className="h-14 w-14 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm opacity-50 cursor-not-allowed">
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              <div className="flex justify-center mt-6">
                <button 
                  onClick={endCall}
                  disabled={isEnding || state === "INITIALIZING"}
                  className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 disabled:bg-red-300 flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
                >
                  <PhoneOff className="h-7 w-7" />
                </button>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT PANEL: Transcript & Summary */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-0">
          
          {(["ENDED", "FAILED", "NO_ANSWER", "BUSY", "CANCELED"] as string[]).includes(state) ? (
            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
              <h3 className="text-2xl font-bold text-gray-800 mb-8 border-b pb-4">Call Summary</h3>
              
              <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-8">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Status</p>
                  <p className={`font-medium ${state === 'ENDED' ? 'text-green-600' : state === 'CANCELED' ? 'text-gray-600' : 'text-amber-600'}`}>
                    {state === 'ENDED' ? 'Completed' : state === 'NO_ANSWER' ? 'No answer' : state === 'BUSY' ? 'Busy' : state === 'CANCELED' ? 'Canceled' : 'Failed'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Call Duration</p>
                  <p className="font-medium text-gray-800">{timerText}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Agent</p>
                  <p className="font-medium text-gray-800">ZeniaONE</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Messages</p>
                  <p className="font-medium text-gray-800">{data?.messages?.length || 0} messages</p>
                </div>
                {data?.call_started_at && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold">Started</p>
                    <p className="font-medium text-gray-800">{new Date(data.call_started_at).toLocaleTimeString()}</p>
                  </div>
                )}
                {data?.ended_at && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold">Ended</p>
                    <p className="font-medium text-gray-800">{new Date(data.ended_at).toLocaleTimeString()}</p>
                  </div>
                )}
              </div>

              {(["FAILED", "NO_ANSWER", "BUSY", "CANCELED"] as string[]).includes(state) && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8 flex items-start gap-3">
                  <Info className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-red-800">Call Result</h4>
                    <p className="text-sm text-red-600 mt-1">{data?.failure_reason || (state === "NO_ANSWER" ? "The number did not answer." : state === "BUSY" ? "The number was busy." : state === "CANCELED" ? "The call was canceled before connecting." : "The voice connection was interrupted. The provider returned an error.")}</p>
                  </div>
                </div>
              )}

              {data?.recording_url ? (
                <div className="mt-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-sm text-gray-600 mb-4 font-semibold flex items-center gap-2">
                    <Mic className="w-4 h-4 text-blue-600" /> Call Recording
                  </p>
                  {recordingToken ? (
                    <CustomAudioPlayer src={`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8002/api/v1"}/admin/conversations/${data.company_id}/${data.id}/recording?token=${recordingToken}`} />
                  ) : (
                    <div className="animate-pulse bg-gray-200 h-10 w-full rounded-md"></div>
                  )}
                </div>
              ) : (
                <div className="mt-4 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-sm text-gray-400 font-semibold flex items-center gap-2">
                    <PhoneOff className="w-4 h-4" /> Recording unavailable
                  </p>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button 
                  onClick={() => setShowTranscript(!showTranscript)}
                  className="text-blue-600 font-medium text-sm hover:text-blue-700 underline"
                >
                  {showTranscript ? "Hide Transcript" : "Show Transcript"}
                </button>
              </div>

              {showTranscript && (
                <div className="mt-4 max-h-[300px] overflow-y-auto p-4 space-y-4 bg-gray-50/50 border border-gray-100 rounded-2xl">
                  {data?.messages.map((msg) => {
                    const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                    return (
                      <div key={msg.id} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
                        <div className="flex flex-col max-w-[85%]">
                            <div className={`rounded-xl p-3 shadow-sm ${msg.role === "assistant" ? "bg-white border border-gray-100 text-gray-800" : "bg-sage-600 text-white"}`}>
                            <p className="text-[9px] font-bold mb-0.5 opacity-60 uppercase tracking-widest">
                              {msg.role === "assistant" ? "ZeniaONE" : "CUSTOMER"}
                            </p>
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content || (msg as any).text}</p>
                          </div>
                          {time && (
                              <span className={`text-[9px] text-gray-400 mt-1 px-1 ${msg.role === "assistant" ? "text-left" : "text-right"}`}>
                              {time}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="p-5 border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Live Transcript</h3>
                <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                  {data?.messages?.length || 0} messages
                </span>
              </div>
              
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30">
                {(state === "CALLING" || state === "RINGING" || state === "INITIALIZING") && (
                  <div className="flex justify-center items-center h-full text-gray-400 italic text-sm">
                    Transcript will appear here once connected...
                  </div>
                )}
                
                {data?.messages.map((msg) => {
                  const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                  return (
                    <div key={msg.id} className={`flex ${msg.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                      <div className="flex flex-col max-w-[80%]">
                        <div className={`rounded-2xl p-4 shadow-sm ${
                          msg.role === 'assistant' 
                            ? 'bg-sage-50 text-sage-900 border border-sage-100 rounded-tl-none' 
                            : 'bg-gray-800 text-white rounded-tr-none'
                        }`}>
                          <p className="text-[10px] font-bold mb-1 opacity-50 uppercase tracking-widest">
                            {msg.role === 'assistant' ? 'ZeniaONE' : 'YOU'}
                          </p>
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        </div>
                        {time && (
                          <span className={`text-[10px] text-gray-400 mt-1.5 px-1 ${msg.role === 'assistant' ? 'text-left' : 'text-right'}`}>
                            {time}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </div>
      </div>
    </div>,
    document.body,
  );
}
