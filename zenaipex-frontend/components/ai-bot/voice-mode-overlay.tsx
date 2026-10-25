"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MicOff, PhoneOff, Volume2, VolumeX, Download, Play, Pause } from "lucide-react";

import { agentsApi, Agent } from "@/lib/api/agents";
import { VOICES, getVoiceAcoustics, findBrowserVoice, isMaleVoice } from "@/lib/data/voices";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api/client";

import { canonicalizeCustomerFacingName } from "@/lib/utils";

// --- Types ---
export type VoiceState =
  | "idle"
  | "starting"
  | "connecting"
  | "listening"
  | "processing"
  | "thinking"
  | "speaking"
  | "error"
  | "ended";

// --- Compact Orb ---
function CompactOrb({ state }: { state: VoiceState }) {
  const innerColor =
    state === "error" ? "#b45252"
      : state === "speaking" ? "#3E5448"
        : state === "listening" ? "#5F786D"
          : state === "processing" ? "#7A9184"
            : "#8EA89F";

  const glowColor =
    state === "error" ? "rgba(185,80,80,0.30)"
      : state === "speaking" ? "rgba(62,84,72,0.35)"
        : state === "listening" ? "rgba(95,120,109,0.40)"
          : "rgba(95,120,109,0.15)";

  const orbAnimClass =
    state === "listening" ? "animate-orb-breathe"
      : state === "processing" ? "animate-orb-think"
        : state === "error" ? "animate-orb-error"
          : state === "speaking" ? ""
            : "animate-orb-idle";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
      {state === "speaking" && (
        <>
          <div className="absolute inset-0 rounded-full animate-orb-ripple pointer-events-none" style={{ border: `2px solid rgba(62,84,72,0.38)` }} />
          <div className="absolute inset-0 rounded-full animate-orb-ripple-inner pointer-events-none" style={{ border: `1.5px solid rgba(62,84,72,0.20)` }} />
        </>
      )}
      {state === "listening" && (
        <div className="absolute inset-0 rounded-full animate-orb-listen-halo pointer-events-none" style={{ background: `radial-gradient(circle, transparent 44%, rgba(95,120,109,0.16) 68%, transparent 100%)` }} />
      )}
      <div className="absolute rounded-full pointer-events-none" style={{ width: 64, height: 64, background: `radial-gradient(circle at 36% 32%, ${glowColor} 0%, transparent 70%)`, filter: "blur(8px)", transition: "all 0.5s ease" }} />
      <div className={`relative rounded-full flex items-center justify-center ${orbAnimClass}`} style={{ width: 52, height: 52, background: `radial-gradient(circle at 36% 32%, #8EA89F 0%, ${innerColor} 55%, #2A3D34 100%)`, boxShadow: `0 3px 20px ${glowColor}, 0 0 0 1px rgba(255,255,255,0.06) inset`, transition: "background 0.5s ease, box-shadow 0.5s ease" }}>
        <div className="absolute rounded-full pointer-events-none" style={{ width: 22, height: 22, top: 6, left: 7, background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)" }} />
        {state === "speaking" && (
          <div className="flex items-end justify-center gap-[2px] h-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`rounded-full bg-white/70 animate-wave-${i}`} style={{ width: 2, height: 5 }} />
            ))}
          </div>
        )}
        {state === "processing" && (
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-white/65 animate-bounce" style={{ animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
        )}
        {state === "error" && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth={3} stroke="rgba(255,255,255,0.85)" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        )}
        {(state === "idle" || state === "starting") && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="rgba(255,255,255,0.65)" strokeLinecap="round">
            <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </div>
    </div>
  );
}

// --- Helper: Natural Voice Selection (Male & Female) ---
function getBestHumanVoice(
  voices: SpeechSynthesisVoice[], 
  langCode: string, 
  text: string, 
  isMale: boolean = false,
  voiceId?: string
): SpeechSynthesisVoice | null {
  return findBrowserVoice(voices, isMale, langCode, text, voiceId);
}

// --- Props ---
interface Props {
  agent: Agent;
  companyId: string;
  activeConvId: string | null;
  onConvIdChange: (id: string) => void;
  onEnd: () => void;
  onMessagesUpdate: (userText: string, aiText: string, sources?: any[], isInterimUser?: boolean) => void;
  messages: any[];
}

export type VoiceLangMode = "hinglish" | "hindi" | "gujarati" | "english";

