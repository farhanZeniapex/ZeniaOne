"use client";

import React, { useState, useRef } from "react";
import { Mic, Upload, Play, X, Sliders, CheckCircle2, Loader2, StopCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "@/lib/api/client";
import { SmartSelect } from "@/components/ui/smart-select";

export function VoiceCloningStudio({
  isOpen,
  onClose,
  onVoiceCreated
}: {
  isOpen: boolean;
  onClose: () => void;
  onVoiceCreated?: (voice: any) => void;
}) {
  const [activeTab, setActiveTab] = useState<"upload" | "record">("upload");
  const [voiceName, setVoiceName] = useState("");
  const [gender, setGender] = useState("Female");
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testText, setTestText] = useState("");
  const [clonedVoiceId, setClonedVoiceId] = useState<string | null>(null);
  const [promptLang, setPromptLang] = useState<"hi" | "en">("hi");
  const [recordWarning, setRecordWarning] = useState<string | null>(null);
  const [smartError, setSmartError] = useState<{ title?: string; message: string; type?: "error" | "warning" } | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Real waveform analyzer state
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
        video: false,
      });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 0) {
          const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
          const file = new File([audioBlob], `recorded_voice.${ext}`, { type: mimeType });
          setAudioFile(file);
        } else {
          setSmartError({
            title: "Empty Recording",
            message: "Recording was too short or empty. Please record 10–15 seconds of continuous speech.",
            type: "warning"
          });
          setAudioFile(null);
        }
      };

      // Set up Audio Analyser for real-time waveform
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 128; // gives 64 frequency bins
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      
      const updateAudioData = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        if (waveformRef.current) {
          const children = waveformRef.current.children;
          // Voice frequencies are mostly in the lower bins. 
          // We take the first 20 bins and mirror them (20 left, 20 right) for a symmetrical pro look!
          for (let i = 0; i < 20; i++) {
            // Apply a slight boost to the values for better visual response
            const val = Math.min(255, dataArray[i] * 1.5);
            const height = Math.max(10, (val / 255) * 100);
            
            // Left side (mirrored)
            if (children[19 - i]) (children[19 - i] as HTMLElement).style.height = `${height}%`;
            // Right side
            if (children[20 + i]) (children[20 + i] as HTMLElement).style.height = `${height}%`;
          }
        }
        
        animationFrameRef.current = requestAnimationFrame(updateAudioData);
      };
      updateAudioData();

      mediaRecorderRef.current.start(250);
      setIsRecording(true);
      setRecordingTime(0);
      setRecordWarning(null);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 14) {
            // Reached Sarvam recommended max (15 seconds)
            setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                mediaRecorderRef.current.stop();
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                setIsRecording(false);
              }
            }, 500);
            return 15;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (err) {
      setSmartError({
        title: "Microphone Access Blocked",
        message: "Could not access your microphone. Please enable microphone permissions in your browser.",
        type: "error"
      });
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (recordingTime < 8) {
        setRecordWarning("Recording is under 8s. Sarvam AI requires 10 to 15 seconds of speech for high accuracy.");
      } else {
        setRecordWarning(null);
      }
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Cleanup analyzer
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      
      // Reset waveform visually
      if (waveformRef.current) {
        Array.from(waveformRef.current.children).forEach((child: any) => {
          child.style.height = '10%';
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!voiceName.trim() || !audioFile) return;

    setIsSubmitting(true);
    setSmartError(null);
    try {
      const formData = new FormData();
      formData.append("name", voiceName);
      formData.append("gender", gender);
      formData.append("file", audioFile);

      let companyId = localStorage.getItem("zenaipex_active_company_id") || "admin_workspace";
      if (companyId === "default") companyId = "admin_workspace";
      const token = localStorage.getItem("zenaipex_token");

      const res = await fetch(`${API_BASE_URL}/companies/${companyId}/voices/clone`, {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const detailMsg = errData?.detail || "Voice sample was rejected by the provider. Please try again with clear speech.";
        setSmartError({
          title: "Voice Provider Notice",
          message: detailMsg,
          type: "error"
        });
        return;
      }
      
      const data = await res.json();
      if (data?.voice?.voice_id) {
        setClonedVoiceId(data.voice.voice_id);
        if (onVoiceCreated) {
          onVoiceCreated(data.voice);
        }
      } else {
        setSmartError({
          title: "Voice Creation Issue",
          message: "Voice was created but no ID was returned. Please refresh and check your voice list.",
          type: "warning"
        });
      }
    } catch (err: any) {
      setSmartError({
        title: "Connection Notice",
        message: err?.message || "Could not reach the server to clone voice. Please verify network connection.",
        type: "error"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-[450px] flex flex-col overflow-hidden shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-700 z-10">
          <X className="h-4 w-4" />
        </button>
        
        {/* Top Side: Actions */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 pr-8">
            <h2 className="text-xl font-semibold text-[#191614] flex items-center gap-2">
              <Mic className="h-5 w-5 text-[#3E5448]" /> Create Voice
            </h2>
          </div>

          {!clonedVoiceId ? (
            <>
              <div className="mb-6 flex gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-semibold text-[#5E5A54] mb-2 block">Voice Name</Label>
                  <Input 
                    placeholder="e.g. Rahul's Professional Voice" 
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className="bg-[#FAF9F7] border-[#E5E5E3] focus-visible:ring-[#3E5448]"
                  />
                </div>
                <div className="w-1/3">
                  <Label className="text-sm font-semibold text-[#5E5A54] mb-2 block">Gender</Label>
                  <SmartSelect
                    value={gender}
                    onChange={setGender}
                    searchable={false}
                    options={[{ value: "Female", label: "Female" }, { value: "Male", label: "Male" }]}
                    className="[&>button]:h-10 [&>button]:rounded-md [&>button]:border-[#E5E5E3] [&>button]:bg-[#FAF9F7]"
                  />
                </div>
              </div>

              {/* Tabs */}
              <div className="flex bg-[#F3F4F1] p-1 rounded-2xl mb-6 shadow-inner">
                <button 
                  onClick={() => setActiveTab("upload")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === "upload" ? "bg-white text-[#191614] shadow-sm shadow-black/5" : "text-[#7A9184] hover:text-[#3E5448]"}`}
                >
                  <Upload className={`h-4 w-4 ${activeTab === "upload" ? "text-emerald-500" : ""}`} /> Upload
                </button>
                <button 
                  onClick={() => setActiveTab("record")}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === "record" ? "bg-white text-[#191614] shadow-sm shadow-black/5" : "text-[#7A9184] hover:text-[#3E5448]"}`}
                >
                  <Mic className={`h-4 w-4 ${activeTab === "record" ? "text-emerald-500" : ""}`} /> Record
                </button>
              </div>

              {/* Tab Content */}
              <div 
                className={`relative overflow-hidden bg-[#FAF9F7] p-8 rounded-2xl border-2 min-h-[200px] flex flex-col items-center justify-center text-center transition-all duration-300 ${
                  activeTab === 'upload' 
                    ? 'border-dashed border-[#C5D0C9] cursor-pointer hover:bg-emerald-50/50 hover:border-emerald-400 group' 
                    : 'border-solid border-[#E5E5E3]'
                }`}
                onClick={() => {
                  if (activeTab === "upload") {
                    document.getElementById('audio-upload-input')?.click();
                  }
                }}
              >
                {activeTab === "upload" ? (
                  <>
                    <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 group-hover:shadow-emerald-500/20">
                      <Upload className="h-6 w-6 text-emerald-500" />
                    </div>
                    <p className="text-sm font-bold text-[#191614] mb-1">Click to browse files</p>
                    <p className="text-xs text-[#7A9184] mb-4 max-w-[200px]">Upload 20–30 seconds of clean speech. MP3, WAV, WEBM supported.</p>
                    <input 
                      id="audio-upload-input"
                      type="file" 
                      accept="audio/*"
                      onChange={(e) => { setAudioFile(e.target.files?.[0] || null); setSmartError(null); }}
                      className="hidden"
                    />
                    {audioFile && (
                      <div className="mt-4 flex flex-col items-center gap-3 w-full animate-in slide-in-from-bottom-2 duration-300">
                        <div className="text-xs font-bold text-emerald-700 bg-emerald-100 px-4 py-2 rounded-full flex items-center gap-2 shadow-sm border border-emerald-200">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {audioFile.name}
                        </div>
                        <audio 
                          controls 
                          src={URL.createObjectURL(audioFile)} 
                          className="w-full max-w-xs h-10" 
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-stone-700 mb-2">Record your voice live</p>
                    <p className="text-xs text-stone-500 italic mb-6 max-w-[200px]">Read a short script to let the AI capture your exact tone and emotion.</p>
                    
                    <Button onClick={() => setIsRecordModalOpen(true)} className="bg-[#3E5448] hover:bg-[#2C3B32] rounded-full text-white px-6">
                      <Mic className="h-4 w-4 mr-2" /> Open Recording Studio
                    </Button>
                    
                    {audioFile && activeTab === "record" && !isRecording && (
                      <div className="mt-6 flex flex-col items-center gap-3 w-full animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 text-sm text-green-600 font-bold bg-green-50 px-4 py-1.5 rounded-full border border-green-200">
                          <CheckCircle2 className="h-4 w-4" /> Recording Ready
                        </div>
                        <audio 
                          controls 
                          src={URL.createObjectURL(audioFile)} 
                          className="w-full max-w-xs h-10" 
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Smart Error / Notice Banner */}
              {smartError && (
                <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-red-50 to-amber-50 border border-rose-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 relative text-left">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0 mt-0.5 text-rose-600">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 pr-6">
                      <h4 className="text-xs font-bold text-rose-900 tracking-wide uppercase mb-1">
                        {smartError.title || "Voice Sample Notice"}
                      </h4>
                      <p className="text-xs text-rose-800 leading-relaxed font-medium">
                        {smartError.message}
                      </p>
                      {(smartError.message.includes("short") || smartError.message.includes("rejected") || smartError.message.includes("Sarvam") || smartError.message.includes("noise")) && (
                        <div className="mt-2.5 text-[11px] text-rose-800/90 bg-white/80 p-2.5 rounded-xl border border-rose-200/60 flex flex-col gap-1 shadow-xs">
                          <span className="font-bold text-rose-900">💡 Quick Guide for 100% Success:</span>
                          <span>• Speak continuously for 10–15 seconds without stopping early.</span>
                          <span>• Record in a quiet room with minimal background noise.</span>
                          <span>• Start speaking within 0.5s of hitting record.</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSmartError(null)}
                      className="absolute top-3 right-3 text-rose-400 hover:text-rose-700 p-1 rounded-full hover:bg-rose-100/60 transition-colors"
                      title="Dismiss"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                <Button 
                  onClick={handleSubmit} 
                  disabled={!voiceName || !audioFile || isSubmitting}
                  className={`w-full h-12 text-sm font-bold shadow-lg transition-all ${
                    voiceName && audioFile 
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' 
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cloning Voice...</>
                  ) : voiceName && audioFile ? (
                    <><Mic className="h-4 w-4 mr-2" /> Clone My Voice</>
                  ) : (
                    "Waiting for Name & Audio..."
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-full py-12">
              <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-bold text-[#191614] mb-2">Voice Cloned Successfully!</h3>
              <p className="text-stone-500 mb-8">Your unique voice is now ready to be used by ZeniaOne agents.</p>
              
              <div className="w-full bg-[#FAF9F7] p-4 rounded-xl border border-[#E5E5E3] text-left">
                <Label className="text-sm font-semibold text-[#5E5A54] mb-2 block">Live Voice Test (The Wow Factor ✨)</Label>
                <div className="flex gap-2">
                  <Input 
                    value={testText}
                    onChange={(e) => setTestText(e.target.value)}
                    placeholder="Type something to hear it in your voice..."
                    className="bg-white"
                  />
                  <Button 
                    onClick={async () => {
                      if (!testText || !clonedVoiceId) return;
                      let companyId = localStorage.getItem("zenaipex_active_company_id") || "admin_workspace";
                      if (companyId === "default") companyId = "admin_workspace";
                      const token = localStorage.getItem("zenaipex_token");
                      const formData = new FormData();
                      formData.append("voice_id", clonedVoiceId);
                      formData.append("text", testText);
                      
                      try {
                        const res = await fetch(`${API_BASE_URL}/companies/${companyId}/voices/test`, {
                          method: "POST",
                          body: formData,
                          headers: { "Authorization": `Bearer ${token}` }
                        });
                        const data = await res.json();
                        if (data.audio_b64) {
                          const isWav = data.audio_b64.startsWith("UklG");
                          const mimeType = isWav ? "audio/wav" : "audio/mp3";
                          const snd = new Audio(`data:${mimeType};base64,${data.audio_b64}`);
                          snd.play().catch(err => {
                            console.error("Audio playback error:", err);
                            // Fallback to SpeechSynthesis if audio play fails
                            const utterance = new SpeechSynthesisUtterance(testText);
                            window.speechSynthesis.speak(utterance);
                          });
                        }
                      } catch(e) {
                        setSmartError({
                          title: "Audio Test Notice",
                          message: "Could not preview the voice test audio. Please try again.",
                          type: "warning"
                        });
                      }
                    }}
                    className="bg-[#3E5448] hover:bg-[#2C3B32] text-white shrink-0"
                  >
                    <Play className="h-4 w-4 mr-2" /> Test
                  </Button>
                </div>
              </div>

              <Button onClick={onClose} className="mt-8 bg-[#3E5448] hover:bg-[#2C3B32] text-white w-full">
                Done & Assign Voice
              </Button>
            </div>
          )}
      </div>

      {isRecordModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-8 flex flex-col items-center justify-center text-slate-800 relative shadow-2xl border border-slate-200">
            
            <button onClick={() => { handleStopRecording(); setIsRecordModalOpen(false); }} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold mb-1 tracking-wide text-slate-900">Record your Voice for AI Clone</h3>
            
            {/* Duration status pill */}
            <div className="flex items-center gap-3 mb-6">
              <div className={`font-mono text-sm px-4 py-1.5 rounded-full border transition-all flex items-center gap-2 ${
                recordingTime >= 10 && recordingTime <= 15
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-bold shadow-sm'
                  : recordingTime > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-400'}`}></span>
                <span>{String(Math.floor(recordingTime / 60)).padStart(2, '0')}:{String(recordingTime % 60).padStart(2, '0')} / 00:15s</span>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {recordingTime >= 10 
                  ? "✨ Optimal length reached! (10-15s)" 
                  : isRecording 
                  ? "🎙️ Keep speaking (at least 10s needed)" 
                  : "Target: 10–15 seconds"}
              </span>
            </div>

            {/* Language switch tabs for sample script */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-bold">
              <button 
                type="button"
                onClick={() => setPromptLang("hi")}
                className={`px-3 py-1.5 rounded-lg transition-all ${promptLang === "hi" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                🇮🇳 Hindi / Hinglish
              </button>
              <button 
                type="button"
                onClick={() => setPromptLang("en")}
                className={`px-3 py-1.5 rounded-lg transition-all ${promptLang === "en" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                🌐 English
              </button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-8 max-w-lg text-center shadow-inner">
              <p className="text-base font-medium leading-relaxed text-slate-800">
                {promptLang === "hi" 
                  ? "“नमस्ते, यह मेरी आवाज़ की रिकॉर्डिंग है जिसे मैं अपने AI वॉइस असिस्टेंट के लिए बना रहा हूँ। मैं एक शांत कमरे में बिना रुके साफ़-साफ़ बोल रहा हूँ ताकि मेरी आवाज़ बिलकुल सटीक और साफ़ क्लोन हो सके।”"
                  : "“Hello, this is a test recording to create my custom AI voice clone. I am speaking clearly and naturally in a quiet room so that the AI can accurately capture my unique tone, rhythm, and emotion.”"
                }
              </p>
            </div>

            {recordWarning && (
              <div className="mb-4 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl text-center max-w-md">
                ⚠️ {recordWarning}
              </div>
            )}

            {/* Real Waveform / Heartbeat */}
            <div ref={waveformRef} className="flex items-center justify-center h-24 w-full max-w-md gap-1 mb-12">
              {[...Array(40)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 bg-emerald-500 rounded-full transition-all duration-75`}
                  style={{ 
                    height: '10%',
                    opacity: isRecording ? 1 : 0.3
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-6">
              <button 
                onClick={() => { handleStopRecording(); setRecordingTime(0); }}
                className="flex items-center gap-2 text-slate-400 hover:text-emerald-600 transition-colors group"
              >
                <div className="h-10 w-10 rounded-full bg-slate-100 group-hover:bg-emerald-50 flex items-center justify-center transition-colors">
                  <Play className="h-4 w-4" style={{ transform: 'rotate(180deg)' }} />
                </div>
                <span className="text-sm font-bold">Restart</span>
              </button>

              <button 
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={`h-20 w-20 rounded-full flex items-center justify-center transition-all shadow-lg ${isRecording ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30 scale-110' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'}`}
              >
                {isRecording ? <StopCircle className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8 text-white" />}
              </button>

              <button 
                onClick={() => {
                  handleStopRecording();
                  setIsRecordModalOpen(false);
                }}
                disabled={!audioFile && !isRecording}
                className={`flex items-center gap-2 transition-colors group ${audioFile || isRecording ? 'text-slate-600 hover:text-emerald-600' : 'text-slate-300 cursor-not-allowed'}`}
              >
                <span className="text-sm font-bold">Done</span>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${audioFile || isRecording ? 'bg-slate-100 group-hover:bg-emerald-50' : 'bg-slate-50'}`}>
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </div>,
    document.body
  );
}
