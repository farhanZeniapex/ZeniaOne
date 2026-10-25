"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, AudioLines, Check, MessageCircle, Mic, MicOff, PhoneCall, Sparkles } from "lucide-react";
import styles from "./voice-core-hero.module.css";

type Mode = "chat" | "voice" | "calls";
const modes: Mode[] = ["chat", "voice", "calls"];
const modeCopy = {
  chat: { label: "Chat", title: "A helpful reply, right on time.", detail: "Questions answered in your brand's voice." },
  voice: { label: "Live voice", title: "A conversation that flows.", detail: "Speak naturally with your AI agent." },
  calls: { label: "Phone calls", title: "Every caller feels heard.", detail: "Your agent is ready when the phone rings." },
};

export function VoiceCoreHero() {
  const [mode, setMode] = useState<Mode>("chat");
  const [autoRotate, setAutoRotate] = useState(true);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState("");
  const coreRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const requestRef = useRef(0);

  const stopListening = () => {
    requestRef.current += 1;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    coreRef.current?.style.setProperty("--voice-level", "0");
    setListening(false);
  };

  useEffect(() => () => {
    requestRef.current += 1;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void contextRef.current?.close();
  }, []);

  useEffect(() => {
    if (!autoRotate || listening) return;
    const timer = window.setInterval(() => {
      setMode((current) => modes[(modes.indexOf(current) + 1) % modes.length]);
    }, 5400);
    return () => window.clearInterval(timer);
  }, [autoRotate, listening]);

  const selectMode = (nextMode: Mode) => {
    setAutoRotate(false);
    setMicError("");
    if (nextMode !== "voice") requestRef.current += 1;
    if (nextMode !== "voice" && listening) stopListening();
    setMode(nextMode);
  };

  const toggleVoicePulse = async () => {
    setAutoRotate(false);
    if (listening) {
      stopListening();
      return;
    }
    setMicError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Microphone preview is not available in this browser.");
      return;
    }
    const requestId = ++requestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (requestId !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      contextRef.current = context;
      const samples = new Uint8Array(analyser.frequencyBinCount);
      const measure = () => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) {
          const centered = (sample - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / samples.length);
        const level = Math.min(1, Math.max(0, (rms - 0.012) * 10));
        coreRef.current?.style.setProperty("--voice-level", level.toFixed(3));
        frameRef.current = requestAnimationFrame(measure);
      };
      setListening(true);
      measure();
    } catch {
      if (requestId !== requestRef.current) return;
      stopListening();
      setMicError("Allow microphone access to try the visual preview.");
    }
  };

  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.halo} aria-hidden="true" />
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}><Sparkles size={13} /> ONE INTELLIGENCE. EVERY CHANNEL.</span>
          <h1 id="hero-title">One agent.<br /><em>Every conversation.</em></h1>
          <p>Meet the AI agent that chats, speaks live, and answers calls — always with your business in mind.</p>
          <div className={styles.actions}>
            <Link href="#demo" className={styles.primaryCta}>Book a Demo <ArrowUpRight size={19} strokeWidth={1.8} /></Link>
            <Link href="#features" className={styles.secondaryCta}>Explore features <ArrowDownRight size={18} strokeWidth={1.8} /></Link>
          </div>
          <div className={styles.channelLine} aria-label="Chat, live voice, and phone calls">
            <span><MessageCircle size={16} /> Chat</span><i />
            <span><AudioLines size={17} /> Live voice</span><i />
            <span><PhoneCall size={16} /> Phone calls</span>
          </div>
        </div>

        <div ref={coreRef} className={`${styles.scene} ${listening ? styles.listening : ""}`} style={{ "--voice-level": 0 } as CSSProperties}>
          <div className={styles.sceneTop}>
            <span className={styles.sceneBrand}>Z<span>·</span>1 <small>CONVERSATION ENGINE</small></span>
            <span className={styles.sceneStatus}><span /> INTERACTIVE PREVIEW</span>
          </div>
          <div className={styles.coreStage} aria-hidden="true">
            <div className={styles.coreAtmosphere} />
            <div className={styles.orbitOuter} />
            <div className={styles.orbitMiddle} />
            <div className={styles.orbitInner} />
            <div className={styles.coreGlow} />
            <div className={styles.coreSphere}><div className={styles.sphereSheen} /><div className={styles.sphereDetail} /></div>
            <div className={styles.orbitPointOne} /><div className={styles.orbitPointTwo} />
          </div>
          <div className={`${styles.satellite} ${styles.satelliteChat} ${mode === "chat" ? styles.satelliteActive : ""}`} aria-hidden="true"><MessageCircle size={15} /><span>CHAT</span></div>
          <div className={`${styles.satellite} ${styles.satelliteVoice} ${mode === "voice" ? styles.satelliteActive : ""}`} aria-hidden="true"><AudioLines size={15} /><span>LIVE VOICE</span></div>
          <div className={`${styles.satellite} ${styles.satelliteCalls} ${mode === "calls" ? styles.satelliteActive : ""}`} aria-hidden="true"><PhoneCall size={15} /><span>CALLS</span></div>

          <div className={styles.sceneBottom}>
            <div className={styles.modeTabs} role="group" aria-label="Conversation preview mode">
              {modes.map((item) => (
                <button key={item} type="button" aria-pressed={mode === item} className={`${styles.modeTab} ${mode === item ? styles.modeTabActive : ""}`} onClick={() => selectMode(item)}>
                  {item === "chat" ? <MessageCircle size={15} /> : item === "voice" ? <AudioLines size={16} /> : <PhoneCall size={15} />}
                  {modeCopy[item].label}
                </button>
              ))}
            </div>
            <div className={styles.preview} role="group" aria-label={`${modeCopy[mode].label} preview`}>
              <div className={styles.previewIcon}>{mode === "chat" ? <MessageCircle size={21} /> : mode === "voice" ? <AudioLines size={22} /> : <PhoneCall size={20} />}</div>
              <div className={styles.previewText}><strong>{modeCopy[mode].title}</strong><span>{listening ? "Your voice is moving the core." : modeCopy[mode].detail}</span></div>
              {mode === "voice" ? (
                <button type="button" className={styles.micButton} onClick={toggleVoicePulse} aria-pressed={listening} aria-label={listening ? "Stop voice pulse preview" : "Try voice pulse preview"}>{listening ? <MicOff size={19} /> : <Mic size={19} />}</button>
              ) : mode === "calls" ? <span className={styles.callSignal} aria-hidden="true"><i /><i /><i /></span> : <span className={styles.chatCheck} aria-hidden="true"><Check size={17} /><Check size={17} /></span>}
            </div>
            <span className={styles.previewCaption}>{mode === "voice" ? "Tap mic to make the core react to your voice" : "A visual preview of your agent in action"}</span>
            {micError && <span className={styles.micError} role="status">{micError}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