export function VoiceModeDock({
  agent,
  companyId,
  activeConvId,
  onConvIdChange,
  onEnd,
  onMessagesUpdate,
  messages,
}: Props) {
  const [voiceStateInternal, setVoiceStateInternal] = useState<VoiceState>("idle");
  const voiceStateRef = useRef<VoiceState>("idle");
  const setVoiceState = useCallback((newState: VoiceState) => {
    voiceStateRef.current = newState;
    setVoiceStateInternal(prev => {
      if (prev !== newState) {
        console.log(`[VOICE] State: ${prev.toUpperCase()} → ${newState.toUpperCase()}`);
      }
      return newState;
    });
  }, []);
  const voiceState = voiceStateInternal;

  const [langMode, setLangMode] = useState<VoiceLangMode>("hinglish");
  const langModeRef = useRef<VoiceLangMode>("hinglish");
  useEffect(() => { langModeRef.current = langMode; }, [langMode]);

  const [engineMode, setEngineMode] = useState<"pipeline" | "gemini_live" | "gemini_clone">(
    (agent as any).voice_engine === "gemini_live"
      ? "gemini_live"
      : (agent as any).voice_engine === "gemini_clone"
        ? "gemini_clone"
        : "pipeline"
  );
  const engineModeRef = useRef<"pipeline" | "gemini_live" | "gemini_clone">(
    (agent as any).voice_engine === "gemini_live"
      ? "gemini_live"
      : (agent as any).voice_engine === "gemini_clone"
        ? "gemini_clone"
        : "pipeline"
  );
  // Clone mode prefers the server's streaming transcriber so long speech is
  // handled continuously. It falls back to browser STT if the server reports
  // that its providers are unavailable.
  const serverSttActiveRef = useRef<boolean>((agent as any).voice_engine === "gemini_clone");
  const [nextEngine, setNextEngine] = useState<"pipeline" | "gemini_live" | "gemini_clone" | null>(null);
  // A published routing change applies to the next session. Keep the active
  // engine stable so its WebSocket audio protocol cannot change mid-call.
  useEffect(() => {
    const configured = (agent as any).voice_engine;
    if (configured !== "gemini_live" && configured !== "gemini_clone" && configured !== "pipeline") return;
    if (configured !== engineModeRef.current) {
      setNextEngine(configured);
    }
  }, [(agent as any).voice_engine]);

  const [errorMsg, setErrorMsg] = useState("");
  const [voiceNotice, setVoiceNotice] = useState("");
  const [audioNeedsGesture, setAudioNeedsGesture] = useState(false);
  const [outputVoice, setOutputVoice] = useState<"clone" | "browser" | "gemini">(
    (agent as any).voice_engine === "gemini_live" ? "gemini" : "clone"
  );
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isSpeakingUser, setIsSpeakingUser] = useState(false);
  const latestTranscriptRef = useRef<string>("");
  const [isMuted, setIsMuted] = useState(false);

  const sessionTokenRef = useRef<number>(0);
  const mountedRef = useRef<boolean>(true);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Session recording (captures user mic audio for playback)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [sessionRecordingUrl, setSessionRecordingUrl] = useState<string | null>(null);


  // VAD & Streaming refs
  const pcmAudioContextRef = useRef<AudioContext | null>(null);
  const pcmActiveSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  // Raw linear16 streams can split between the two bytes of a PCM sample.
  // Preserve that byte between transport chunks to prevent audible crackle.
  const pcmRemainderRef = useRef<Uint8Array>(new Uint8Array(0));
  const pendingDecodesRef = useRef<number>(0);
  const ttsStreamDoneRef = useRef<boolean>(false);
  const pcmChunksReceivedThisTurnRef = useRef<boolean>(false);
  const latestAiTextRef = useRef<string>("");
  const speakingTextRef = useRef<string>("");
  const lastBotSpokenTextRef = useRef<string>("");
  const speechEndedAtRef = useRef<number>(0);
  const recognitionRef = useRef<any>(null);
  const pcmNextStartTimeRef = useRef<number>(0);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const pendingSendRef = useRef<boolean>(false); // True when a delayed transcript send is queued
  const accumulatedTranscriptRef = useRef<string>(""); // Accumulates speech across multiple STT final events
  const vadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // VAD silence timer
  const interruptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakPromiseRef = useRef<Promise<any> | null>(null);
  const welcomeAudioRef = useRef<string | null>(null);
  const welcomeTextRef = useRef<string>("");
  // Gemini Live's welcome audio can leak from speakers back into the raw PCM
  // microphone stream. Hold only the initial greeting input so the model does
  // not transcribe and answer its own welcome message.
  const nativeGreetingPlayingRef = useRef<boolean>(false);
  const convIdRef = useRef<string | null>(activeConvId);
  const isMutedRef = useRef<boolean>(isMuted);
  const speechActiveRef = useRef<boolean>(false);
  // Counts consecutive mic frames while the assistant is speaking. This is
  // the low-latency barge-in path for server-STT/clone mode; waiting for a
  // final transcript makes the user hear the rest of the answer first.
  const bargeInFramesRef = useRef<number>(0);
  // Prevent the browser recognizer from feeding the assistant's own speaker
  // output back into the conversation. WebRTC echo cancellation helps at the
  // device level, but browser SpeechRecognition can still transcribe leakage.
  const assistantOutputActiveRef = useRef<boolean>(false);
  const ignoreStaleAudioRef = useRef<boolean>(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { convIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !isMuted; });
    }
  }, [isMuted]);

  // Warm up voices on client
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (voiceStateRef.current === "listening" || voiceStateRef.current === "processing") {
        const micActive = mediaStreamRef.current?.active && mediaStreamRef.current?.getAudioTracks()[0]?.readyState === "live" && !isMutedRef.current;
        const trackLive = mediaStreamRef.current?.getAudioTracks()[0]?.readyState === "live";
        const ctxRunning = audioContextRef.current?.state === "running";
        const wsOpen = wsRef.current?.readyState === WebSocket.OPEN;
        const frames = (processorRef.current as any)?._framesSent || 0;

        console.log(`[VOICE][HEALTH]
state=LISTENING
mic=${micActive ? 'ACTIVE' : 'INACTIVE'}
track=${trackLive ? 'LIVE' : 'ENDED'}
audio_context=${ctxRunning ? 'RUNNING' : 'SUSPENDED'}
pcm=${processorRef.current ? 'ACTIVE' : 'INACTIVE'}
input=${speechActiveRef.current ? 'ACTIVE' : 'SILENT'}
ws=${wsOpen ? 'OPEN' : 'CLOSED'}
stt=${wsOpen ? 'CONNECTED' : 'DISCONNECTED'}
speech=${speechActiveRef.current ? 'YES' : 'NO'}`);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const typingIntervalRef = useRef<any>(null);
  const pendingAiSourcesRef = useRef<any[]>([]);

  const stopTypingSync = useCallback(() => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  }, []);

  const startTypingSync = useCallback((fullText: string, durationSec: number = 3.0) => {
    stopTypingSync();
    if (!fullText) return;

    const words = fullText.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      onMessagesUpdate("", fullText, pendingAiSourcesRef.current);
      return;
    }

    const totalMs = Math.max(1000, durationSec * 1000);
    const intervalMs = Math.max(40, Math.min(240, Math.floor(totalMs / words.length)));

    let wordIdx = 1;
    onMessagesUpdate("", words.slice(0, 1).join(" "), pendingAiSourcesRef.current);

    typingIntervalRef.current = setInterval(() => {
      wordIdx++;
      const partial = words.slice(0, Math.min(wordIdx, words.length)).join(" ");
      onMessagesUpdate("", partial, pendingAiSourcesRef.current);

      if (wordIdx >= words.length) {
        stopTypingSync();
      }
    }, intervalMs);
  }, [onMessagesUpdate, stopTypingSync]);

  const stopAllAudioPlayback = useCallback(() => {
    stopTypingSync();
    ttsStreamDoneRef.current = false;
    assistantOutputActiveRef.current = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try { 
        window.speechSynthesis.resume();
        window.speechSynthesis.cancel(); 
      } catch (e) { }
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.src = "";
      audioPlayerRef.current = null;
    }
    pcmActiveSourcesRef.current.forEach(s => {
      try { s.stop(); s.disconnect(); } catch (e) { }
    });
    pcmActiveSourcesRef.current = [];
    pcmRemainderRef.current = new Uint8Array(0);
    if (pcmAudioContextRef.current) {
      try { pcmAudioContextRef.current.close(); } catch (e) { }
      pcmAudioContextRef.current = null;
    }
  }, [stopTypingSync]);

  const releaseAll = useCallback((reason: string = "unknown") => {
    console.log(`[VOICE] Voice component cleanup triggered`);
    console.log(`[VOICE] Cleanup source=${reason}`);
    console.log(`[VOICE] Voice session stopping`);
    sessionTokenRef.current++; // Invalidate active flows
    isProcessingRef.current = false;
    speechActiveRef.current = false;
    bargeInFramesRef.current = 0;
    if (interruptTimerRef.current) {
      clearTimeout(interruptTimerRef.current);
      interruptTimerRef.current = null;
    }

    stopAllAudioPlayback();
    console.log(`[VOICE] Audio stopped`);

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch (e) { }
      recognitionRef.current = null;
    }

    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch (e) { }
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { }
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
      console.log(`[VOICE] Microphone stopped`);
    }
    if (wsRef.current) {
      console.log(`[VOICE] CLIENT_REQUESTED_WS_CLOSE reason=${reason}`);
      try { wsRef.current.close(); } catch (e) { }
      wsRef.current = null;
      console.log(`[VOICE] WebSocket closed`);
    }
    if (mountedRef.current) setVoiceState("idle");
    console.log(`[VOICE] Cleanup completed`);
  }, [stopAllAudioPlayback, setVoiceState]);

  const endVoiceChat = useCallback(() => {
    console.log(`[VOICE] End button clicked`);

    // Stop recording and create downloadable blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        const chunks = recordingChunksRef.current;
        if (chunks.length > 0) {
          const mimeType = chunks[0].type || "audio/webm";
          const blob = new Blob(chunks, { type: mimeType });
          const url = URL.createObjectURL(blob);
          setSessionRecordingUrl(url);
          console.log(`[VOICE] Session recording saved: ${url} size=${blob.size}`);
        }
        recordingChunksRef.current = [];
      };
      try { mediaRecorderRef.current.stop(); } catch (e) { }
    }

    releaseAll("end_button");
    onEnd();
  }, [releaseAll, onEnd]);


  // Phase 11: Barge-in (User interrupts AI speech)
  const handleUserInterrupt = useCallback(() => {
    if (voiceStateRef.current !== "speaking") return;

    console.log("[VOICE] User interrupted bot speech! Stopping audio immediately.");
    speakingTextRef.current = "";
    ignoreStaleAudioRef.current = true;
    stopAllAudioPlayback();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "barge_in" }));
    }

    isProcessingRef.current = false;
    setVoiceState("listening");
  }, [stopAllAudioPlayback, setVoiceState]);

  // Browser SpeechSynthesis Fallback
  const speakWithBrowserSynthesis = useCallback((text: string, langCode: string = "en-IN") => {
    // Gemini Live owns both the response generation and audio output. A
    // browser-synthesized fallback here would create a second, different
    // voice on top of Gemini's native voice.
    if (engineModeRef.current === "gemini_live") {
      console.warn("[VOICE] Browser TTS suppressed because Gemini Live is active");
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      isProcessingRef.current = false;
      setVoiceState("listening");
      return;
    }
    try {
      window.speechSynthesis.cancel();
      setOutputVoice("browser");
      speakingTextRef.current = text;
      lastBotSpokenTextRef.current = text;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;

      const acoustics = getVoiceAcoustics(agent.tts_voice);
      const targetSpeed = (agent as any).voice_speed || (agent as any).speed || acoustics.rate || 1.15;
      const targetVolume = (agent as any).voice_volume || (agent as any).volume || 1.35;
      utterance.rate = Math.max(0.7, Math.min(2.0, targetSpeed));
      utterance.volume = Math.min(1.0, Math.max(0.1, targetVolume / 2.0));
      utterance.pitch = acoustics.pitch;

      const voices = window.speechSynthesis.getVoices();
      const bestVoice = findBrowserVoice(voices, acoustics.isMale, langCode, text, agent.tts_voice);
      if (bestVoice) {
        utterance.voice = bestVoice;
        console.log(`[VOICE] Using TTS voice: ${bestVoice.name} (${bestVoice.lang}) - Male=${acoustics.isMale} pitch=${acoustics.pitch}`);
      }

      let synthesisStarted = false;
      const startTimer = window.setTimeout(() => {
        if (synthesisStarted || !mountedRef.current) return;
        window.speechSynthesis.cancel();
        assistantOutputActiveRef.current = false;
        setAudioNeedsGesture(true);
        setVoiceState(mediaStreamRef.current?.active ? "listening" : "idle");
      }, 2500);
      utterance.onstart = () => {
        synthesisStarted = true;
        window.clearTimeout(startTimer);
        setAudioNeedsGesture(false);
        setVoiceState("speaking");
        assistantOutputActiveRef.current = true;
      };

      utterance.onend = () => {
        window.clearTimeout(startTimer);
        isProcessingRef.current = false;
        assistantOutputActiveRef.current = false;
        speechEndedAtRef.current = Date.now();
        speakingTextRef.current = "";
        setTimeout(() => {
          if (mountedRef.current && voiceStateRef.current === "speaking") {
            setVoiceState(mediaStreamRef.current?.active ? "listening" : "idle");
            console.log("[VOICE] Browser TTS playback completed, listening again");
          }
        }, 400);
      };

      utterance.onerror = (e) => {
        window.clearTimeout(startTimer);
        console.warn("[VOICE] Browser TTS playback error", e);
        isProcessingRef.current = false;
        assistantOutputActiveRef.current = false;
        speechEndedAtRef.current = Date.now();
        speakingTextRef.current = "";
        setVoiceState(mediaStreamRef.current?.active ? "listening" : "idle");
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("[VOICE] Browser synthesis failed", err);
      isProcessingRef.current = false;
      assistantOutputActiveRef.current = false;
      speakingTextRef.current = "";
      setVoiceState("listening");
    }
  }, [agent.tts_voice, setVoiceState]);

  // Browser SpeechRecognition (Web Speech API) - completely free, real-time
  const setupSpeechRecognition = useCallback((token: number) => {
    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn("[VOICE] Browser SpeechRecognition not supported in this browser");
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) { }
        recognitionRef.current = null;
      }

      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      // Use en-IN for Hinglish so speech is recognized in clean Roman letters instead of Devanagari!
      recognition.lang = 
        langModeRef.current === "gujarati" ? "gu-IN" 
        : langModeRef.current === "hindi" ? "hi-IN" 
        : langModeRef.current === "english" ? "en-IN" 
        : "en-IN";
      recognitionRef.current = recognition;

      function clean(t: string): string {
        return (t || "").toLowerCase().replace(/[^\w\s\u0900-\u0D7F]/g, " ").trim();
      }

      // Short user confirmations that must NEVER be treated as echo
      const USER_CONFIRMATIONS = new Set(["ha", "haan", "yes", "no", "nahi", "correct", "theek", "accha", "ok", "okay", "bilkul", "sure"]);

      // Check if text heard by microphone is simply an acoustic echo of the bot's own speaker output
      function isEcho(heard: string): boolean {
        if (!heard || !heard.trim()) return false;
        const heardWords = clean(heard).split(/\s+/).filter(w => w.length > 0);
        if (heardWords.length === 0) return true;

        // NEVER treat user confirmations as echo — these are always intentional short answers
        if (heardWords.length <= 2 && heardWords.some(w => USER_CONFIRMATIONS.has(w))) {
          return false;
        }

        const botContext = clean(`${speakingTextRef.current} ${lastBotSpokenTextRef.current}`);
        if (!botContext) return false;

        const botWords = new Set(botContext.split(/\s+/).filter(Boolean));
        // Add common assistant phrases & greetings that often echo or get phonetically mistranscribed
        [
          "hello", "main", "aapki", "zeniaone", "assistant", "hoon", "kahiye", "aaj", "help", 
          "kar", "sakti", "sakta", "shukriya", "badhiya", "bataiye", "kaise", "madad",
          "kripya", "spasht", "karein", "vishey", "poochhna", "chahte", "hain"
        ].forEach(w => botWords.add(w));

        const heardSignificant = heardWords.filter(w => w.length > 1);
        if (heardSignificant.length === 0) return true;

        let matches = 0;
        for (const w of heardSignificant) {
          if (botWords.has(w)) matches++;
        }

        const ratio = matches / heardSignificant.length;
        // Only flag as echo if MAJORITY of meaningful words match bot speech
        if (ratio >= 0.6) return true;
        // For short phrases (3+ words), require higher confidence
        if (heardSignificant.length >= 3 && ratio >= 0.5) return true;
        return false;
      }

      // Check if user is actively interrupting the AI speech
      function isInterrupting(heard: string): boolean {
        if (!heard || !heard.trim()) return false;
        const heardWords = clean(heard).split(/\s+/).filter(w => w.length > 1);
        if (heardWords.length === 0) return false;

        const INTERRUPT_WORDS = new Set([
          "stop", "wait", "hold", "listen", "pause", "no", "quiet", "cancel",
          "ruko", "ruk", "suno", "chup", "arre", "aree", "accha", "achha", "kya", "kyu", 
          "kyun", "nahin", "nahi", "batao", "bolo", "ek", "minute", "bhai",
          "ubho", "ubha", "sambhalo", "na", "sir", "madam", "help", "hello", "hi", "hey"
        ]);

        const currentBot = clean(speakingTextRef.current);
        const botWords = new Set(currentBot.split(/\s+/).filter(Boolean));

        // 1. If any strong interrupt word is used (and bot didn't just say it), barge-in
        for (const w of heardWords) {
          if (INTERRUPT_WORDS.has(w) && !botWords.has(w)) {
            return true;
          }
        }

        // Calculate how many distinct words are NEW (not in the bot's current speech)
        let newWords = 0;
        for (const w of heardWords) {
          if (!botWords.has(w)) newWords++;
        }

        // 2. If there are at least 2 entirely new words, it's definitely the user speaking
        if (newWords >= 2) {
          return true;
        }

        // 3. If there is 1 new word, and the phrase is short, treat it as an interrupt
        if (newWords === 1 && heardWords.length <= 4) {
          return true;
        }

        return false;
      }

      recognition.onresult = (event: any) => {
        if (sessionTokenRef.current !== token || !mountedRef.current) return;

        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const heardText = (final || interim).trim();
        if (!heardText) return;

        // Ignore speaker leakage while idle/listening. During speaking we
        // still inspect browser STT so a real user utterance can interrupt
        // the assistant (barge-in).
        if (assistantOutputActiveRef.current && voiceStateRef.current !== "speaking") {
          console.log(`[VOICE_ECHO_DISCARD] Ignored recognition during assistant playback: "${heardText}"`);
          return;
        }

        // 1. AI is actively speaking
        if (voiceStateRef.current === "speaking") {
          if (isInterrupting(heardText)) {
            console.log(`[VOICE_BARGE_IN_USER] User interrupted speech: "${heardText}"`);
            handleUserInterrupt(); // Immediately stops audio playback!
            setLiveTranscript(heardText);
            if (interruptTimerRef.current) {
              clearTimeout(interruptTimerRef.current);
              interruptTimerRef.current = null;
            }
            if (final.trim()) {
              const finalText = final.trim();
              setVoiceState("processing");
              isProcessingRef.current = true;
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                console.log(`[VOICE_INTERRUPT_SEND] Sending interrupt transcript: "${finalText}"`);
                wsRef.current.send(JSON.stringify({ 
                  type: "user_transcript", 
                  text: finalText,
                  language: langModeRef.current
                }));
              }
            } else {
              // Some browsers keep this utterance as interim while audio is
              // playing. Submit it after a short hold instead of waiting for
              // a final event that may never arrive.
              const interruptText = heardText;
              interruptTimerRef.current = setTimeout(() => {
                interruptTimerRef.current = null;
                if (!mountedRef.current || voiceStateRef.current !== "listening") return;
                if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
                setVoiceState("processing");
                isProcessingRef.current = true;
                wsRef.current.send(JSON.stringify({
                  type: "user_transcript",
                  text: interruptText,
                  language: langModeRef.current,
                }));
              }, 650);
            }
          } else {
            // Speaker echo of bot's own voice: completely ignore!
            return;
          }
          return;
        }

        // 2. Trailing echo guard (within 4500ms after AI finishes speaking)
        const timeSinceSpeech = Date.now() - speechEndedAtRef.current;
        if (timeSinceSpeech < 4500 && isEcho(heardText)) {
          console.log(`[VOICE_ECHO_DISCARD] Discarded trailing echo: "${heardText}" (${timeSinceSpeech}ms after speech)`);
          setLiveTranscript(""); // Clear any stuck grey text
          return;
        }

        // 3. If not in listening state (e.g. thinking/processing), ignore
        if (voiceStateRef.current !== "listening") {
          return;
        }

        if (interim.trim()) {
          const interimText = interim.trim();
          setLiveTranscript(interimText);
          onMessagesUpdate(interimText, "", undefined, true);
        }

        if (final.trim()) {
          // Accumulate finals — SpeechRecognition fires multiple final events for long speech
          const finalText = final.trim();
          const existing = accumulatedTranscriptRef.current;
          const combined = existing ? `${existing} ${finalText}` : finalText;
          accumulatedTranscriptRef.current = combined;

          console.log(`[VOICE_BROWSER_STT_FINAL] "${finalText}" → accumulated: "${combined}"`);
          setLiveTranscript(combined);
          latestTranscriptRef.current = combined;

          // Block if a send is already pending (prevents duplicate sends during wait window)
          if (pendingSendRef.current) {
            console.log(`[VOICE_STT_SKIP] pendingSend active, skipping duplicate final`);
            return;
          }

          // VAD: reset silence timer on each new final
          if (vadTimerRef.current) clearTimeout(vadTimerRef.current);

          const wordCount = combined.trim().split(/\s+/).length;
          // Short answers (1-3 words): wait 1000ms for more speech
          // Long speech: wait 400ms for a natural pause
          const silenceWait = wordCount <= 3 ? 1000 : 400;

          pendingSendRef.current = true;
          vadTimerRef.current = setTimeout(() => {
            pendingSendRef.current = false;
            vadTimerRef.current = null;

            // Only send if still in listening state
            if (voiceStateRef.current !== "listening") return;

            const textToSend = accumulatedTranscriptRef.current.trim();
            accumulatedTranscriptRef.current = ""; // Reset accumulator
            if (!textToSend) return;

            console.log(`[VOICE_BROWSER_STT_SEND] Sending: "${textToSend}" lang=${langModeRef.current} (silence=${silenceWait}ms)`);
            // Keep the user turn visible immediately. The assistant message
            // is added only when the server returns the real answer; a literal
            // "..." bubble used to remain visible when a response arrived on
            // a different render tick.
            onMessagesUpdate(textToSend, "", undefined, false);
            setVoiceState("processing");
            isProcessingRef.current = true;
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: "user_transcript",
                text: textToSend,
                language: langModeRef.current
              }));
            }
          }, silenceWait);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech" && e.error !== "aborted") {
          console.warn("[VOICE] SpeechRecognition error:", e.error);
        }
      };

      recognition.onend = () => {
        if (sessionTokenRef.current === token && mountedRef.current && voiceStateRef.current !== "ended" && voiceStateRef.current !== "idle") {
          try {
            recognition.start();
          } catch (e) {
            // Recognition already running or busy
          }
        }
      };

      try {
        recognition.start();
        console.log(`[VOICE] Browser SpeechRecognition started (lang=${recognition.lang})`);
      } catch (err) {
        console.warn("[VOICE] SpeechRecognition start failed", err);
      }
    } catch (e) {
      console.error("[VOICE] Failed to initialize SpeechRecognition", e);
    }
  }, [agent.default_language, handleUserInterrupt, langMode, setVoiceState]);

  // PCM Playout Helper
  const playPcmChunk = useCallback((base64: string) => {
    setOutputVoice(engineModeRef.current === "gemini_live" ? "gemini" : "clone");
    assistantOutputActiveRef.current = true;
    if (!pcmAudioContextRef.current) {
      pcmAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      pcmNextStartTimeRef.current = pcmAudioContextRef.current.currentTime + 0.1;
    }
    const ctx = pcmAudioContextRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume().then(() => setAudioNeedsGesture(ctx.state !== "running"))
        .catch(() => setAudioNeedsGesture(true));
    }

    const byteStr = atob(base64);
    const incoming = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) incoming[i] = byteStr.charCodeAt(i);

    // WebSocket/HTTP transport chunks are arbitrary byte lengths. Do not
    // drop an odd trailing byte: doing so shifts every following PCM sample
    // and produces the "cracked"/static sound heard with clone voices.
    const previous = pcmRemainderRef.current;
    const combined = new Uint8Array(previous.length + incoming.length);
    combined.set(previous, 0);
    combined.set(incoming, previous.length);
    const safeLen = combined.length - (combined.length % 2);
    pcmRemainderRef.current = safeLen < combined.length
      ? combined.slice(safeLen)
      : new Uint8Array(0);
    if (safeLen === 0) return;

    const int16Array = new Int16Array(safeLen / 2);
    const view = new DataView(combined.buffer, combined.byteOffset, safeLen);
    for (let i = 0; i < int16Array.length; i++) {
      int16Array[i] = view.getInt16(i * 2, true);
    }

    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 32768 : 32767);
    }

    const buffer = ctx.createBuffer(1, float32Array.length, 24000);
    buffer.getChannelData(0).set(float32Array);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startTime = Math.max(pcmNextStartTimeRef.current, ctx.currentTime);
    source.start(startTime);
    pcmNextStartTimeRef.current = startTime + buffer.duration;

    pcmActiveSourcesRef.current.push(source);
    source.onended = () => {
      pcmActiveSourcesRef.current = pcmActiveSourcesRef.current.filter(s => s !== source);
      if (ttsStreamDoneRef.current && pcmActiveSourcesRef.current.length === 0) {
        assistantOutputActiveRef.current = false;
        ttsStreamDoneRef.current = false;
        isProcessingRef.current = false;
        pcmChunksReceivedThisTurnRef.current = false;
        speechEndedAtRef.current = Date.now();
        lastBotSpokenTextRef.current = speakingTextRef.current || latestAiTextRef.current;
        latestAiTextRef.current = "";
        speakingTextRef.current = "";
        setTimeout(() => {
          if (mountedRef.current && voiceStateRef.current === "speaking") {
            setVoiceState("listening");
            console.log("[VOICE] TTS audio finished playing, listening again");
          }
        }, 400);
      }
    };
  }, [setVoiceState]);

  // Direct High-Fidelity Neural Audio (MP3) Playout
  const playMp3Audio = useCallback(async (base64Str: string) => {
    assistantOutputActiveRef.current = true;
    pendingDecodesRef.current++;
    try {
      if (!pcmAudioContextRef.current) {
        pcmAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = pcmAudioContextRef.current;
      if (ctx.state === "suspended") {
        await Promise.race([
          ctx.resume(),
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Audio output unlock timed out")), 3000)),
        ]);
      }
      if (ctx.state !== "running") throw new Error("Audio output is suspended");
      setAudioNeedsGesture(false);
      const byteStr = atob(base64Str);
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);

      let decoded: AudioBuffer;
      decoded = await ctx.decodeAudioData(ab);
      console.log(`[VOICE] Neural audio decoded successfully: duration=${decoded.duration}s`);
      
      // If voiceState changed (e.g. user interrupted) while decoding, abort playback
      // A microphone failure can change the panel state to `error` while the
      // welcome TTS request is still decoding.  Do not discard that audio:
      // the user should still hear the assistant and get the mic error.
      if (voiceStateRef.current !== "speaking" && !speakingTextRef.current) {
        assistantOutputActiveRef.current = false;
        return;
      }
      
      const source = ctx.createBufferSource();
      source.buffer = decoded;

      const targetVol = (agent as any).voice_volume || (agent as any).volume || 1.0;
      const gainNode = ctx.createGain();
      gainNode.gain.value = targetVol;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      pcmActiveSourcesRef.current.push(source);

      source.onended = () => {
        stopTypingSync();
        const finalContent = speakingTextRef.current || latestAiTextRef.current;
        if (finalContent) {
          onMessagesUpdate("", finalContent, pendingAiSourcesRef.current);
        }
        pcmActiveSourcesRef.current = pcmActiveSourcesRef.current.filter(s => s !== source);
        if (pcmActiveSourcesRef.current.length === 0) {
          assistantOutputActiveRef.current = false;
          ttsStreamDoneRef.current = false;
          isProcessingRef.current = false;
          pcmChunksReceivedThisTurnRef.current = false;
          speechEndedAtRef.current = Date.now();
          lastBotSpokenTextRef.current = finalContent;
          latestAiTextRef.current = "";
          speakingTextRef.current = "";
          setTimeout(() => {
            if (mountedRef.current && voiceStateRef.current === "speaking") {
              setVoiceState("listening");
              console.log("[VOICE] Neural audio finished playing, listening again");
            }
          }, 300);
        }
      };

      source.start(0);
      setOutputVoice("clone");
      setVoiceState("speaking");
      const textToType = speakingTextRef.current || latestAiTextRef.current;
      startTypingSync(textToType, decoded.duration);
      console.log("[VOICE] Neural MP3 audio playback started");
    } catch (err) {
      console.error("[VOICE] Neural MP3 playback error", err);
      if (pcmAudioContextRef.current?.state === "suspended") setAudioNeedsGesture(true);
      // Keep a real output fallback for browsers that reject decodeAudioData
      // (or have an interrupted AudioContext).  The previous code checked only
      // latestAiText, which is empty for the initial welcome message.
      const fallbackText = speakingTextRef.current || latestAiTextRef.current;
      if (fallbackText) {
        speakWithBrowserSynthesis(fallbackText, agent.default_language || "en-IN");
      }
    } finally {
      pendingDecodesRef.current--;
    }
  }, [agent.default_language, setVoiceState, speakWithBrowserSynthesis, startTypingSync, stopTypingSync, onMessagesUpdate]);

  const connectWebSocketAndListen = useCallback((token: number, currentConvId: string, initialGreeting?: string) => {
    if (sessionTokenRef.current !== token || !mountedRef.current) return;
    nativeGreetingPlayingRef.current = Boolean(
      initialGreeting && engineModeRef.current === "gemini_live",
    );

    console.log(`[VOICE] WebSocket auth preparation started`);
    const jwtToken = typeof window !== "undefined" ? localStorage.getItem("zenaipex_token") : null;
    console.log(`[VOICE] Auth token available=${!!jwtToken}`);

    if (!jwtToken) {
      console.error(`[VOICE][ERROR] WebSocket auth token missing`);
      // We can either abort or continue and let backend reject. Aborting is safer.
    }

    console.log(`[VOICE] WebSocket connection starting`);

    let wsUrl: string;
    if (API_BASE_URL.startsWith("http")) {
      const wsProtocol = API_BASE_URL.startsWith("https") ? "wss:" : "ws:";
      const urlObj = new URL(API_BASE_URL);
      wsUrl = `${wsProtocol}//${urlObj.host}${urlObj.pathname}/companies/${companyId}/agents/${agent.id}/voice-stream`;
    } else {
      const host = window.location.host;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsUrl = `${protocol}//${host}/api/v1/companies/${companyId}/agents/${agent.id}/voice-stream`;
    }

    console.log(`[VOICE] WebSocket URL: ${wsUrl}`);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[VOICE] WebSocket connected`);
      console.log(`[VOICE][SELFTEST] WebSocket OPEN`);
      if (sessionTokenRef.current !== token || !mountedRef.current) {
        ws.close();
        return;
      }
      ws.send(JSON.stringify({
        token: jwtToken || "",
        conversation_id: currentConvId,
        initial_greeting: initialGreeting,
        engine: engineModeRef.current,
        // Clone mode uses server streaming STT; the classic pipeline uses
        // browser STT as its fallback/primary source.
        client_stt: engineModeRef.current === "pipeline",
        language_mode: langModeRef.current
      }));

      // Gemini Live already receives microphone PCM and performs its own live
      // turn detection/transcription. Starting browser SpeechRecognition too
      // would submit the same user speech a second time and can also
      // transcribe Gemini's speaker output as a new user turn.
      // Give the server's runtime_mode message a moment to arrive before
      // deciding whether browser STT is needed. This prevents a stale tab
      // state from starting browser STT alongside Gemini Live.
      window.setTimeout(() => {
        if (sessionTokenRef.current !== token || !mountedRef.current) return;
        if (engineModeRef.current !== "gemini_live" && !serverSttActiveRef.current) {
          setupSpeechRecognition(token);
        } else {
          console.log(`[VOICE] ${serverSttActiveRef.current ? "Server streaming STT" : "Gemini Live"} active; browser SpeechRecognition disabled`);
        }
      }, 900);

      // Inject synthetic audio test after 1 second (DISABLED FOR PRODUCTION)
      const ENABLE_SYNTHETIC_PCM_TEST = false;
      if (ENABLE_SYNTHETIC_PCM_TEST) {
        setTimeout(() => {
          if (sessionTokenRef.current === token && wsRef.current?.readyState === WebSocket.OPEN) {
            console.log(`[VOICE][SELFTEST] synthetic PCM generation START`);
            const syntheticBuffer = new Int16Array(4096);
            for (let i = 0; i < syntheticBuffer.length; i++) {
              syntheticBuffer[i] = Math.sin(i * 0.1) * 10000;
            }
            console.log(`[VOICE][SELFTEST] synthetic PCM bytes=${syntheticBuffer.byteLength}`);
            console.log(`[VOICE][SELFTEST] synthetic PCM send START`);
            try {
              wsRef.current.send(syntheticBuffer);
              console.log(`[VOICE][SELFTEST] synthetic PCM send SUCCESS`);
            } catch (e) {
              console.error(`[VOICE][SELFTEST] synthetic PCM send FAILED`, e);
            }
          }
        }, 1000);
      }

      // Wire up mic to WS
      if (!audioContextRef.current && mediaStreamRef.current) {
        try {
          const track = mediaStreamRef.current.getAudioTracks()[0];
          console.log(`[VOICE] Microphone active`);
          console.log(`[VOICE] Microphone track state=${track?.readyState}`);
          if (track?.readyState === "live") {
            console.log(`[VOICE][SELFTEST] audio track live`);
          }
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
          audioContextRef.current = audioCtx;
          console.log(`[VOICE][AUDIO] AudioContext created`);
          console.log(`[VOICE][AUDIO] context_before=${audioCtx.state}`);
          console.log(`[VOICE][AUDIO] sampleRate=${audioCtx.sampleRate}`);
          if (audioCtx.state === "suspended") {
            audioCtx.resume().then(() => {
              console.log(`[VOICE][AUDIO] resume complete`);
              console.log(`[VOICE][AUDIO] context_after=${audioCtx.state}`);
            }).catch(e => console.error("[VOICE][ERROR] Input AudioContext resume failed", e));
          } else {
            console.log(`[VOICE][AUDIO] context_after=${audioCtx.state}`);
          }
          const source = audioCtx.createMediaStreamSource(mediaStreamRef.current);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          processorRef.current = processor;
          console.log(`[VOICE][SELFTEST] processor created`);

          let framesSent = 0;
          let silenceFrames = 0;
          processor.onaudioprocess = (e) => {
            if (sessionTokenRef.current !== token || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            // Gemini Live needs a continuous microphone stream while the AI
            // is speaking so server-side VAD can detect barge-in and cancel
            // the current response. The classic pipeline keeps the old gate
            // to avoid sending unnecessary audio during playback.
            const continuousServerInput =
              engineModeRef.current === "gemini_live" || serverSttActiveRef.current;
            // Native Gemini Live and cloned-voice server STT both need a
            // continuous mic stream while TTS is playing so barge-in can be
            // detected. The browser-only classic pipeline keeps the legacy
            // gate and only captures during an active listening turn.
            if (!continuousServerInput && voiceStateRef.current !== "listening" && voiceStateRef.current !== "processing") return;

            // Do not upload speaker leakage while Gemini is delivering the
            // automatic welcome. Input resumes immediately after its native
            // audio-complete event; later turns keep normal barge-in support.
            if (nativeGreetingPlayingRef.current) return;

            const inputData = e.inputBuffer.getChannelData(0);

            let sumSquares = 0;
            const outBuffer = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const val = inputData[i];
              sumSquares += val * val;
              const s = Math.max(-1, Math.min(1, val));
              outBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            const rms = Math.sqrt(sumSquares / inputData.length);

            // Interrupt playback from raw microphone energy immediately. The
            // server still receives PCM and can produce the corrected final
            // transcript, but audio is stopped locally without waiting for
            // Gemini/Sarvam STT. Echo cancellation is enabled on the stream;
            // the two-frame threshold also filters short device noise spikes.
            if (voiceStateRef.current === "speaking" && !isMutedRef.current) {
              if (rms > 0.035) {
                bargeInFramesRef.current += 1;
                if (bargeInFramesRef.current >= 2) {
                  console.log(`[VOICE] Local VAD barge-in rms=${rms.toFixed(5)}`);
                  bargeInFramesRef.current = 0;
                  handleUserInterrupt();
                }
              } else {
                bargeInFramesRef.current = 0;
              }
            } else {
              bargeInFramesRef.current = 0;
            }

            if (framesSent % 4 === 0) { // ~Once per second (4096 samples at 16kHz)
              console.log(`[VOICE] Mic RMS=${rms.toFixed(5)}`);
              if (rms > 0.01 && !isMutedRef.current) {
                console.log("[VOICE] Mic input=ACTIVE");
                if (!speechActiveRef.current) {
                  speechActiveRef.current = true;
                  setIsSpeakingUser(true);
                  console.log("[VOICE] Speech detection START");
                }
                silenceFrames = 0;
              } else {
                console.log("[VOICE] Mic input=SILENT");
                silenceFrames++;
                if (silenceFrames > 4 && speechActiveRef.current) {
                  speechActiveRef.current = false;
                  setIsSpeakingUser(false);
                  console.log("[VOICE] Speech detection END");
                }
                if (silenceFrames % 12 === 0 && voiceStateRef.current === "listening" && !speechActiveRef.current) {
                  console.log(isMutedRef.current ? "[VOICE] Microphone muted" : "[VOICE] No microphone input detected");
                }
              }
            }

            try {
              wsRef.current.send(outBuffer);
              framesSent++;
              (processor as any)._framesSent = framesSent;
              if (framesSent === 1) {
                console.log(`[VOICE][AUDIO] PCM callback ACTIVE`);
                console.log(`[VOICE][PCM] FIRST_REAL_MIC_PCM`);
                console.log(`[VOICE][PCM] input_samples=${inputData.length}`);
                console.log(`[VOICE][PCM] pcm_bytes=${outBuffer.byteLength}`);
                console.log(`[VOICE][PCM] sample_rate=16000`);
                console.log(`[VOICE][PCM] channels=1`);
                console.log(`[VOICE][WS] FIRST_REAL_MIC_FRAME_SENT`);
                console.log(`[VOICE] Audio frames sent count=1`);
                if (wsRef.current.readyState !== WebSocket.OPEN) {
                  console.error(`[VOICE][ERROR] WS_NOT_OPEN_WHILE_MIC_PCM_ACTIVE`);
                }
              } else if (framesSent % 100 === 0) {
                console.log(`[VOICE][WS] audio_bytes_sent=${framesSent * outBuffer.byteLength}`);
                console.log(`[VOICE][WS] audio_frames_sent=${framesSent}`);
                console.log(`[VOICE] Audio frames sent count=${framesSent}`);
              }
            } catch (wsErr: any) {
              console.error(`[VOICE][ERROR] PCM_GENERATED_BUT_WS_SEND_NOT_EXECUTED`);
              console.error(`[VOICE][ERROR] Audio frame send failed: ${wsErr.message}`);
            }
          };

          source.connect(processor);
          console.log(`[VOICE][AUDIO] source connected`);
          const zeroGain = audioCtx.createGain();
          zeroGain.gain.value = 0;
          processor.connect(zeroGain);
          console.log(`[VOICE][AUDIO] processor connected`);
          zeroGain.connect(audioCtx.destination);

          console.log(`[VOICE][SELFTEST] processor connected`);
          console.log(`[VOICE] PCM processor started`);
          console.log(`[VOICE] Audio graph connected (source -> processor -> zeroGain -> destination)`);
          console.log(`[VOICE] STT listening`);

          setTimeout(() => {
            if (framesSent === 0 && voiceStateRef.current === "listening") {
              console.error(`[VOICE][ERROR] PROCESSOR_CALLBACK_NOT_FIRING`);
            }
          }, 3000);
        } catch (micErr: any) {
          console.error(`[VOICE][ERROR] Microphone error name=${micErr.name}`);
          console.error(`[VOICE][ERROR] Microphone error message=${micErr.message}`);
        }
      }

      if (!speakingTextRef.current && !assistantOutputActiveRef.current) {
        setVoiceState(mediaStreamRef.current?.active ? "listening" : "idle");
      }
    };

    ws.onmessage = (event) => {
      if (sessionTokenRef.current !== token || !mountedRef.current) return;

      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "runtime_mode") {
            const runtimeEngine = msg.engine === "gemini_live" ? "gemini_live" : msg.engine;
            if (runtimeEngine === "gemini_live" || runtimeEngine === "gemini_clone" || runtimeEngine === "pipeline") {
              engineModeRef.current = runtimeEngine;
              setEngineMode(runtimeEngine);
              console.log(`[VOICE] Runtime engine confirmed by server: ${runtimeEngine}`);
            }
          }
          else if (msg.type === "voice_input_mode") {
            serverSttActiveRef.current = msg.mode === "server";
            console.log(`[VOICE] Input mode confirmed: ${msg.mode}`);
            if (msg.mode === "browser" && engineModeRef.current !== "gemini_live" && !recognitionRef.current) {
              setupSpeechRecognition(token);
            }
          }
          else if (msg.type === "transcript") {
            latestTranscriptRef.current = msg.text;
            setLiveTranscript(msg.text);
            if (msg.text && msg.text.trim()) {
              onMessagesUpdate(msg.text.trim(), "", undefined, !msg.is_final);
            }
            if (msg.is_final) {
              console.log(`[VOICE] STT final transcript: "${msg.text}"`);
            }
          }
          else if (msg.type === "interrupted") {
            nativeGreetingPlayingRef.current = false;
            console.log("[VOICE] AI speech interrupted by barge-in");
            handleUserInterrupt();
          }
          else if (msg.type === "ai_text_delta") {
            speakingTextRef.current = (speakingTextRef.current || "") + (msg.delta || "");
            onMessagesUpdate("", speakingTextRef.current, undefined, false);
          }
          else if (msg.type === "state") {
            if (msg.state === "thinking") {
              setVoiceState("processing");
              isProcessingRef.current = true;
              console.log("[VOICE] AI processing started");
            } else if (msg.state === "listening") {
              if (pcmActiveSourcesRef.current.length === 0 && pendingDecodesRef.current === 0) {
                ttsStreamDoneRef.current = false;
                isProcessingRef.current = false;
                setVoiceState("listening");
                console.log("[VOICE] Server signaled listening");
              }
            } else if (msg.state === "error") {
              setErrorMsg(msg.message || "Unknown error");
              setVoiceState("error");
            }
          }
          else if (msg.type === "info") {
            setVoiceNotice(msg.message || "Browser speech recognition is active.");
            console.warn(`[VOICE][INFO] ${msg.code || "runtime"}: ${msg.message || ""}`);
          }
          else if (msg.type === "error") {
            const message = msg.message || "Voice connection failed. Please start a new session.";
            setErrorMsg(message);
            setVoiceNotice("");
            setVoiceState("error");
            console.error(`[VOICE][SERVER_ERROR] ${msg.code || "runtime"}: ${message}`);
          }
          else if (msg.type === "ai_text") {
            console.log("[VOICE] AI response received");
            ignoreStaleAudioRef.current = false;
            latestAiTextRef.current = msg.text;
            speakingTextRef.current = msg.text;
            // Gemini Live streams audio before its final ai_text event. Do
            // not clear the audio-received flag here or ai_audio_pcm_done
            // will incorrectly report that native audio was missing.
            if (engineModeRef.current !== "gemini_live") {
              pcmChunksReceivedThisTurnRef.current = false;
              pcmRemainderRef.current = new Uint8Array(0);
            }
            pendingAiSourcesRef.current = msg.sources || [];
            // Reset VAD state for next user turn
            if (vadTimerRef.current) { clearTimeout(vadTimerRef.current); vadTimerRef.current = null; }
            pendingSendRef.current = false;
            accumulatedTranscriptRef.current = "";
            // Gemini Live already streamed the answer text through
            // ai_text_delta. Do not replace it with a temporary placeholder.
            // The complete answer must also be visible immediately in the
            // classic/clone pipeline. Previously this sent only "..." to the
            // chat UI while the full answer was saved in history, making live
            // voice answers appear missing until the session was reopened.
            onMessagesUpdate(
              "",
              msg.text,
              msg.sources
            );
            latestTranscriptRef.current = "";
            setLiveTranscript("");
          }
          else if (msg.type === "ai_audio_pcm") {
            if (ignoreStaleAudioRef.current) return;
            ttsStreamDoneRef.current = false;
            pcmChunksReceivedThisTurnRef.current = true;
            if (voiceStateRef.current !== "speaking") {
              setVoiceState("speaking");
              console.log("[VOICE] TTS playback started");
              startTypingSync(speakingTextRef.current || latestAiTextRef.current, 3.5);
            }
            playPcmChunk(msg.audio_base64);
          }
          else if (msg.type === "ai_audio_mp3") {
            if (ignoreStaleAudioRef.current) return;
            ttsStreamDoneRef.current = true;
            pcmChunksReceivedThisTurnRef.current = true;
            if (voiceStateRef.current !== "speaking") {
              setVoiceState("speaking");
              console.log("[VOICE] Neural MP3 playback started");
            }
            playMp3Audio(msg.audio_base64);
          }
          else if (msg.type === "ai_audio_pcm_done") {
            if (ignoreStaleAudioRef.current) return;
            nativeGreetingPlayingRef.current = false;
            ttsStreamDoneRef.current = true;
            if (engineModeRef.current === "gemini_live" && !pcmChunksReceivedThisTurnRef.current) {
              // Never switch to a browser/female fallback voice in native
              // Gemini Live mode. Keep the session single-voice and expose a
              // clear error if native audio was not received.
              setErrorMsg("Gemini Live audio was not received. Please start a new voice session.");
              setVoiceState("error");
              return;
            }
            if (msg.fallback_tts || (!pcmChunksReceivedThisTurnRef.current && latestAiTextRef.current)) {
              console.log("[VOICE] Triggering browser speech synthesis fallback");
              speakWithBrowserSynthesis(msg.fallback_text || latestAiTextRef.current, agent.default_language || "en-IN");
              pcmChunksReceivedThisTurnRef.current = false;
              latestAiTextRef.current = "";
            } else if (pcmActiveSourcesRef.current.length === 0 && pendingDecodesRef.current === 0) {
              pcmRemainderRef.current = new Uint8Array(0);
              assistantOutputActiveRef.current = false;
              ttsStreamDoneRef.current = false;
              isProcessingRef.current = false;
              pcmChunksReceivedThisTurnRef.current = false;
              latestAiTextRef.current = "";
              setVoiceState("listening");
              console.log("[VOICE] TTS playback completed");
              console.log("[VOICE] Listening again");
            }
          }
        } catch (e) {
          console.error("WS Parse Error", e);
        }
      }
    };

    ws.onerror = (e) => {
      console.error(`[VOICE][ERROR] WebSocket connection failed`, e);
      console.error(`[VOICE][ERROR] WebSocket readyState=${ws.readyState}`);
      if (sessionTokenRef.current === token && mountedRef.current) {
        setErrorMsg("Connection error");
        setVoiceState("error");
      }
    };

    ws.onclose = (e) => {
      console.log(`[VOICE] WS CLOSE code=${e.code} reason=${e.reason} wasClean=${e.wasClean}`);
      if (sessionTokenRef.current === token && mountedRef.current) {
        releaseAll("websocket_closed");
      }
    };
  }, [agent.default_language, agent.id, companyId, liveTranscript, onMessagesUpdate, playPcmChunk, releaseAll, setupSpeechRecognition, setVoiceState, speakWithBrowserSynthesis]);


  const startVoiceSession = useCallback(async (syncSavedEngine: boolean = true, forceNewConversation: boolean = false) => {
    const token = ++sessionTokenRef.current;
    console.log(`[VOICE] Session starting`);
    setVoiceState("starting");
    setErrorMsg("");
    setVoiceNotice("");

    try {
      // The admin routing page can update the agent while this chat screen is
      // already mounted. Read the saved engine before opening a new session so
      // an old clone mode cannot silently override Gemini Live S2S.
      if (syncSavedEngine) {
        try {
          const latestAgent = await agentsApi.get(companyId, agent.id);
          const savedEngine = latestAgent.voice_engine;
          if (savedEngine === "gemini_live" || savedEngine === "gemini_clone" || savedEngine === "pipeline") {
            engineModeRef.current = savedEngine;
            setEngineMode(savedEngine);
            setOutputVoice(savedEngine === "gemini_live" ? "gemini" : "clone");
            setNextEngine(null);
            console.log(`[VOICE] Fresh engine from backend: ${savedEngine}`);
          }
        } catch (engineErr) {
          console.warn("[VOICE] Could not refresh saved voice engine; using current UI mode", engineErr);
        }
      }
      // React development remounts and rapid Voice clicks can leave an older
      // startup awaiting the agent request. Never let that stale startup issue
      // a second welcome TTS request or open a second microphone session.
      if (sessionTokenRef.current !== token || !mountedRef.current) return;
      serverSttActiveRef.current = engineModeRef.current === "gemini_clone";

      // Do not block the first greeting on microphone permission or conversation
      // creation.  A pending getUserMedia() promise used to leave the whole
      // voice panel stuck on "Starting..." with no audio feedback.
      const hasExistingMessages = !forceNewConversation && Boolean(messages?.length);
      let greeting = "Hello! Main ZeniaOne Assistant hoon. Kahiye, aaj main aapki kya help karoon?";
      let synthLang = "hi-IN";
      if (langModeRef.current === "gujarati") {
        greeting = "નમસ્તે! હું ZeniaOne આસિસ્ટન્ટ છું. કહો, હું તમારી શું મદદ કરી શકું?";
        synthLang = "gu-IN";
      } else if (langModeRef.current === "english") {
        greeting = "Hello! I'm your ZeniaOne Assistant. How can I help you today?";
        synthLang = "en-IN";
      }

      if (!hasExistingMessages) {
        onMessagesUpdate("", greeting);
        welcomeTextRef.current = greeting;
        speakingTextRef.current = greeting;
        lastBotSpokenTextRef.current = greeting;
        if (engineModeRef.current !== "gemini_live") {
          // Native Gemini Live speaks through its own audio stream. Clone
          // routes use the configured TTS voice for this greeting.
          let welcomeSettled = false;
          const welcomeTimer = window.setTimeout(() => {
            if (welcomeSettled || sessionTokenRef.current !== token || !mountedRef.current) return;
            welcomeSettled = true;
            setVoiceNotice("Voice provider is slow. Trying browser audio for the welcome message.");
            speakWithBrowserSynthesis(greeting, synthLang);
          }, 6000);
          speakPromiseRef.current = agentsApi.speak(companyId, agent.id, greeting);
          setVoiceState("connecting");
          speakPromiseRef.current
            .then((welcome) => {
              if (welcomeSettled || sessionTokenRef.current !== token || !mountedRef.current) return;
              welcomeSettled = true;
              window.clearTimeout(welcomeTimer);
              if (welcome?.audio_base64) {
                welcomeAudioRef.current = welcome.audio_base64;
                playMp3Audio(welcome.audio_base64);
              } else {
                speakWithBrowserSynthesis(greeting, synthLang);
              }
            })
            .catch(() => {
              if (!welcomeSettled && sessionTokenRef.current === token && mountedRef.current) {
                welcomeSettled = true;
                window.clearTimeout(welcomeTimer);
                speakWithBrowserSynthesis(greeting, synthLang);
              }
            });
        }
      }

      // 1. Microphone Request & Audio Pipeline Unlock
      console.log(`[VOICE] Microphone permission requested`);
      let micTimedOut = false;
      let stream: MediaStream | null = null;
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException("Browser microphone API is unavailable", "NotSupportedError");
        }
        const micPromise = navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        }).then((lateStream) => {
          // Release a permission grant that arrives after the timeout unless session is still active.
          if (micTimedOut) {
            if (mountedRef.current && sessionTokenRef.current === token) {
              console.log("[VOICE] Late microphone stream attached successfully");
              mediaStreamRef.current = lateStream;
              setVoiceNotice("");
            } else {
              lateStream.getTracks().forEach((track) => track.stop());
            }
          }
          return lateStream;
        });
        const micTimeout = new Promise<MediaStream>((_, reject) => {
          window.setTimeout(() => {
            micTimedOut = true;
            reject(new DOMException("Microphone permission timed out", "TimeoutError"));
          }, 20000);
        });
        stream = await Promise.race([micPromise, micTimeout]);
        console.log(`[VOICE] Microphone permission granted`);
        console.log(`[VOICE][SELFTEST] getUserMedia success`);
      } catch (micErr: any) {
        // Microphone input is optional for output-only welcome playback and
        // for starting the server session. Do not turn a blocked mic into a
        // website-wide voice failure; keep the route alive and show a notice.
        console.warn(`[VOICE] Microphone unavailable; continuing output-only`, micErr);
        const micErrorName = String(micErr?.name || "");
        const micNotice = micErrorName === "NotAllowedError"
          ? "Microphone is blocked. Welcome audio can still play; allow localhost microphone access to speak back."
          : micErrorName === "TimeoutError"
            ? "Microphone permission timed out. Check Chrome's permission prompt, then retry. Audio output can still play."
          : micErrorName === "NotFoundError"
            ? "No microphone found. Welcome audio can still play; connect a microphone for two-way voice."
            : "Microphone input is unavailable. Welcome audio can still play; check microphone access for two-way voice.";
        setVoiceNotice(micNotice);
      }

      if (sessionTokenRef.current !== token || !mountedRef.current) {
        stream?.getTracks().forEach(t => t.stop());
        return;
      }
      if (stream) {
        mediaStreamRef.current = stream;
        const audioTracks = stream.getAudioTracks();
        console.log(`[VOICE] Microphone track count=${audioTracks.length}`);
        if (audioTracks.length > 0) {
          console.log(`[VOICE] Microphone track state=${audioTracks[0].readyState}`);
          console.log(`[VOICE] Microphone track enabled=${audioTracks[0].enabled}`);
        }
        audioTracks.forEach(t => { t.enabled = !isMuted; });

        // Start session recording only when microphone input is available.
        try {
          const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
          recordingChunksRef.current = [];
          const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          recorder.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
          recorder.start(1000); // collect chunks every 1s
          mediaRecorderRef.current = recorder;
          console.log(`[VOICE] Session recording started mimeType=${mimeType || "default"}`);
        } catch (e) {
          console.warn("[VOICE] Could not start session recorder:", e);
        }
      }


      // Immediately unlock browser audio context from click/mount path
      if (!pcmAudioContextRef.current) {
        pcmAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        pcmNextStartTimeRef.current = pcmAudioContextRef.current.currentTime + 0.1;
      }
      if (pcmAudioContextRef.current.state === "suspended") {
        pcmAudioContextRef.current.resume().catch(e => console.error("[VOICE][ERROR] AudioContext resume failed", e));
      }
      console.log(`[VOICE] AudioContext state=${pcmAudioContextRef.current.state}`);
      console.log(`[VOICE] AudioContext sampleRate=${pcmAudioContextRef.current.sampleRate}`);

      // 2. Conversation Creation
      // A voice session must never inherit a Web Chat/Admin Copilot record.
      // Keep one channel per history row so analytics and labels stay true.
      let activeConv = forceNewConversation ? null : convIdRef.current;
      if (!activeConv) {
        try {
          const cRes = await agentsApi.createConversation(companyId, agent.id, "voice_chat");
          activeConv = cRes.conversation_id;
          console.log(`[VOICE] Conversation created`);
          onConvIdChange(activeConv);
          convIdRef.current = activeConv;
        } catch (err: any) {
          setErrorMsg("Failed to start conversation. Please try again.");
          setVoiceState("error");
          return;
        }
      }
      if (sessionTokenRef.current !== token || !mountedRef.current) return;

      // Output-only mode: play the greeting and offer a microphone retry.
      // A clone pipeline cannot receive user speech without a mic.
      if (!stream && engineModeRef.current !== "gemini_live") return;

      // 3. Open the live stream (the greeting was already started above).
      if (hasExistingMessages) {
        console.log("[VOICE] Resuming existing chat. Skipping welcome TTS.");
        connectWebSocketAndListen(token, activeConv!);
        return;
      }
      // Native Gemini Live owns the welcome audio. Clone routes already
      // started local TTS and therefore pass no server greeting.
      connectWebSocketAndListen(token, activeConv!, engineModeRef.current === "gemini_live" ? greeting : "");

    } catch (err: any) {
      console.error(`[VOICE][ERROR] Microphone initialization failed`);
      console.error(`[VOICE][ERROR] Microphone error name=${err?.name}`);
      console.error(`[VOICE][ERROR] Microphone error message=${err?.message}`);
      if (sessionTokenRef.current === token && mountedRef.current) {
        const micErrorName = String(err?.name || "");
        const selectedRoute = engineModeRef.current === "gemini_live"
          ? "Gemini Live S2S"
          : engineModeRef.current === "gemini_clone"
            ? "Gemini + Clone"
            : "Clone · Pipeline";
        const routeDescription = engineModeRef.current === "gemini_live"
          ? "native Gemini audio"
          : engineModeRef.current === "gemini_clone"
            ? "Gemini STT → configured LLM → cloned voice"
            : "browser STT → configured LLM → cloned voice";
        const micErrorMessage = micErrorName === "NotAllowedError"
          ? `Route: ${selectedRoute} (${routeDescription}). Microphone permission is blocked. Allow microphone for localhost in the browser address-bar settings, then tap Retry microphone.`
          : micErrorName === "NotFoundError"
            ? `Route: ${selectedRoute}. No microphone was found. Connect a microphone and tap Retry microphone.`
            : micErrorName === "NotReadableError"
              ? `Route: ${selectedRoute}. The microphone is busy in another app. Close that app and tap Retry microphone.`
              : micErrorName === "AbortError"
                ? `Route: ${selectedRoute}. Microphone startup was interrupted. Tap Retry microphone.`
                : `Route: ${selectedRoute}. Microphone could not start. Check browser permission and tap Retry microphone.`;
        setErrorMsg(micErrorMessage);
        setVoiceState("error");
      }
    }
  }, [agent, companyId, onConvIdChange, connectWebSocketAndListen, handleUserInterrupt, playMp3Audio, setVoiceState, speakWithBrowserSynthesis]);

  // Initial auto-start
  useEffect(() => {
    console.log(`[VOICE_OPEN_TRUE] timestamp=${new Date().toISOString()}`);
    startVoiceSession(true, true);
    
    return () => { 
        if (mountedRef.current && voiceStateRef.current !== "idle") {
            console.error(`[VOICE][ERROR] Unexpected Voice Mode unmount`);
        }
        releaseAll("component_unmount"); 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tell the operator immediately when another admin screen publishes a new
  // routing profile. The current WebSocket cannot be switched mid-turn, so
  // the notice deliberately says that the next voice session will use it.
  useEffect(() => {
    const onRoutingUpdated = (event: StorageEvent) => {
      if (event.key !== "zeniaone:voice-routing-updated" || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue) as { engine?: string };
        if (!["pipeline", "gemini_live", "gemini_clone"].includes(String(payload.engine))) return;
        const nextEngine = payload.engine as "pipeline" | "gemini_live" | "gemini_clone";
        setNextEngine(nextEngine);
        const nextLabel = nextEngine === "gemini_live"
          ? "Gemini Live S2S"
          : nextEngine === "gemini_clone"
            ? "Gemini + Clone"
            : "Clone · Pipeline";
        setVoiceNotice(`Route updated: ${nextLabel}. End and start Voice Chat again to use this route.`);
      } catch {
        // Ignore malformed local routing events.
      }
    };
    window.addEventListener("storage", onRoutingUpdated);
    return () => window.removeEventListener("storage", onRoutingUpdated);
  }, []);

  // State label mapper
  const stateLabel: Record<VoiceState, string> = {
    idle: "Ready",
    starting: "Starting…",
    connecting: "Connecting…",
    listening: "Listening",
    processing: "Thinking…",
    thinking: "Thinking…",
    speaking: "Speaking",
    error: "Connection issue",
    ended: "Voice Mode ended",
  };
  const routeLabel = engineMode === "gemini_live"
    ? "Gemini Live S2S"
    : engineMode === "gemini_clone"
      ? "Gemini + Clone"
      : "Clone · Pipeline";
  const routeReply = engineMode === "gemini_live"
    ? "Gemini Live replies with native audio"
    : engineMode === "gemini_clone"
      ? `Gemini replies · ${outputVoice === "browser" ? "browser voice fallback" : "Sarvam clone"} speaks`
      : `Configured LLM replies · ${outputVoice === "browser" ? "browser voice fallback" : "Sarvam clone"} speaks`;

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
        {/* Top row: agent identity + voice badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-[#3E5448] flex items-center justify-center shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="white" strokeLinecap="round">
                <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
            <span className="text-[13px] font-semibold text-[#1C2421]">Voice Mode</span>
            <span className="text-[11px] text-[#8EA89F]">·</span>
            <span className="text-[11px] text-[#68706C] font-medium">
              {agent.name || "ZeniaOne Assistant"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* The active route is read-only; changes are published in AI Routing. */}
            <span
              title={`Current engine: ${
                engineMode === "gemini_live"
                  ? "Gemini Live S2S"
                  : engineMode === "gemini_clone"
                    ? "Gemini + Clone Voice"
                    : "Classic Pipeline"
              }. Change it in AI Routing for the next session.`}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 shadow-sm border ${
                engineMode === "gemini_live"
                  ? "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white border-blue-400 shadow-blue-500/25 shadow-md"
                  : "bg-white text-[#3E5448] border-[#D1DFD9]"
              }`}
            >
              <span className="text-xs transition-transform duration-300">
                {engineMode === "gemini_live" ? "⚡" : "🎙️"}
              </span>
              <span className="text-[10px] font-bold tracking-tight">
                {engineMode === "gemini_live"
                  ? "Gemini Live S2S"
                  : engineMode === "gemini_clone"
                    ? "Gemini + Clone"
                    : "Clone · Pipeline"}
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold uppercase tracking-wider ${
                engineMode === "gemini_live" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
              }`}>
                {engineMode === "gemini_live" ? "Native audio" : `${Number((agent as any).voice_speed || (agent as any).speed || 1.15).toFixed(1)}× speed`}
              </span>
            </span>

            <button
              onClick={() => {
                let nextMode: VoiceLangMode = "hinglish";
                let recLang = "en-IN";
                if (langMode === "hinglish") {
                  nextMode = "hindi";
                  recLang = "hi-IN";
                } else if (langMode === "hindi") {
                  nextMode = "english";
                  recLang = "en-IN";
                } else if (langMode === "english") {
                  nextMode = "gujarati";
                  recLang = "gu-IN";
                } else {
                  nextMode = "hinglish";
                  recLang = "en-IN";
                }
                setLangMode(nextMode);
                langModeRef.current = nextMode;
                if (recognitionRef.current) {
                  try {
                    recognitionRef.current.lang = recLang;
                    console.log(`[VOICE] Recognition language switched to ${recLang} (${nextMode})`);
                  } catch (e) {}
                }
              }}
              title="Click to switch: Hinglish (Roman) / Hindi / English / Gujarati"
              className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-[#D1DFD9] rounded-full px-2.5 py-1 transition-all shadow-sm cursor-pointer"
            >
              <span className="text-xs">
                {langMode === "gujarati" ? "🇮🇳" : langMode === "english" ? "🇬🇧" : langMode === "hindi" ? "🇮🇳" : "🇮🇳"}
              </span>
              <span className="text-[10px] font-semibold text-[#3E5448]">
                {langMode === "gujarati" 
                  ? "ગુજરાતી (Gujarati)" 
                  : langMode === "english" 
                  ? "English" 
                  : langMode === "hindi" 
                  ? "हिंदी (Hindi)" 
                  : "Hinglish (Roman)"}
              </span>
            </button>
            <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 border transition-all ${
              engineMode === "gemini_live"
                ? "bg-blue-50/80 border-blue-200 text-blue-900"
                : "bg-white border-[#E3E3DF] text-[#3E5448]"
            }`}>
              <Volume2 className={`h-3 w-3 ${engineMode === "gemini_live" ? "text-blue-600" : "text-[#5F786D]"}`} />
              <span className="text-[10px] font-semibold">
                {outputVoice === "gemini" ? "Native Gemini voice" : outputVoice === "browser" ? "Browser voice fallback" : "Cloned voice"}
              </span>
            </div>
          </div>
        </div>

        {/* Center area: orb + status */}
        <div className="flex items-center gap-5 py-1">
          {/* Orb */}
          <button
            onClick={handleUserInterrupt}
            disabled={voiceState !== "speaking"}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5F786D] rounded-full flex-shrink-0"
            aria-label={voiceState === "speaking" ? "Tap to interrupt AI" : "Voice orb"}
          >
            <CompactOrb state={voiceState} />
          </button>

          {/* Status + transcript */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-[15px] font-semibold leading-none mb-1 transition-colors duration-200 ${voiceState === "listening" ? "text-[#3E5448]"
                  : voiceState === "speaking" ? "text-[#3E5448]"
                    : voiceState === "error" ? "text-red-600"
                      : "text-[#68706C]"
                }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {stateLabel[voiceState]}
            </p>

            {voiceState === "listening" && !liveTranscript && (
              <p className="text-[11px] text-[#A0A8A4] leading-none">
                {(!mediaStreamRef.current?.active || audioContextRef.current?.state !== "running" || wsRef.current?.readyState !== WebSocket.OPEN) 
                  ? "Connecting microphone…" 
                  : isSpeakingUser 
                    ? "Listening · Hearing you…" 
                    : isMuted 
                      ? "Microphone muted" 
                      : "Listening · Speak now..."}
              </p>
            )}

            {voiceNotice && voiceState !== "error" && (
              <p className="mt-1 inline-flex max-w-full items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium leading-tight text-amber-800">
                {voiceNotice}
              </p>
            )}

            {audioNeedsGesture && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await pcmAudioContextRef.current?.resume();
                    if (pcmAudioContextRef.current?.state === "running") setAudioNeedsGesture(false);
                    if (welcomeAudioRef.current && pcmActiveSourcesRef.current.length === 0) {
                      await playMp3Audio(welcomeAudioRef.current);
                    } else if (engineModeRef.current !== "gemini_live" && welcomeTextRef.current) {
                      speakWithBrowserSynthesis(welcomeTextRef.current, agent.default_language || "hi-IN");
                    }
                  } catch {
                    setVoiceNotice("Browser audio is blocked. Allow sound for localhost, then tap Enable audio again.");
                  }
                }}
                className="mt-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-900"
              >
                Enable audio
              </button>
            )}

            {voiceNotice && !mediaStreamRef.current?.active && voiceState !== "error" && (
              <button
                type="button"
                onClick={() => {
                  releaseAll("retry_microphone");
                  window.setTimeout(() => {
                    if (mountedRef.current) startVoiceSession(true, true);
                  }, 150);
                }}
                className="ml-2 rounded-full border border-[#B2C7BF] bg-white px-2 py-1 text-[10px] font-semibold text-[#3E5448]"
              >
                Retry microphone
              </button>
            )}

            <p className="mt-1 text-[10px] font-medium leading-tight text-[#6E8178]" aria-live="polite">
              Current session: <span className="font-semibold text-[#3E5448]">{routeLabel}</span>
              <span className="mx-1 text-[#A0A8A4]">·</span>
              {routeReply}
            </p>
            {nextEngine && nextEngine !== engineMode && (
              <p className="mt-1 text-[10px] font-medium text-amber-800">
                Next session: {nextEngine === "gemini_live" ? "Gemini Live S2S" : nextEngine === "gemini_clone" ? "Gemini + Clone" : "Clone · Pipeline"}
              </p>
            )}

            {voiceState === "speaking" && (
              <p className="text-[11px] text-[#A0A8A4] leading-none">
                {agent.name || "ZeniaOne Assistant"} is speaking…
              </p>
            )}

            {(voiceState === "processing" || voiceState === "thinking") && (
              <p className="text-[11px] text-[#A0A8A4] leading-none inline-flex items-center gap-1">
                Processing your request
                <span className="inline-flex gap-0.5" aria-label="AI is thinking">
                  <span className="h-1 w-1 rounded-full bg-[#8EA89F] animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1 w-1 rounded-full bg-[#8EA89F] animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1 w-1 rounded-full bg-[#8EA89F] animate-bounce" />
                </span>
              </p>
            )}

            {liveTranscript && (
              <p className="text-[12px] text-[#5F786D] font-medium line-clamp-3 break-words text-left leading-tight mt-0.5 max-w-full">
                &ldquo;{liveTranscript}&rdquo;
              </p>
            )}

            {voiceState === "error" && errorMsg && (
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-[11px] text-red-500 leading-tight line-clamp-2">
                  {errorMsg}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    releaseAll("retry_microphone");
                    window.setTimeout(() => {
                      if (mountedRef.current) startVoiceSession(false, true);
                    }, 150);
                  }}
                  className="shrink-0 rounded-full border border-[#B2C7BF] bg-white px-2 py-1 text-[10px] font-semibold text-[#3E5448] hover:bg-[#EEF7F1]"
                >
                  Retry microphone
                </button>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                console.log(`[VOICE] Mute button clicked`);
                const newState = !isMuted;
                console.log(newState ? `[VOICE] Microphone muted` : `[VOICE] Microphone unmuted`);
                setIsMuted(newState);
              }}
              className={`h-9 w-9 flex items-center justify-center rounded-full border transition-colors ${isMuted
                  ? "bg-red-50 border-red-200 text-red-500"
                  : "bg-white border-[#E3E3DF] text-[#68706C] hover:border-[#B2C7BF] hover:text-[#3E5448]"
                }`}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              aria-pressed={isMuted}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); endVoiceChat(); }}
              className="h-9 flex items-center gap-1.5 px-3 rounded-full bg-[#3E5448] hover:bg-[#2A3D34] text-white text-[12px] font-semibold transition-colors shadow-sm"
              aria-label="End voice chat session"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">End Voice Chat</span>
            </button>
          </div>
        </div>

        {/* Recording player — appears after session ends */}
        {sessionRecordingUrl && voiceState === "idle" && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-3 bg-[#F0F5F2] border border-[#C8DDD6] rounded-xl px-3 py-2">
              <div className="h-7 w-7 rounded-full bg-[#3E5448] flex items-center justify-center shrink-0">
                <Play className="h-3 w-3 text-white ml-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#3E5448]">🎙️ Voice Session Recording</p>
                <audio controls src={sessionRecordingUrl} className="h-6 w-full mt-1" />
              </div>
              <a
                href={sessionRecordingUrl}
                download="voice-session.webm"
                className="h-7 w-7 rounded-full bg-white border border-[#C8DDD6] flex items-center justify-center text-[#3E5448] hover:bg-[#E8F0EC] transition-colors"
                title="Download recording"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { VoiceModeDock as VoiceModeOverlay };

