"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mic, FileText, Sparkles, Save, Loader2 } from "lucide-react";
import { CompanyProfile } from "@/lib/api/settings";
import { LANGUAGE_OPTIONS } from "../types";

export interface VoiceTabProps {
  defaultLanguage: string;
  setDefaultLanguage: (v: string) => void;
  defaultVoice: string;
  setDefaultVoice: (v: string) => void;
  inboundGreeting: string;
  setInboundGreeting: (v: string) => void;
  outboundGreeting: string;
  setOutboundGreeting: (v: string) => void;
  customerPolicies: string;
  setCustomerPolicies: (v: string) => void;
  generatingGreeting: "inbound" | "outbound" | null;
  generateAIGreeting: (type: "inbound" | "outbound") => Promise<void>;
  combinedVoiceOptions: Array<{ value: string; label: string }>;
  currentCompany: CompanyProfile | null;
  saveVoiceAndGreetings: () => Promise<void>;
  savingSection: string | null;
}

export default function VoiceTab({
  defaultLanguage,
  setDefaultLanguage,
  defaultVoice,
  setDefaultVoice,
  inboundGreeting,
  setInboundGreeting,
  outboundGreeting,
  setOutboundGreeting,
  customerPolicies,
  setCustomerPolicies,
  generatingGreeting,
  generateAIGreeting,
  combinedVoiceOptions,
  currentCompany,
  saveVoiceAndGreetings,
  savingSection,
}: VoiceTabProps) {
  return (
<Card className="border-[#D5E4DB] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#19372B] flex items-center gap-2">
                  <Mic size={19} className="text-[#087F5B]" />
                  Voice Persona, Greetings & Call Experience
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define voice tone, default language, inbound welcome message, outbound opener, and customer rules.
                </p>
              </div>
              <Button
                onClick={saveVoiceAndGreetings}
                disabled={savingSection === "voice" || !currentCompany}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "voice" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Voice & Greetings
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Default Platform Language
                </label>
                <select
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium focus:border-[#285A42] focus:outline-none"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Default Voice Persona
                </label>
                <select
                  value={defaultVoice}
                  onChange={(e) => setDefaultVoice(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium focus:border-[#285A42] focus:outline-none"
                >
                  {combinedVoiceOptions.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Inbound Welcome Greeting with AI Generate */}
            <div className="rounded-2xl border border-[#DDEBE1] bg-[#F9FCF9] p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#315342]">
                    Inbound Welcome Greeting
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Spoken automatically the instant a customer calls your phone numbers.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateAIGreeting("inbound")}
                  disabled={generatingGreeting !== null || !currentCompany}
                  className="border-[#B7D8C0] text-[#286044] hover:bg-[#EAF5ED] text-xs font-bold"
                >
                  {generatingGreeting === "inbound" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#087F5B]" />
                  )}
                  ✨ AI Generate Inbound
                </Button>
              </div>
              <Textarea
                rows={2}
                value={inboundGreeting}
                onChange={(e) => setInboundGreeting(e.target.value)}
                placeholder="Hello, thank you for calling ZeniaOne. How may I assist you today?"
                className="text-xs font-medium bg-white"
              />
            </div>

            {/* Outbound Greeting with AI Generate */}
            <div className="rounded-2xl border border-[#DDEBE1] bg-[#F9FCF9] p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[#315342]">
                    Outbound Campaign Greeting
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Spoken when the AI initiates an outbound phone call or appointment reminder.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateAIGreeting("outbound")}
                  disabled={generatingGreeting !== null || !currentCompany}
                  className="border-[#B7D8C0] text-[#286044] hover:bg-[#EAF5ED] text-xs font-bold"
                >
                  {generatingGreeting === "outbound" ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#087F5B]" />
                  )}
                  ✨ AI Generate Outbound
                </Button>
              </div>
              <Textarea
                rows={2}
                value={outboundGreeting}
                onChange={(e) => setOutboundGreeting(e.target.value)}
                placeholder="Hello! This is an automated update from ZeniaOne regarding your upcoming booking..."
                className="text-xs font-medium bg-white"
              />
            </div>

            {/* Customer Policies & Important Rules */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                <FileText size={13} className="text-[#087F5B]" /> Customer Policies & Operating Guidelines
              </label>
              <Textarea
                rows={4}
                value={customerPolicies}
                onChange={(e) => setCustomerPolicies(e.target.value)}
                placeholder="Provide cancellation policies, refund terms, appointment booking guidelines, or emergency disclaimers..."
                className="text-xs leading-relaxed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                The AI assistant strictly abides by these policies during live phone interactions and chats.
              </p>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={saveVoiceAndGreetings}
                disabled={savingSection === "voice" || !currentCompany}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "voice" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Voice & Greetings
              </Button>
            </div>
          </CardContent>
        </Card>
  );
}
