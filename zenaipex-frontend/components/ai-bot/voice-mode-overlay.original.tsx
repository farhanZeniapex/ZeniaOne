"use client";

/**
 * VoiceModeDock — ZeniaOne Inline Live Voice Panel
 *
 * Renders as a compact bottom dock INSIDE the existing chat layout.
 * The chat history remains fully visible above this panel.
 *
 * Architecture:
 *  - Turn-based: spoken audio → POST /voice-chat → STT + answer + audio_base64
 *  - VAD: Web Audio API AnalyserNode monitors RMS so the recorder auto-stops
 *    when the user stops speaking (no manual "Done Speaking" per turn)
 *  - Mic is paused while AI speaks to prevent TTS echo / feedback loop
 *  - Same conversation_id as text chat — history is fully shared
 *  - User transcript and AI answer both become normal chat messages
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { agentsApi, Agent } from "@/lib/api/agents";
import { VOICES } from "@/lib/data/voices";
import { useRouter } from "next/navigation";
import { canonicalizeCustomerFacingName } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "ended";

// ─── VAD constants ────────────────────────────────────────────────────────────
// These are fallback values only. Adaptive calibration overrides onset/continue.
const VAD_CALIBRATION_MS    = 800;   // measure ambient noise for this long before listening
const VAD_ONSET_BOOST       = 4.5;   // Increased to prevent false positives from background noise
const VAD_CONTINUE_BOOST    = 2.0;   // continue threshold = baseline × this (lower than onset)
const VAD_SILENCE_HOLD_MS   = 700;   // Reduced from 900ms for faster, more natural responses
const VAD_SHORT_SILENCE_MS  = 500;   // Ultra-fast cutoff for short acknowledgements (Haan, Yes)
const VAD_SPEECH_MIN_MS     = 120;   // minimum speech duration to submit (avoids click/pop)
const VAD_MAX_RECORD_MS     = 15000; // hard cap per utterance
const VAD_MIN_BLOB_BYTES    = 3000;  // reject blobs smaller than this (near-empty clips)

// ─── Helper: human-readable voice label ───────────────────────────────────────
function getVoiceLabel(voiceId: string | undefined): string {
  if (!voiceId) return "Default";
  const found = VOICES.find((v) => v.id === voiceId);
  return found ? found.name : voiceId.charAt(0).toUpperCase() + voiceId.slice(1);
}

// ─── Compact Orb ─────────────────────────────────────────────────────────────
function CompactOrb({ state }: { state: VoiceState }) {
  const innerColor =
    state === "error"
      ? "#b45252"
      : state === "speaking"
      ? "#3E5448"
      : state === "listening"
      ? "#5F786D"
      : state === "thinking"
      ? "#7A9184"
      : "#8EA89F";

  const glowColor =
    state === "error"
      ? "rgba(185,80,80,0.30)"
      : state === "speaking"
      ? "rgba(62,84,72,0.35)"
      : state === "listening"
      ? "rgba(95,120,109,0.40)"
      : "rgba(95,120,109,0.15)";

  const orbAnimClass =
    state === "listening"
      ? "animate-orb-breathe"
      : state === "thinking"
      ? "animate-orb-think"
      : state === "error"
      ? "animate-orb-error"
      : state === "speaking"
      ? ""
      : "animate-orb-idle";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      {/* Outer ripple rings (speaking) */}
      {state === "speaking" && (
        <>
          <div
            className="absolute inset-0 rounded-full animate-orb-ripple pointer-events-none"
            style={{ border: `2px solid rgba(62,84,72,0.38)` }}
          />
          <div
            className="absolute inset-0 rounded-full animate-orb-ripple-inner pointer-events-none"
            style={{ border: `1.5px solid rgba(62,84,72,0.20)` }}
          />
        </>
      )}
      {/* Listening halo */}
      {state === "listening" && (
        <div
          className="absolute inset-0 rounded-full animate-orb-listen-halo pointer-events-none"
          style={{ background: `radial-gradient(circle, transparent 44%, rgba(95,120,109,0.16) 68%, transparent 100%)` }}
        />
      )}
      {/* Soft glow disc */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 64,
          height: 64,
          background: `radial-gradient(circle at 36% 32%, ${glowColor} 0%, transparent 70%)`,
          filter: "blur(8px)",
          transition: "all 0.5s ease",
        }}
      />
      {/* Main orb */}
      <div
        className={`relative rounded-full flex items-center justify-center ${orbAnimClass}`}
        style={{
          width: 52,
          height: 52,
          background: `radial-gradient(circle at 36% 32%, #8EA89F 0%, ${innerColor} 55%, #2A3D34 100%)`,
          boxShadow: `0 3px 20px ${glowColor}, 0 0 0 1px rgba(255,255,255,0.06) inset`,
          transition: "background 0.5s ease, box-shadow 0.5s ease",
        }}
      >
        {/* Inner highlight */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 22,
            height: 22,
            top: 6,
            left: 7,
            background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)",
          }}
        />
        {/* Speaking waveform bars */}
        {state === "speaking" && (
          <div className="flex items-end justify-center gap-[2px] h-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`rounded-full bg-white/70 animate-wave-${i}`}
                style={{ width: 2, height: 5 }}
              />
            ))}
          </div>
        )}
        {/* Thinking dots */}
        {state === "thinking" && (
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-white/65 animate-bounce"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        )}
        {/* Error X */}
        {state === "error" && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth={3} stroke="rgba(255,255,255,0.85)" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )}
        {/* Idle mic icon */}
        {(state === "idle" || state === "connecting" || state === "ended") && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="rgba(255,255,255,0.65)" strokeLinecap="round">
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="22"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  agent: Agent;
  companyId: string;
  /** Shared conversation ID — same as text chat */
  activeConvId: string | null;
  onConvIdChange: (id: string) => void;
  /** Called when voice session ends — dock unmounts */
  onEnd: () => void;
  /** Called after each voice exchange so text chat history is updated */
  onMessagesUpdate: (userText: string, aiText: string, sources?: any[]) => void;
  /** Current chat messages to send as history */
  messages: any[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VoiceModeDock({
  agent,
  companyId,
  activeConvId,
  onConvIdChange,
  onEnd,
  onMessagesUpdate,
  messages,
}: Props) {
  const router = useRouter();

  const [voiceState, setVoiceState] = useState<VoiceState>("connecting");
  const [voiceError, setVoiceError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState(""); // last user transcript

  // --- Refs (never in state to avoid stale closures) ---
  const voiceActiveRef = useRef(true);
  const isProcessingRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTurnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceSessionIdRef = useRef<number>(0);
  const playbackGenerationRef = useRef<number>(0);
  const sessionTokenRef = useRef<number>(0);
  const convPromiseRef = useRef<Promise<any> | null>(null);
  const speakPromiseRef = useRef<Promise<any> | null>(null);
  const convIdRef = useRef<string | null>(activeConvId);
  const messagesRef = useRef<any[]>(messages);
  const isMutedRef = useRef(false);
  // Incomplete-transcript accumulation (Problem 1)
  const partialTranscriptRef = useRef<string>("");
  const continuationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Streaming (Step 7B)
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPongTimeRef = useRef<number>(0);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const logVoiceFlow = useCallback((step: string, error?: string) => {
    // Temporary diagnostics removed
  }, []);

  const streamingFailedRef = useRef(false);

  // PCM Streaming refs
  const pcmAudioContextRef = useRef<AudioContext | null>(null);
  const pcmActiveSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const pcmNextStartTimeRef = useRef<number>(0);
  const pcmAllChunksReceivedRef = useRef<boolean>(false);

  // Keep refs in sync
  useEffect(() => { convIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => { t.enabled = !isMuted; });
    }
  }, [isMuted]);



  // ── Handlers ─────────────────────────────────────────────────────────────

  const releaseAll = useCallback(() => {
    voiceActiveRef.current = false;
    isProcessingRef.current = false;
    partialTranscriptRef.current = "";
    if (continuationTimerRef.current) { clearTimeout(continuationTimerRef.current); continuationTimerRef.current = null; }
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    if (maxTurnTimerRef.current) { clearTimeout(maxTurnTimerRef.current); maxTurnTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
      mediaRecorderRef.current = null;
    }
    if (heartbeatTimerRef.current) { clearInterval(heartbeatTimerRef.current); heartbeatTimerRef.current = null; }
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (_) {}
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (_) {}
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioPlayerRef.current) {
      console.log(`[VOICE_AUDIO_CLEANUP] playbackId=${playbackGenerationRef.current} reason=RELEASE_ALL`);
      audioPlayerRef.current.pause();
      if (audioPlayerRef.current.src.startsWith('blob:')) {
         URL.revokeObjectURL(audioPlayerRef.current.src);
      }
      audioPlayerRef.current.src = "";
      audioPlayerRef.current = null;
    }
    if (pcmActiveSourcesRef.current.length > 0) {
        console.log(`[VOICE_PCM_QUEUE_CLEAR] Stopping ${pcmActiveSourcesRef.current.length} queued chunks reason=INTERRUPT`);
        pcmActiveSourcesRef.current.forEach((s: any) => {
            try { s.stop(); s.disconnect(); } catch(e) {}
        });
      pcmActiveSourcesRef.current = [];
    }
    if (pcmAudioContextRef.current) {
      try { pcmAudioContextRef.current.close(); } catch (_) {}
      pcmAudioContextRef.current = null;
    }
    console.log("[VOICE_AUDIO_CLEANUP] All resources released");
    console.log("[VOICE_MODE_CLOSE] Resources released");
  }, []);

  const suspendMic = useCallback(() => {
    console.log("[MIC_SUSPEND] Bypassed. Keeping microphone active for barge-in support.");
    // We rely on getUserMedia { echoCancellation: true } to prevent AI speech from feeding back.
  }, []);

  function endSession() {
    voiceSessionIdRef.current++;
    releaseAll();
    setVoiceState("ended");
    onEnd();
  }

  // ── Welcome greeting ──────────────────────────────────────────────────────
  function getWelcomeText(): string {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return "Good morning! Welcome to ZeniaOne. How can I help you today?";
    if (h >= 12 && h < 17) return "Good afternoon! Welcome to ZeniaOne. How can I help you today?";
    if (h >= 17 && h < 21) return "Good evening! Welcome to ZeniaOne. How can I help you today?";
    return "Hello! Welcome to ZeniaOne. How can I help you today?";
  }

  const playWelcomeGreeting = useCallback(async (token?: number) => {
    if (!voiceActiveRef.current) return;
    if (token !== undefined && token !== sessionTokenRef.current) {
        console.log("[VOICE_START_CANCELLED] playWelcomeGreeting aborted due to stale mount token");
        return;
    }
    const text = getWelcomeText();
    console.log(`[VOICE_WELCOME_START] text="${text}"`);
    
    // Append to UI immediately as a normal assistant message
    const lastMsg = messagesRef.current[messagesRef.current.length - 1];
    if (lastMsg && (lastMsg.content === text || lastMsg.text === text)) {
      console.log("[VOICE_WELCOME_START] Skipping duplicate welcome text in UI");
    } else {
      onMessagesUpdate("", text, []);
    }

    setVoiceState("speaking");

    const currentPlaybackId = ++playbackGenerationRef.current;
    
    // Create Audio object synchronously
    const audio = new Audio();
    audio.preload = "auto";
    audioPlayerRef.current = audio;

    try {
      if (!speakPromiseRef.current) {
          logVoiceFlow("welcome_tts_request");
          console.log("[VOICE_WELCOME_REQUEST] Fetching TTS from backend...");
          speakPromiseRef.current = agentsApi.speak(companyId, agent.id, text);
      } else {
          console.log("[VOICE_WELCOME_REQUEST] Reusing existing TTS promise (single-flight)");
      }
      
      const res = await speakPromiseRef.current.catch((err: any) => {
          logVoiceFlow("speak_request", err?.message || String(err));
          console.error(`[VOICE_START_ERROR] step=speak_request message=${err?.message || String(err)}`);
          throw err;
      });
      
      if (token !== undefined && token !== sessionTokenRef.current) {
         console.log("[VOICE_START_CANCELLED] TTS response ignored due to stale mount token");
         return;
      }
      if (!voiceActiveRef.current || playbackGenerationRef.current !== currentPlaybackId) {
         console.log(`[VOICE_START_ERROR] step=speak_request message=Aborted due to inactive voice (${voiceActiveRef.current}) or generation mismatch`);
         return;
      }

      // Re-attach audio object in case StrictMode unmount nullified audioPlayerRef.current
      audioPlayerRef.current = audio;

      const base64Str = res.audio_base64;
      const audioBytes = res.audio_bytes || 0;
      
      logVoiceFlow("welcome_tts_response");
      console.log(`[VOICE_TTS_RESPONSE] status=200 content_type=audio/mpeg blob_size=${base64Str.length} byte_length=${atob(base64Str).length}`);

      logVoiceFlow("audio_decode_start");
      const byteStr = atob(base64Str);
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
      
      const blob = new Blob([ab], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);
      logVoiceFlow("audio_decode_success");
      
      audio.onended = () => {
        console.log(`[VOICE_DEBUG] audio_play_ended`);
        if (playbackGenerationRef.current !== currentPlaybackId) return;
        console.log(`[VOICE_WELCOME_PLAY_ENDED]`);
        URL.revokeObjectURL(audioUrl);
        if (audioPlayerRef.current === audio) audioPlayerRef.current = null;
        isProcessingRef.current = false;
        if (voiceActiveRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            setVoiceState("listening");
        }
      };

      audio.onerror = (e: any) => {
        console.error(`[VOICE_DEBUG_ERROR] step=audio_onerror error=${e?.type}`);
        const errName = e && e.type ? e.type : "error";
        console.error(`[VOICE_WELCOME_PLAY_ERROR] name=${errName} message=Playback error event`);
        URL.revokeObjectURL(audioUrl);
        if (audioPlayerRef.current === audio) audioPlayerRef.current = null;
        isProcessingRef.current = false;
        if (voiceActiveRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            setVoiceState("listening");
        }
      };

      audio.src = audioUrl;
      console.log(`[VOICE_WELCOME_PLAY_START]`);
      
      suspendMic();
      console.log(`[VOICE_DEBUG] audio_play_called`);
      audio.play().then(() => {
        console.log(`[VOICE_DEBUG] audio_play_started`);
        console.log(`[VOICE_WELCOME_PLAY_OK]`);
      }).catch((err: any) => {
        console.error(`[VOICE_DEBUG_ERROR] step=audio_play_catch error=${err.message}`);
        console.error(`[VOICE_WELCOME_PLAY_ERROR] name=${err.name} message=${err.message}`);
        URL.revokeObjectURL(audioUrl);
        if (audioPlayerRef.current === audio) audioPlayerRef.current = null;
        isProcessingRef.current = false;
        if (voiceActiveRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            setVoiceState("listening");
        }
      });
    } catch (err: any) {
      console.error("[VOICE_WELCOME_ERROR] TTS request failed:", err);
      isProcessingRef.current = false;
      if (voiceActiveRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          setVoiceState("listening");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, companyId, logVoiceFlow]);



  // ── VAD & Recording Logic ──────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    console.log(`[VOICE_DEBUG] before_start_listening`);
    if (!voiceActiveRef.current || isProcessingRef.current) {
        console.log(`[VOICE_DEBUG_ERROR] step=start_listening_abort error=voiceActive=${voiceActiveRef.current},isProcessing=${isProcessingRef.current}`);
        return;
    }
    
    const currentSessionId = ++voiceSessionIdRef.current;
    const traceId = `VS-${currentSessionId}`;

    setVoiceError("");
    setLiveTranscript("");
    
    
    // Acquire mic
    let localStream: MediaStream;
    try {
      console.log(`[VOICE_DEBUG] before_get_user_media`);
      logVoiceFlow("before_listening");
      logVoiceFlow("before_get_user_media");
      console.log(`[VOICE_TRACE][id=${traceId}][MIC] microphone_start_requested`);
      console.log("[VOICE_START_STEP] step=microphone");
      if (!streamRef.current) {
        console.log("[MIC_READY] Requesting microphone");
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false
        });
        streamRef.current = localStream;
        localStream.getAudioTracks().forEach((t) => { t.enabled = !isMutedRef.current; });
        const settings = localStream.getAudioTracks()[0]?.getSettings();
        console.log(`[VOICE_DEBUG] get_user_media_success`);
        logVoiceFlow("get_user_media_success");
        logVoiceFlow("microphone_ready");
        console.log(`[VOICE_MIC_SETTINGS] sampleRate=${settings?.sampleRate} channelCount=${settings?.channelCount} echoCancellation=${settings?.echoCancellation} noiseSuppression=${settings?.noiseSuppression} autoGainControl=${settings?.autoGainControl}`);
        console.log(`[VOICE_MIC_READY] tracks=${localStream.getAudioTracks().length} label=${localStream.getAudioTracks()[0]?.label}`);
      } else {
        localStream = streamRef.current;
      }
    } catch {
      setVoiceError("Microphone access was denied. Please allow access and try again.");
      setVoiceState("error");
      voiceActiveRef.current = false;
      return;
    }

    if (!voiceActiveRef.current) return;

    // Web Audio VAD setup
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      console.log(`[VOICE_AUDIO_CONTEXT] state=${ctx.state} sampleRate=${ctx.sampleRate}`);
      if (ctx.state === "suspended") {
        ctx.resume().catch(e => console.warn(`[VOICE_TRACE][id=${traceId}][MIC] audio_context_resume_failed`, e));
      }
      
      console.log(`[VOICE_TRACE][id=${traceId}][MIC] microphone_started`);
      
      if (!analyserRef.current) {
        const source = ctx.createMediaStreamSource(localStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analyserRef.current = analyser;
      }
    } catch (err) {
      console.error("VAD Setup Error:", err);
      setVoiceError("Audio analysis failed. Cannot detect speech.");
      setVoiceState("error");
      return;
    }

    setVoiceState("listening");
    logVoiceFlow("listening_state");
    console.log("[VOICE_UI_STATE] LISTENING");

    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (maxTurnTimerRef.current) {
      clearTimeout(maxTurnTimerRef.current);
      maxTurnTimerRef.current = null;
    }
    if (continuationTimerRef.current) {
      clearTimeout(continuationTimerRef.current);
      continuationTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
      mediaRecorderRef.current = null;
    }

    const analyser = analyserRef.current;
    if (!analyser) return;

    const buf = new Float32Array(analyser.fftSize);

    // ── VAD state ──────────────────────────────────────────────────────────────
    let hasSent        = false;
    let speechStart:   number | null = null;
    let speechEnd:     number | null = null;
    let silenceStart:  number | null = null;

    // Calibration
    let isCalibrating        = true;
    const calibrationSamples:  number[] = [];
    let baselineRMS          = 0.008;
    let onsetThreshold       = 0.028;  // overwritten after calibration
    let continueThreshold    = 0.016;  // overwritten after calibration
    const calibrationStartTime = Date.now();

    let startupGuardEnd = 0;

    let isSpeechActive = false;  // true from first onset until silence hold expires
    let currentEndReason = "silence";

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";

    console.log(`[VOICE_RECORDER_CODEC] mime=${mimeType || "default"}`);

    // ── Helper: stop and submit the current recording ─────────────────────────
    const stopAndSubmit = (reason: string) => {
      if (voiceSessionIdRef.current !== currentSessionId) {
        console.log(`[VOICE_STALE_CALLBACK_IGNORED] old_session_id=${currentSessionId} current_session_id=${voiceSessionIdRef.current}`);
        return;
      }
      currentEndReason = reason;
      if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
      if (maxTurnTimerRef.current) { clearTimeout(maxTurnTimerRef.current); maxTurnTimerRef.current = null; }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();  // triggers onstop → upload
      }
    };


    // ── Start streaming recorder (WebSocket approach) ─────────────────────────
    const startStreamingRecorder = () => {
      if (!process.env.NEXT_PUBLIC_STREAMING_VOICE || process.env.NEXT_PUBLIC_STREAMING_VOICE !== "true") {
        console.log("[VOICE_VAD_MODE] Falling back to non-streaming VAD.");
        console.log("[VOICE_START_COMPLETE]");
        setVoiceState("listening");
        return;
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        return;
      }
      
      const token = typeof window !== 'undefined' ? localStorage.getItem("zenaipex_token") || "" : "";
      // Initialize WebSocket for streaming
      console.log(`[VOICE_DEBUG] before_websocket`);
      logVoiceFlow("before_websocket");
      console.log("[VOICE_START_STEP] step=websocket");
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/api/v1/companies/${companyId}/agents/${agent.id}/voice-stream`;
      
      logVoiceFlow("websocket_connect");
      console.log(`[VOICE_STREAM_CONNECT] Connecting to ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log(`[VOICE_DEBUG] websocket_open`);
        const currentId = convIdRef.current;
        console.log(`[VOICE_TRACE][id=${traceId}][WS] websocket_connected url=${wsUrl}`);
        logVoiceFlow("websocket_open");
        console.log("[VOICE_WS_OPEN]");
        logVoiceFlow("voice_start_complete");
        console.log("[VOICE_START_COMPLETE]");
        streamingFailedRef.current = false;
        
        // Send config message
        ws.send(JSON.stringify({
          token,
          conversation_id: currentId,
          language: agent.default_language || "en-IN"
        }));
        
        // Set listening state, but only if welcome TTS is not currently playing
        const isWelcomePlaying = audioPlayerRef.current && !audioPlayerRef.current.paused && !audioPlayerRef.current.ended;
        if (voiceActiveRef.current && !isWelcomePlaying) {
           console.log(`[VOICE_DEBUG] listening_state`);
           setVoiceState("listening");
        }
        
        // FIX 1: Heartbeat
        lastPongTimeRef.current = Date.now();
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => {
           if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
               if (Date.now() - lastPongTimeRef.current > 10000) {
                   console.error("[VOICE_WS_HEARTBEAT_TIMEOUT] 10s without pong. Marking unhealthy.");
                   console.log("[VOICE_WS_UNHEALTHY] Closing stale WS to trigger recovery");
                   wsRef.current.close();
                   return;
               }
               console.log("[VOICE_WS_HEARTBEAT] ping");
               wsRef.current.send(JSON.stringify({ type: "ping" }));
           }
        }, 5000);
        
        // Start script processor to send 16kHz PCM
        const ctx = audioContextRef.current;
        if (!ctx) return;
        
        // FIX 4: AudioContext Watcher
        ctx.onstatechange = () => {
            console.log(`[VOICE_AUDIO_CONTEXT_STATE] state=${ctx.state}`);
            if (ctx.state === "suspended" && voiceActiveRef.current) {
                console.log("[VOICE_AUDIO_CONTEXT_RECOVER] Attempting to resume...");
                ctx.resume().then(() => {
                    console.log("[VOICE_AUDIO_CONTEXT_RECOVER_SUCCESS]");
                }).catch(e => {
                    console.log("[VOICE_AUDIO_CONTEXT_RECOVER_FAILED]", e);
                });
            }
        };
        
        const inputSampleRate = ctx.sampleRate;
        const targetSampleRate = 16000;
        const downsampleRatio = inputSampleRate / targetSampleRate;
        
        console.log(`[VOICE_AUDIO_FORMAT] input_sample_rate=${inputSampleRate} target_sample_rate=${targetSampleRate} input_frames=2048`);

        const processor = ctx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        
        // Output buffer size is roughly input / downsampleRatio
        const outBufferSize = Math.ceil(2048 / downsampleRatio) + 1;
        const sharedInt16 = new Int16Array(outBufferSize);
        
        let pcmSendCount = 0;
        let pcmLastLogTime = 0;
        let totalPcmBytesSent = 0;
        const streamingStartTime = Date.now();
        let filterIndex = 0;

        processor.onaudioprocess = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          if (isProcessingRef.current || !voiceActiveRef.current) return;
          
          const float32 = e.inputBuffer.getChannelData(0);
          
          let outIdx = 0;
          let sumSquares = 0;
          let nonZero = 0;
          
          while (filterIndex < float32.length) {
              const intIdx = Math.floor(filterIndex);
              const frac = filterIndex - intIdx;
              const val1 = float32[intIdx];
              const val2 = intIdx + 1 < float32.length ? float32[intIdx + 1] : val1;
              
              const interp = val1 + (val2 - val1) * frac;
              const val = Math.max(-32768, Math.min(32767, interp * 32768));
              
              sharedInt16[outIdx++] = val;
              sumSquares += val * val;
              if (val !== 0) nonZero++;
              
              filterIndex += downsampleRatio;
          }
          
          filterIndex -= float32.length;
          
          const outBuffer = sharedInt16.buffer.slice(0, outIdx * 2);
          wsRef.current.send(outBuffer);
          totalPcmBytesSent += outBuffer.byteLength;
          if (pcmSendCount % 20 === 0) logVoiceFlow("audio_chunk_sent");
          
          const now = Date.now();
          if (pcmSendCount < 3 || now - pcmLastLogTime > 2000) {
             const rms = outIdx > 0 ? Math.sqrt(sumSquares / outIdx) : 0;
             const elapsedSec = (now - streamingStartTime) / 1000;
             const bytesPerSec = elapsedSec > 0 ? Math.round(totalPcmBytesSent / elapsedSec) : 0;
             
             console.log(`[VOICE_AUDIO_PROCESS] frames=${float32.length} output_samples=${outIdx} nonzero_samples=${nonZero} rms=${rms.toFixed(2)}`);
             console.log(`[VOICE_PCM_SEND] bytes=${outBuffer.byteLength} session=${currentSessionId}`);
             console.log(`[VOICE_PCM_RATE] bytes_per_sec=${bytesPerSec} sample_rate=${targetSampleRate}`);
             
             pcmSendCount++;
             pcmLastLogTime = now;
          }
        };
        
        if (analyserRef.current) {
          analyserRef.current.connect(processor);
          processor.connect(ctx.destination);
        }
      };
      
      ws.onmessage = (e) => {
        try {
          if (voiceSessionIdRef.current !== currentSessionId) return;
          const msg = JSON.parse(e.data);
          
          if (msg.type === "pong") {
            lastPongTimeRef.current = Date.now();
            return;
          }
          if (msg.type === "state") {
            if (msg.state === "listening") {
              console.log(`[VOICE_TRACE][id=${traceId}][WS] state=listening`);
              isProcessingRef.current = false;
              setVoiceState("listening");
            } else if (msg.state === "thinking") {
              console.log(`[VOICE_TRACE][id=${traceId}][WS] state=thinking`);
              isProcessingRef.current = true;
              setVoiceState("thinking");
              console.log("[VOICE_STREAM_AI_START] AI started generating");
            } else if (msg.state === "speaking") {
              console.log(`[VOICE_TRACE][id=${traceId}][WS] state=speaking`);
              setVoiceState("speaking");
              pcmAllChunksReceivedRef.current = false;
              pcmNextStartTimeRef.current = 0;
              console.log("[VOICE_STREAM_TTS_START] TTS audio received");
            } else if (msg.state === "error") {
              setVoiceError(msg.message || "Streaming error");
              setVoiceState("error");
            }
          } 
          else if (msg.type === "transcript") {
            setLiveTranscript(msg.text);
            if (msg.is_final) {
               logVoiceFlow("stt_final");
               console.log(`[VOICE_STREAM_FINAL] ${msg.text}`);
            } else {
               console.log(`[VOICE_STREAM_PARTIAL] ${msg.text}`);
            }
          }
          else if (msg.type === "ai_text") {
            if (msg.conversation_id && msg.conversation_id !== convIdRef.current) {
              convIdRef.current = msg.conversation_id;
              onConvIdChange(msg.conversation_id);
              router.replace(`/dashboard/my-ai/chat?id=${msg.conversation_id}`);
            }
            onMessagesUpdate(liveTranscript, msg.text);
          }
          else if (msg.type === "ai_audio_pcm") {
            const byteCharacters = atob(msg.audio_base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const int16Array = new Int16Array(byteArray.buffer);
            const float32Array = new Float32Array(int16Array.length);
            for(let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
            }
            
            if (!pcmAudioContextRef.current) {
                pcmAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = pcmAudioContextRef.current;
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            
            if (voiceSessionIdRef.current !== currentSessionId) {
                console.log(`[VOICE_STALE_PCM_IGNORED] old_session_id=${currentSessionId} current=${voiceSessionIdRef.current}`);
                return;
            }
            if (pcmActiveSourcesRef.current.length > 200) {
                console.warn("[VOICE_PCM_BACKPRESSURE] Queue exceeds 200 chunks. Dropping chunk.");
                return;
            }

            const audioBuffer = ctx.createBuffer(1, float32Array.length, 24000);
            audioBuffer.getChannelData(0).set(float32Array);
            
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            
            if (pcmNextStartTimeRef.current < ctx.currentTime) {
                pcmNextStartTimeRef.current = ctx.currentTime + 0.1; // 100ms anti-jitter buffer
            }
            
            source.start(pcmNextStartTimeRef.current);
            pcmNextStartTimeRef.current += audioBuffer.duration;
            pcmActiveSourcesRef.current.push(source);
            
            source.onended = () => {
                const idx = pcmActiveSourcesRef.current.indexOf(source);
                if (idx > -1) pcmActiveSourcesRef.current.splice(idx, 1);
                
                if (pcmAllChunksReceivedRef.current && pcmActiveSourcesRef.current.length === 0 && voiceActiveRef.current) {
                     isProcessingRef.current = false;
                     setVoiceState(prev => prev === "speaking" ? "listening" : prev);
                }
            };
          }
          else if (msg.type === "ai_audio_pcm_done") {
             pcmAllChunksReceivedRef.current = true;
             if (pcmActiveSourcesRef.current.length === 0 && voiceActiveRef.current) {
                 isProcessingRef.current = false;
                 setVoiceState(prev => prev === "speaking" ? "listening" : prev);
             }
          }
          else if (msg.type === "ai_audio") {
            const byteCharacters = atob(msg.audio_base64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/mpeg' });
            
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audioPlayerRef.current = audio;
            playbackGenerationRef.current += 1;
            
            audio.play().catch(err => console.error("Playback failed:", err));
            audio.onended = () => {
              isProcessingRef.current = false;
              if (voiceActiveRef.current) setVoiceState("listening");
            };
          }
        } catch (err) {
          console.error("WS message parse error:", err);
        }
      };
      
      ws.onerror = (e) => {
        console.error("[VOICE_STREAM_ERROR] WebSocket error", e);
        console.log("[VOICE_STREAM_FALLBACK] Reverting to HTTP POST flow");
        streamingFailedRef.current = true;
        if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
        }
        startAlwaysOnRecorder();
      };
      
      ws.onclose = () => {
        if (heartbeatTimerRef.current) { clearInterval(heartbeatTimerRef.current); heartbeatTimerRef.current = null; }
        if (processorRef.current) {
          processorRef.current.disconnect();
          processorRef.current = null;
        }
      };
    };

    // ── Start always-on recorder (pre-roll approach) ──────────────────────────
    // We start recording immediately after calibration so that the first
    // syllable is never missed. We only *submit* when real speech was detected.
    const startAlwaysOnRecorder = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch (_) {}
      }
      
      const sessionChunks: BlobPart[] = [];
      
      hasSent = false;
      isSpeechActive = false;
      speechStart = null;
      speechEnd = null;
      silenceStart = null;

      console.log(`[VOICE_RECORDER_START]
session_id=${currentSessionId}
recorder_state=starting`);

      const recorder = new MediaRecorder(localStream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          sessionChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (!voiceActiveRef.current || voiceSessionIdRef.current !== currentSessionId) return;
        if (hasSent) return;
        hasSent = true;

        const totalDurationMs = speechStart ? Date.now() - speechStart : 0;
        const speechDurationMs = speechStart && speechEnd ? speechEnd - speechStart : totalDurationMs;

        const recorderStartTime = calibrationStartTime + VAD_CALIBRATION_MS; // approximate start time
        const speechStartOffsetMs = speechStart ? Math.max(0, speechStart - recorderStartTime) : 0;
        const speechEndOffsetMs = speechEnd ? Math.max(0, speechEnd - recorderStartTime) : Math.max(0, Date.now() - recorderStartTime);

        if (speechStartOffsetMs == null || speechEndOffsetMs == null || speechEndOffsetMs < speechStartOffsetMs) {
          console.error(`[VOICE_VAD_INVALID_TIMING] speech_start_ms=${speechStartOffsetMs} speech_end_ms=${speechEndOffsetMs} session_id=${currentSessionId}`);
          isProcessingRef.current = false;
          if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
          return;
        }

        if (!isSpeechActive && speechStart === null) {
          // Recorder stopped before any speech was ever detected (no-speech guard)
          console.log("[VOICE_UTTERANCE_IGNORED] Recorder stopped with no speech onset.");
          isProcessingRef.current = false;
          if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
          return;
        }

        if (sessionChunks.length === 0) {
          console.log("[VOICE_UTTERANCE_IGNORED] No audio chunks captured.");
          if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
          return;
        }

        const audioBlob = new Blob(sessionChunks, { type: mimeType || "audio/webm" });

        // Freeze array and clear it (though it's scoped, this is explicit)
        sessionChunks.length = 0;

        // Reject near-empty blobs (pure silence / microphone noise)
        if (audioBlob.size < VAD_MIN_BLOB_BYTES) {
          console.log(`[VOICE_UTTERANCE_IGNORED] Blob too small (${audioBlob.size} bytes < ${VAD_MIN_BLOB_BYTES}). Likely silence.`);
          isProcessingRef.current = false;
          if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
          return;
        }

        const speechRatio = totalDurationMs > 0 ? speechDurationMs / totalDurationMs : 0;
        
        if (totalDurationMs < 2000 && speechRatio < 0.15 && speechDurationMs < 400) {
          console.log(`[VOICE_CAPTURE_REJECT]\nsession_id=${currentSessionId}\nduration_ms=${totalDurationMs}\nspeech_ratio=${(speechRatio*100).toFixed(2)}%\nreason=low_speech_ratio`);
          isProcessingRef.current = false;
          if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
          return;
        }

        console.log(`[VOICE_RECORDER_STOP]\nsession_id=${currentSessionId}\nduration_ms=${totalDurationMs}`);

        console.log(
          `[VOICE_UPLOAD_DIAGNOSTIC] ` +
          `blob_size=${audioBlob.size} blob_type=${audioBlob.type} ` +
          `speech_start_ms=${speechStartOffsetMs} speech_end_ms=${speechEndOffsetMs} ` +
          `end_reason=${currentEndReason}`
        );

        console.log(
          `[VOICE_UTTERANCE_FINAL] id=${currentSessionId}-${Date.now()} ` +
          `blob_bytes=${audioBlob.size} ` +
          `total_duration_ms=${totalDurationMs} speech_duration_ms=${speechDurationMs} ` +
          `speech_start_ms=${speechStartOffsetMs} speech_end_ms=${speechEndOffsetMs} ` +
          `end_reason=${currentEndReason}`
        );

        isProcessingRef.current = true;
        setVoiceState("thinking");

        let currentConvId = convIdRef.current;
        if (!currentConvId || currentConvId === "tmp") {
          try {
            const convRes = await agentsApi.createConversation(companyId, agent.id);
            if (convRes && convRes.conversation_id) {
              currentConvId = convRes.conversation_id;
              convIdRef.current = currentConvId;
              onConvIdChange(currentConvId);
            }
          } catch (e) {
            console.error("[VOICE_INIT_ERR]", e);
          }
        }

        const historyPayload = messagesRef.current.map(m => ({ role: m.role, content: m.content || m.text || "" }));

        try {
          console.log(`[VOICE_UPLOAD_START] session_id=${currentSessionId} blob_bytes=${audioBlob.size}`);
          const res = await agentsApi.testVoiceChat(
            companyId,
            agent.id,
            audioBlob,
            historyPayload,
            currentConvId || undefined,
            speechStartOffsetMs,
            speechEndOffsetMs,
            partialTranscriptRef.current || undefined
          );

          // We already have the conversation_id, but just in case it's newly returned:
          if (res.conversation_id && res.conversation_id !== "tmp" && !convIdRef.current) {
            convIdRef.current = res.conversation_id;
            onConvIdChange(res.conversation_id);
            router.replace(`/dashboard/my-ai/chat?id=${res.conversation_id}`);
          }

          if (res.no_speech) {
            console.log("[VOICE_STT_EMPTY] No speech detected, silently returning to listening");
            isProcessingRef.current = false;
            setLiveTranscript("");
            // If we were waiting for a continuation and got silence, flush the partial
            if (partialTranscriptRef.current) {
              const saved = partialTranscriptRef.current;
              partialTranscriptRef.current = "";
              if (continuationTimerRef.current) { clearTimeout(continuationTimerRef.current); continuationTimerRef.current = null; }
              console.log(`[VOICE_PARTIAL_FLUSH] Flushing partial on no_speech: "${saved}"`);
            }
            if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
            return;
          }

          const transcript = (res.transcript || "").trim();
          const answer    = (res.answer    || "").trim();

          if (res.is_incomplete) {
            partialTranscriptRef.current = transcript;
            console.log(`[VOICE_PARTIAL_HOLD] Partial transcript held by backend: "${transcript}". Waiting 2500ms for continuation.`);

            // Clear any existing timer
            if (continuationTimerRef.current) clearTimeout(continuationTimerRef.current);

            isProcessingRef.current = false;
            // Return to listening immediately (VAD will fire again)
            if (voiceActiveRef.current) setTimeout(() => startListening(), 80);

            // Start continuation timeout — if no more speech arrives, discard it
            continuationTimerRef.current = setTimeout(() => {
              const flushed = partialTranscriptRef.current;
              partialTranscriptRef.current = "";
              continuationTimerRef.current = null;
              if (!flushed || !voiceActiveRef.current || isProcessingRef.current) return;
              console.log(`[VOICE_PARTIAL_TIMEOUT] 2500ms elapsed with no continuation. Discarding partial: "${flushed}"`);
              
              isProcessingRef.current = false;
              setLiveTranscript("");
              if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
            }, 2500);
            return;
          }

          // If backend processed successfully, it already merged any pending transcript.
          const finalTranscript = transcript;
          if (partialTranscriptRef.current) {
            partialTranscriptRef.current = "";
            if (continuationTimerRef.current) { clearTimeout(continuationTimerRef.current); continuationTimerRef.current = null; }
          }

          console.log(`[CHAT_RESPONSE] transcript: "${finalTranscript}" | answer length: ${answer.length} | convId: ${res.conversation_id}`);

          if (res.conversation_id && !currentConvId) {
            convIdRef.current = res.conversation_id;
            onConvIdChange(res.conversation_id);
            router.replace(`/dashboard/my-ai/chat?id=${res.conversation_id}`);
          }

          if (finalTranscript) setLiveTranscript(finalTranscript);
          onMessagesUpdate(finalTranscript, answer, res.sources);

          // ── Playback ────────────────────────────────────────────────────────
          if (res.audio_base64 && answer) {
            setVoiceState("speaking");
            console.log("[VOICE_AUDIO_RECEIVED] Starting decode");

            try {
              const byteString = atob(res.audio_base64);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
              const blob = new Blob([ab], { type: "audio/mpeg" });
              console.log(`[VOICE_AUDIO_DECODED] bytes=${blob.size} MIME=audio/mpeg`);

              const currentPlaybackId = ++playbackGenerationRef.current;

              if (audioPlayerRef.current) {
                audioPlayerRef.current.pause();
                if (audioPlayerRef.current.src.startsWith('blob:')) URL.revokeObjectURL(audioPlayerRef.current.src);
              }

              const audioUrl = URL.createObjectURL(blob);
              const audio = new Audio();
              audio.preload = "auto";
              audioPlayerRef.current = audio;

              audio.onloadedmetadata = () => console.log(`[VOICE_AUDIO_READY] playbackId=${currentPlaybackId}`);
              audio.onplay    = () => console.log(`[VOICE_AUDIO_PLAY_START] playbackId=${currentPlaybackId}`);
              audio.onplaying = () => console.log(`[VOICE_AUDIO_PLAY_SUCCESS] playbackId=${currentPlaybackId}`);
              audio.onended = () => {
                if (voiceSessionIdRef.current !== currentSessionId) return;
                if (playbackGenerationRef.current !== currentPlaybackId) return;
                console.log(`[VOICE_AUDIO_ENDED] playbackId=${currentPlaybackId} Returning to Listening`);
                URL.revokeObjectURL(audioUrl);
                audioPlayerRef.current = null;
                isProcessingRef.current = false;
                setLiveTranscript("");
                if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
              };
              audio.onerror = (e) => {
                if (voiceSessionIdRef.current !== currentSessionId) return;
                if (playbackGenerationRef.current !== currentPlaybackId) return;
                console.log(`[VOICE_AUDIO_ERROR] playbackId=${currentPlaybackId}`, e);
                URL.revokeObjectURL(audioUrl);
                audioPlayerRef.current = null;
                isProcessingRef.current = false;
                setLiveTranscript("");
                setVoiceError("Audio playback failed.");
                if (voiceActiveRef.current) setTimeout(() => startListening(), 500);
              };

              audio.src = audioUrl;
              console.log(`[VOICE_AUDIO_PLAY_CALL] playbackId=${currentPlaybackId}`);
              suspendMic();
              await audio.play().then(() => {
                console.log(`[VOICE_AUDIO_PLAY_RESOLVED] playbackId=${currentPlaybackId}`);
              }).catch((err) => {
                if (voiceSessionIdRef.current !== currentSessionId) return;
                if (playbackGenerationRef.current !== currentPlaybackId) return;
                console.error(`[VOICE_AUDIO_ERROR] playbackId=${currentPlaybackId} Autoplay rejected:`, err);
                URL.revokeObjectURL(audioUrl);
                audioPlayerRef.current = null;
                isProcessingRef.current = false;
                setLiveTranscript("");
                setVoiceError("Audio playback blocked by browser.");
                if (voiceActiveRef.current) setTimeout(() => startListening(), 500);
              });
            } catch (decodeErr) {
              console.error("[VOICE_AUDIO_ERROR] Decode failed:", decodeErr);
              isProcessingRef.current = false;
              setLiveTranscript("");
              if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
            }
          } else {
            isProcessingRef.current = false;
            setLiveTranscript("");
            if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
          }
        } catch (err: any) {
          console.error(`[VOICE_UPLOAD_ERROR] status=${err.status || 'unknown'}`, err);
          isProcessingRef.current = false;
          setLiveTranscript("");

          if (err.status === 504) {
            console.log("[VOICE_STT_TIMEOUT_IGNORED] Backend STT timeout. Silently returning to listening.");
            if (voiceActiveRef.current) setTimeout(() => startListening(), 100);
            return;
          }

          if (voiceActiveRef.current) {
            setVoiceError("Voice input couldn't be processed. Please try again.");
            setVoiceState("error");
            setTimeout(() => {
              if (voiceActiveRef.current) { setVoiceError(""); startListening(); }
            }, 3000);
          }
        }
      };

      // Start with 50ms timeslice so chunks arrive frequently (pre-roll effect)
      recorder.start(50);
      console.log("[VOICE_RECORDER_STARTED] Always-on pre-roll recorder running.");
    };

    // ── VAD poll interval ─────────────────────────────────────────────────────
    console.log("[VOICE_VAD_SESSION_RESET] Starting fresh VAD calibration");
    vadIntervalRef.current = setInterval(() => {
      if (!voiceActiveRef.current || isProcessingRef.current || voiceSessionIdRef.current !== currentSessionId) {
        if (vadIntervalRef.current) clearInterval(vadIntervalRef.current);
        return;
      }

      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = Date.now();

      // ── Phase 1: Calibration ─────────────────────────────────────────────────
      if (isCalibrating) {
        calibrationSamples.push(rms);
        if (now - calibrationStartTime >= VAD_CALIBRATION_MS) {
          isCalibrating = false;

          // Use 80th-percentile of samples as baseline (robust against brief noises)
          const sorted = [...calibrationSamples].sort((a, b) => a - b);
          const p80idx = Math.floor(sorted.length * 0.80);
          baselineRMS = sorted[p80idx] || 0.008;
          baselineRMS = Math.max(baselineRMS, 0.004); // floor — never below 4 RMS units

          onsetThreshold    = baselineRMS * VAD_ONSET_BOOST;
          continueThreshold = baselineRMS * VAD_CONTINUE_BOOST;

          // Clamp to reasonable absolute bounds
          onsetThreshold    = Math.max(0.020, Math.min(onsetThreshold, 0.15));
          continueThreshold = Math.max(0.010, Math.min(continueThreshold, 0.08));

          console.log(
            `[VOICE_VAD_BASELINE_READY] samples=${calibrationSamples.length} ` +
            `baseline=${baselineRMS.toFixed(4)} ` +
            `onset=${onsetThreshold.toFixed(4)} ` +
            `continue=${continueThreshold.toFixed(4)}`
          );
          
          startupGuardEnd = now + 600; // 600ms safe guard

          // Start always-on recorder now that thresholds are set
          if (!streamingFailedRef.current) {
            startStreamingRecorder();
          } else {
            startAlwaysOnRecorder();
          }

          // Hard cap timer
          maxTurnTimerRef.current = setTimeout(() => {
            if (!isSpeechActive) return; // don't cut if no speech started yet
            console.log("[VOICE_SPEECH_END] Max record time reached.");
            stopAndSubmit("max_time");
          }, VAD_MAX_RECORD_MS);
        }
        return;
      }

      // ── Phase 2: Speech Detection ────────────────────────────────────────────
      const currentThreshold = isSpeechActive ? continueThreshold : onsetThreshold;

      if (rms > currentThreshold) {
        if (!isSpeechActive && now < startupGuardEnd) {
           console.log(`[VOICE_BARGE_IN_SUPPRESSED] reason=startup`);
           return;
        }

        // Energy above threshold → speech (or continuation)
        silenceStart = null;

        if (!isSpeechActive) {
          isSpeechActive = true;
          speechStart = now;
          speechEnd   = null;
          setVoiceState("speaking" as VoiceState);
          console.log(`[VOICE_SPEECH_ONSET] rms=${rms.toFixed(4)} onset=${onsetThreshold.toFixed(4)}`);
          
          // Barge-in handling
          const isAiPlayingAudio = audioPlayerRef.current && !audioPlayerRef.current.paused && audioPlayerRef.current.src;
          const isPcmPlaying = pcmActiveSourcesRef.current.length > 0;
          const isAiSpeaking = isAiPlayingAudio || isPcmPlaying;
          
          if (!isAiSpeaking) {
             console.log(`[VOICE_BARGE_IN_SUPPRESSED] reason=no_ai_playback`);
          } else if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "barge_in" }));
            console.log(`[VOICE_BARGE_IN_LOCAL] reason=speech_onset rms=${rms.toFixed(4)} state=speaking`);
          }
          if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = "";
            console.log("[VOICE_BARGE_IN_LOCAL] Stopped local TTS playback");
          }
          
          // Stop PCM streaming queue
          if (pcmActiveSourcesRef.current.length > 0) {
            console.log(`[VOICE_PCM_PAUSE] Stopping ${pcmActiveSourcesRef.current.length} queued chunks reason=BARGE_IN_LOCAL`);
            pcmActiveSourcesRef.current.forEach(s => {
                try { s.stop(); s.disconnect(); } catch(e) {}
            });
            pcmActiveSourcesRef.current = [];
            pcmNextStartTimeRef.current = 0;
          }
          
          // Reset processing state so microphone audio is sent to the backend
          if (isProcessingRef.current) {
            isProcessingRef.current = false;
            console.log("[VOICE_BARGE_IN_LOCAL] Reset isProcessingRef to false");
          }
        }
      } else {
        // Energy below threshold → silence
        if (isSpeechActive) {
          if (silenceStart === null) {
            silenceStart = now;
            speechEnd    = now; // tentative speech end
          }

          const speechDuration = speechStart ? speechEnd! - speechStart : 0;
          const holdMs = speechDuration < 600 ? VAD_SHORT_SILENCE_MS : VAD_SILENCE_HOLD_MS;
          const silenceElapsed = now - silenceStart;

          if (silenceElapsed >= holdMs) {
            // Enough silence: end utterance and submit
            const totalBlobMs = speechStart ? now - speechStart + 150 : 0; // +150ms trailing buffer
            console.log(
              `[VOICE_SPEECH_END] silence=${silenceElapsed}ms hold=${holdMs}ms ` +
              `speech_duration=${speechDuration}ms total_captured=${totalBlobMs}ms`
            );
            console.log(`[VOICE_VAD_END]\nsession_id=${currentSessionId}\nreason=silence\nduration_ms=${totalBlobMs}`);
            stopAndSubmit("silence");
          }
        }
        // If no speech yet, stay in calibrated listening — no reset needed
      }
    }, 50);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, companyId, onConvIdChange, onMessagesUpdate, router]);

  // ── Start on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;
    voiceActiveRef.current = true;
    const currentToken = ++sessionTokenRef.current;
    console.log(`[VOICE_MODE_OPEN] Voice session starting, convId: ${convIdRef.current}, token: ${currentToken}`);
    
    const initVoiceSession = async () => {
      let currentId = convIdRef.current;
      console.log("[VOICE_FLOW] start");
      console.log(`[VOICE_START_STEP] step=initVoiceSession currentId=${currentId} token=${currentToken}`);
      
      if (!currentId || currentId === "tmp") {
        try {
          if (!convPromiseRef.current) {
              convPromiseRef.current = agentsApi.createConversation(companyId, agent.id);
          }
          const convRes = await convPromiseRef.current;
          
          if (currentToken !== sessionTokenRef.current) {
            console.log("[VOICE_START_CANCELLED] step=conversation_create message=Stale StrictMode mount aborted");
            return;
          }
          
          if (convRes && convRes.conversation_id) {
            currentId = convRes.conversation_id;
            console.log("[VOICE_FLOW] conversation_ready");
            console.log(`[VOICE_CONVERSATION_READY] conversation_id=${currentId}`);
            convIdRef.current = currentId;
            onConvIdChange(currentId as string);
          }
        } catch (e: any) {
          console.error("[VOICE_START_ERROR] step=conversation_create message=", e?.message || String(e));
        }
      } else {
          console.log("[VOICE_FLOW] conversation_ready");
          console.log(`[VOICE_CONVERSATION_READY] conversation_id=${currentId}`);
      }
      
      if (currentToken !== sessionTokenRef.current) {
         console.log("[VOICE_START_CANCELLED] step=welcome_tts message=Stale StrictMode mount aborted");
         return;
      }
      
      console.log(`[VOICE_START_STEP] step=check_is_mounted isMounted=${isMounted}`);
      if (isMounted) {
        console.log("[VOICE_START_STEP] step=start_listening_concurrent");
        startListening();
        
        console.log("[VOICE_START_STEP] step=welcome_tts");
        playWelcomeGreeting(currentToken);
      } else {
        console.error("[VOICE_START_ERROR] step=welcome_tts message=Component unmounted before welcome TTS");
      }
    };
    
    initVoiceSession();

    return () => {
      isMounted = false;
      releaseAll();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Barge-in: tap orb during Speaking ────────────────────────────────────
  function handleBargeIn() {
    if (voiceState !== "speaking") return;
    if (audioPlayerRef.current) {
      console.log(`[VOICE_AUDIO_PAUSE] playbackId=${playbackGenerationRef.current} reason=BARGE_IN`);
      audioPlayerRef.current.pause();
      if (audioPlayerRef.current.src.startsWith('blob:')) {
         URL.revokeObjectURL(audioPlayerRef.current.src);
      }
      audioPlayerRef.current = null;
    }
    
    // Stop PCM streaming queue
    if (pcmActiveSourcesRef.current.length > 0) {
      console.log(`[VOICE_PCM_PAUSE] Stopping ${pcmActiveSourcesRef.current.length} queued chunks reason=BARGE_IN`);
      pcmActiveSourcesRef.current.forEach(s => {
          try { s.stop(); s.disconnect(); } catch(e) {}
      });
      pcmActiveSourcesRef.current = [];
      pcmNextStartTimeRef.current = 0;
    }
    isProcessingRef.current = false;
    setLiveTranscript("");
    if (voiceActiveRef.current) {
      setVoiceState("listening");
      setTimeout(() => startListening(), 200);
    }
  }

  // ── State labels ──────────────────────────────────────────────────────────
  const stateLabel: Record<VoiceState, string> = {
    idle: "Ready",
    connecting: "Connecting…",
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    error: voiceError || "Error",
    ended: "Ended",
  };

  const voiceLabel = getVoiceLabel(agent.tts_voice);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="shrink-0 z-20"
      style={{
        background: "linear-gradient(to top, #F5F3EF 0%, #FAF8F5 100%)",
        borderTop: "1px solid #D1DFD9",
        boxShadow: "0 -4px 28px rgba(0,0,0,0.05)",
      }}
      role="region"
      aria-label="Voice chat mode"
    >
      <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-3">
        {/* ── Top row: agent identity + voice badge + close ──────────────── */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Mic icon indicating voice mode */}
            <div className="h-6 w-6 rounded-full bg-[#3E5448] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="white" strokeLinecap="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-[#1C2421]">Voice Mode</span>
            <span className="text-[11px] text-[#8EA89F]">·</span>
            <span className="text-[11px] text-[#68706C] font-medium">
              {canonicalizeCustomerFacingName(agent.name)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Voice badge */}
            <div className="flex items-center gap-1 bg-white border border-[#E3E3DF] rounded-full px-2.5 py-1">
              <Volume2 className="h-3 w-3 text-[#5F786D]" />
              <span className="text-[10px] font-semibold text-[#3E5448]">{voiceLabel}</span>
            </div>
          </div>
        </div>

        {/* ── Center area: orb + status ───────────────────────────────────── */}
        <div className="flex items-center gap-5 py-1">
          {/* Orb — tappable for barge-in */}
          <button
            onClick={handleBargeIn}
            disabled={voiceState !== "speaking"}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F786D] rounded-full flex-shrink-0"
            aria-label={voiceState === "speaking" ? "Tap to interrupt AI" : "Voice orb"}
          >
            <CompactOrb state={voiceState} />
          </button>

          {/* Status + transcript */}
          <div className="flex-1 min-w-0">
            {/* State label */}
            <p
              className={`text-[15px] font-semibold leading-none mb-1 transition-colors duration-200 ${
                voiceState === "listening"
                  ? "text-[#3E5448]"
                  : voiceState === "speaking"
                  ? "text-[#3E5448]"
                  : voiceState === "error"
                  ? "text-red-600"
                  : "text-[#68706C]"
              }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {stateLabel[voiceState]}
            </p>

            {/* Listening tip */}
            {voiceState === "listening" && !liveTranscript && (
              <p className="text-[11px] text-[#A0A8A4] leading-none">
                Speak naturally — pause to send
              </p>
            )}

            {/* Speaking barge-in tip */}
            {voiceState === "speaking" && (
              <p className="text-[11px] text-[#A0A8A4] leading-none">
                Tap orb to interrupt
              </p>
            )}

            {/* Live transcript preview */}
            {liveTranscript && (
              <p className="text-[12px] text-[#5F786D] font-medium truncate leading-tight mt-0.5">
                &ldquo;{liveTranscript}&rdquo;
              </p>
            )}

            {/* Error message */}
            {voiceState === "error" && voiceError && (
              <p className="text-[11px] text-red-500 leading-tight mt-0.5 line-clamp-2">
                {voiceError}
              </p>
            )}
          </div>

          {/* ── Controls ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-shrink-0">

            {/* Mute */}
            <button
              onClick={() => setIsMuted((m) => !m)}
              className={`h-9 w-9 flex items-center justify-center rounded-full border transition-colors ${
                isMuted
                  ? "bg-red-50 border-red-200 text-red-500"
                  : "bg-white border-[#E3E3DF] text-[#68706C] hover:border-[#B2C7BF] hover:text-[#3E5448]"
              }`}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={isMuted}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>

            {/* End Voice Chat */}
            <button
              onClick={endSession}
              className="h-9 flex items-center gap-1.5 px-3 rounded-full bg-[#3E5448] hover:bg-[#2A3D34] text-white text-[12px] font-semibold transition-colors shadow-sm"
              aria-label="End voice chat session"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">End Voice Chat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// keep old export name so old imports don't break immediately
export { VoiceModeDock as VoiceModeOverlay };
