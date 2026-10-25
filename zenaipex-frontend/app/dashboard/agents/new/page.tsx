"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { agentsApi } from "@/lib/api/agents";
import { useCurrentCompany } from "@/hooks/use-company";
import { ArrowLeft, Loader2, Bot, Languages, Settings2, Database, Mic, Sparkles, Volume2, Play, Square } from "lucide-react";
import Link from "next/link";
import { VOICES, getVoiceById, getVoiceAcoustics, findBrowserVoice } from "@/lib/data/voices";
import { useRef, useEffect } from "react";
import { SmartSelect } from "@/components/ui/smart-select";

export default function CreateAgentPage() {
  const router = useRouter();
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    system_prompt: "You are a helpful AI assistant for our company. You answer phone calls clearly and concisely. You never break character.",
    default_language: "en-IN",
    tts_voice: "ritu",
  });

  const handleTogglePreview = async (voiceId: string) => {
    const vObj = getVoiceById(voiceId);
    if (previewingVoiceId === vObj.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setPreviewingVoiceId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setPreviewingVoiceId(vObj.id);

    const fallbackBrowser = () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const acoustics = getVoiceAcoustics(vObj.id);
        const utterance = new SpeechSynthesisUtterance(vObj.sampleText);
        utterance.lang = "en-IN";
        utterance.rate = acoustics.rate;
        utterance.pitch = acoustics.pitch;
        const synthVoices = window.speechSynthesis.getVoices();
        const match = findBrowserVoice(synthVoices, acoustics.isMale, "en-IN", vObj.sampleText, vObj.id);
        if (match) utterance.voice = match;
        utterance.onend = () => setPreviewingVoiceId(null);
        utterance.onerror = () => setPreviewingVoiceId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setPreviewingVoiceId(null);
      }
    };

    try {
      if (!companyId) {
        fallbackBrowser();
        return;
      }
      const res = await agentsApi.previewVoice(companyId, vObj.id, vObj.sampleText, "hi-IN");
      if (res && res.audio_base64 && !res.fallback_tts) {
        const isWav = res.audio_base64.startsWith("UklG");
        const mimeType = isWav ? "audio/wav" : "audio/mp3";
        const audio = new Audio(`data:${mimeType};base64,${res.audio_base64}`);
        previewAudioRef.current = audio;
        audio.onended = () => setPreviewingVoiceId(null);
        audio.onerror = () => fallbackBrowser();
        await audio.play();
      } else {
        fallbackBrowser();
      }
    } catch {
      fallbackBrowser();
    }
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      await agentsApi.create(companyId, formData);
      router.push("/dashboard/agents");
    } catch (err: any) {
      setError(err.message || "Failed to create agent");
    } finally {
      setIsLoading(false);
    }
  }

  if (isCompanyLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-sage-600" />
        <p className="text-sm font-medium text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/agents">
          <Button variant="outline" size="icon" className="h-9 w-9 border-slate-200">
            <ArrowLeft className="h-4 w-4 text-slate-500" />
          </Button>
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create New AI Agent</h2>
          <p className="text-sm text-slate-500">Configure your voice assistant's persona, language, and behavior.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-sage-600" />
              <CardTitle>Basic Information</CardTitle>
            </div>
            <CardDescription>Give your agent a name and description.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-slate-700">Agent Name <span className="text-red-500">*</span></Label>
                <Input 
                  id="name" 
                  required 
                  placeholder="e.g., Customer Support Bot"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-slate-50/50 focus-visible:ring-sage-600"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-slate-700">Description</Label>
                <Input 
                  id="description" 
                  placeholder="Handles incoming support queries"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="bg-slate-50/50 focus-visible:ring-sage-600"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Behavior */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-sage-600" />
              <CardTitle>AI Behavior</CardTitle>
            </div>
            <CardDescription>Define how your agent talks and behaves.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="system_prompt" className="text-sm font-medium text-slate-700">System Instructions <span className="text-red-500">*</span></Label>
              <textarea 
                id="system_prompt" 
                required
                rows={6}
                className="flex w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sage-600 focus-visible:bg-white"
                placeholder="You are a helpful assistant..."
                value={formData.system_prompt}
                onChange={(e) => setFormData({...formData, system_prompt: e.target.value})}
              />
              <p className="text-xs text-slate-500">Defines the agent's persona. This is the master prompt sent to the LLM. You can use {'{company_name}'} and {'{caller_phone}'} as dynamic variables.</p>
            </div>
          </CardContent>
        </Card>

        {/* Language & Voice */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <div className="flex items-center gap-2">
                <Languages className="h-5 w-5 text-emerald-600" />
                <CardTitle>Language</CardTitle>
              </div>
              <CardDescription>Select primary spoken language.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label htmlFor="language" className="text-sm font-medium text-slate-700">Primary Language <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <SmartSelect id="language" value={formData.default_language} onChange={(value) => setFormData({...formData, default_language: value})} searchable={false} options={[{value:"en-IN",label:"English (India)"},{value:"hi-IN",label:"Hindi"},{value:"ta-IN",label:"Tamil"},{value:"te-IN",label:"Telugu"}]} />
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">Powered by Sarvam AI multilingual models.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mic className="h-5 w-5 text-amber-500" />
                  <CardTitle>Voice Profile</CardTitle>
                </div>
                <button
                  type="button"
                  onClick={() => handleTogglePreview(formData.tts_voice)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-sage-800 bg-white border border-sage-200 hover:bg-sage-50 px-3 py-1 rounded-full shadow-2xs transition-all cursor-pointer"
                >
                  {previewingVoiceId === formData.tts_voice ? (
                    <>
                      <Square className="h-3 w-3 fill-current" /> Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3 fill-current ml-0.5" /> Listen Sample
                    </>
                  )}
                </button>
              </div>
              <CardDescription>Select the agent&apos;s natural text-to-speech voice.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="voice" className="text-sm font-medium text-slate-700">TTS Voice <span className="text-red-500">*</span></Label>
                  <div className="relative mt-1.5">
                    <SmartSelect id="voice" value={formData.tts_voice} onChange={(value) => setFormData({...formData, tts_voice: value})} searchPlaceholder="Search voices…" options={VOICES.map(v => ({value:v.id,label:v.name,description:v.tone,badge:v.gender,group:`${v.gender} voices`}))} />
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                    </div>
                  </div>
                </div>

                {/* Active selected voice summary */}
                {(() => {
                  const currentVoice = getVoiceById(formData.tts_voice);
                  return (
                    <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-xs text-slate-600">
                      <div className="font-semibold text-slate-800 mb-0.5">{currentVoice.name} — {currentVoice.tone}</div>
                      <div>{currentVoice.description}</div>
                    </div>
                  );
                })()}

                <p className="mt-1 text-xs text-slate-500">Powered by Sarvam Bulbul v3 with real-time Indian multilingual synthesis.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Knowledge & Status */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-teal-600" />
              <CardTitle>Knowledge Base (Optional)</CardTitle>
            </div>
            <CardDescription>Connect documents for Retrieval-Augmented Generation (RAG).</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <Settings2 className="mt-0.5 h-5 w-5 text-amber-600" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-900">Knowledge bases are managed separately</h4>
                  <p className="mt-1 text-sm text-amber-800">
                    To connect a knowledge base, first create it in the Knowledge Base tab. You can attach it to this agent later from the agent settings.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2 pb-10">
          <Button type="button" variant="outline" className="border-slate-300" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" className="bg-sage-600 hover:bg-sage-700" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Agent...
              </>
            ) : (
              "Create AI Agent"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
