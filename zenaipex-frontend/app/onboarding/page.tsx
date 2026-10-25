"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/hooks/use-branding";
import { BrandLogo } from "@/components/ui/brand-logo";
import { CheckCircle2, ArrowRight, Loader2, Sparkles, Building2, Bot, Check, ArrowLeft, Volume2, Globe, MessagesSquare, CheckCircle } from "lucide-react";
import { useCurrentCompany } from "@/hooks/use-company";
import { Combobox } from "@/components/ui/combobox";
import { INDUSTRIES } from "@/lib/data/industries";
import { COUNTRIES } from "@/lib/data/countries";
import { LANGUAGES } from "@/lib/data/languages";
import { VOICES } from "@/lib/data/voices";
import { agentsApi } from "@/lib/api/agents";

const STEPS = ["Welcome", "Company", "AI Agent", "Finish"];

export default function OnboardingWizard() {
  const { platformName } = useBranding();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { companyId } = useCurrentCompany();
  const [companyName, setCompanyName] = useState<string>("");

  // Company Form State
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [companyErrors, setCompanyErrors] = useState<{industry?: string; country?: string}>({});
  
  // Agent Form State
  const [agentName, setAgentName] = useState("");
  const [agentRole, setAgentRole] = useState("");
  const [voice, setVoice] = useState("anushka");
  const [language, setLanguage] = useState("en-IN");
  const [agentErrors, setAgentErrors] = useState<{name?: string; role?: string}>({});
  const [isGeneratingRole, setIsGeneratingRole] = useState(false);
  
  // Final state
  const [createdAgentName, setCreatedAgentName] = useState("");

  useEffect(() => {
    // If onboarding is already completed, redirect to dashboard
    if (companyId) {
      fetchApi(`/companies/${companyId}`).then((res: any) => {
        setCompanyName(res.name || "");
        if (res.onboarding_completed) {
          router.push("/dashboard");
        }
      }).catch(() => {});
    }
  }, [companyId, router]);

  const handleNext = async () => {
    setErrorMsg(null);
    if (currentStep === 1) { // Company Step
      const errors: {industry?: string; country?: string} = {};
      if (!industry) errors.industry = "Please select your industry.";
      if (!country) errors.country = "Please select your country.";
      
      if (Object.keys(errors).length > 0) {
        setCompanyErrors(errors);
        return;
      }
      setCompanyErrors({});
      
      setIsLoading(true);
      try {
        await fetchApi(`/companies/${companyId}/onboarding`, {
          method: "PATCH",
          body: JSON.stringify({ industry, country })
        });
        setCurrentStep(2);
      } catch (err: any) {
        console.error("Failed to update company", err);
        setErrorMsg(err.message || "We couldn't save your workspace details. Please try again.");
      } finally {
        setIsLoading(false);
      }
    } else if (currentStep === 2) { // Agent Step
      const errors: {name?: string; role?: string} = {};
      const trimmedName = agentName.trim();
      const trimmedRole = agentRole.trim();
      
      if (!trimmedName) errors.name = "Please enter a name for your agent.";
      else if (trimmedName.length < 2) errors.name = "Agent name must be at least 2 characters.";
      
      if (!trimmedRole) errors.role = "Please provide a role or purpose.";
      else if (trimmedRole.length < 10) errors.role = "Role description should be a bit more detailed (min 10 chars).";
      
      if (Object.keys(errors).length > 0) {
        setAgentErrors(errors);
        return;
      }
      setAgentErrors({});
      
      setIsLoading(true);
      try {
        await fetchApi(`/companies/${companyId}/agents/onboarding`, {
          method: "POST",
          body: JSON.stringify({
            name: trimmedName,
            system_prompt: trimmedRole,
            tts_voice: voice,
            default_language: language,
            supported_languages: [language]
          })
        });
        setCreatedAgentName(trimmedName);
        setCurrentStep(3);
      } catch (err: any) {
        console.error("Failed to create agent", err);
        setErrorMsg(err.message || "We couldn't create your AI agent. Please try again.");
      } finally {
        setIsLoading(false);
      }
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleFinish = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await fetchApi(`/companies/${companyId}/onboarding`, {
        method: "PATCH",
        body: JSON.stringify({ settings: { onboarding_completed: true } })
      });
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Failed to finish onboarding", err);
      setErrorMsg(err.message || "Failed to complete setup. Please try again.");
      setIsLoading(false);
    }
  };

  if (!companyId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
        <Loader2 className="h-8 w-8 animate-spin text-sage-600" />
      </div>
    );
  }

  // Live Agent Preview Component
  const handleGenerateRole = async () => {
    const trimmedName = agentName.trim() || "ZeniaOne Assistant";
    setIsGeneratingRole(true);
    setAgentErrors(prev => ({...prev, role: undefined}));
    try {
      const res = await agentsApi.generateRole(companyId!, trimmedName, companyName, industry, country);
      if (res.draft_role) {
        setAgentRole(res.draft_role);
      }
    } catch (err) {
      setAgentErrors(prev => ({...prev, role: "Unable to generate a draft right now. You can enter the role manually."}));
    } finally {
      setIsGeneratingRole(false);
    }
  };

  const getActiveVoice = () => VOICES.find(v => v.id === voice) || VOICES[0];
  const getActiveLanguage = () => LANGUAGES.find(l => l.id === language) || LANGUAGES[0];

  const AgentPreview = () => (
    <div className="hidden lg:flex flex-col border-l border-slate-100 pl-8 w-full max-w-sm">
      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Live Preview</div>
      <div className="flex flex-col h-[400px] rounded-[20px] border border-stone-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
        
        {/* Header */}
        <div className="bg-sage-50 px-4 py-4 flex items-center gap-3 border-b border-sage-100/50">
          <div className="bg-white p-2 rounded-full shadow-sm border border-sage-100">
            <Bot className="h-6 w-6 text-sage-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold text-slate-900 truncate flex items-center gap-2">
              {agentName.trim() || "ZeniaOne Assistant"}
              <span className="flex items-center text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wide">
                <span className="relative flex h-1.5 w-1.5 mr-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Online
              </span>
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              AI assistant for {companyName || "your business"}
            </div>
          </div>
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 bg-[#FAF9F6] p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Assistant Message Bubble */}
          <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-white p-3.5 rounded-2xl rounded-tl-none border border-stone-200/60 shadow-sm text-[13px] leading-relaxed text-slate-700 max-w-[85%] relative">
              <p>Hi, I'm {agentName.trim() || "your AI assistant"} from {companyName || "our team"}. How can I help you today?</p>
            </div>
          </div>

          {/* Suggestion Chips */}
          <div className="flex flex-col items-end gap-2 mt-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
            <div className="bg-white px-3 py-1.5 rounded-full border border-stone-200 shadow-sm text-xs text-slate-600 hover:bg-stone-50 cursor-pointer transition-colors">
              How can you help?
            </div>
            <div className="bg-white px-3 py-1.5 rounded-full border border-stone-200 shadow-sm text-xs text-slate-600 hover:bg-stone-50 cursor-pointer transition-colors">
              What can you do?
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-stone-100 p-3 flex flex-col gap-2">
          <div className="relative">
            <input 
              disabled 
              placeholder={`Ask ${agentName.trim() || "Assistant"} anything...`} 
              className="w-full bg-stone-50 border border-stone-200 rounded-full px-4 py-2 text-xs text-slate-600 focus:outline-none cursor-not-allowed"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-sage-600 flex items-center justify-center shadow-sm opacity-50">
              <ArrowRight className="h-3 w-3 text-white" />
            </div>
          </div>
          <div className="flex justify-between items-center px-2 pt-1 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
            <span className="flex items-center gap-1"><Volume2 className="h-3 w-3" /> {getActiveVoice().name}</span>
            <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {getActiveLanguage().nativeName}</span>
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      {/* Premium Ambient Background Shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-sage-100/50 blur-3xl animate-[spin_40s_linear_infinite] opacity-60"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-stone-200/50 blur-3xl animate-[spin_30s_linear_infinite_reverse] opacity-60"></div>
        <div className="absolute top-1/4 right-1/4 w-1/3 h-1/3 rounded-full bg-sage-50/50 blur-3xl animate-pulse opacity-40"></div>
      </div>

      <div className="relative z-10 w-full max-w-[900px] flex flex-col items-center space-y-8 animate-in fade-in duration-700">
        
        {/* Branding */}
        <div className="flex flex-col items-center">
          <BrandLogo iconSize={36} textSize="text-2xl" />
        </div>

        {/* Progress Stepper - Desktop */}
        <div className="hidden sm:flex w-full max-w-2xl justify-between items-center relative px-8">
          <div className="absolute left-10 right-10 top-1/2 h-0.5 -translate-y-1/2 bg-slate-200 z-0">
            <div 
              className="h-full bg-sage-500 transition-all duration-700 ease-in-out" 
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
          {STEPS.map((step, idx) => (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors duration-500 bg-white ${
                idx < currentStep ? 'border-sage-500 text-sage-600' : 
                idx === currentStep ? 'border-sage-600 text-sage-600 ring-4 ring-sage-100' : 
                'border-slate-200 text-slate-300'
              }`}>
                {idx < currentStep ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-sm font-medium">{idx + 1}</span>}
              </div>
              <span className={`text-xs font-semibold uppercase tracking-wider transition-colors duration-500 absolute top-10 whitespace-nowrap ${
                idx <= currentStep ? 'text-sage-900' : 'text-slate-400'
              }`}>
                {step}
              </span>
            </div>
          ))}
        </div>
        
        {/* Progress Stepper - Mobile */}
        <div className="sm:hidden flex items-center justify-center w-full">
          <span className="text-sm font-semibold uppercase tracking-wider text-sage-800">
            Step {currentStep + 1} of {STEPS.length}: <span className="text-slate-500">{STEPS[currentStep]}</span>
          </span>
        </div>

        {/* Main Card */}
        <div className="w-full mt-8 sm:mt-12">
          <Card className="shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-stone-200/60 bg-white/95 backdrop-blur-sm overflow-hidden transition-all duration-500">
            {errorMsg && (
              <div className="mx-8 mt-8 rounded-md bg-red-50 p-4 border border-red-100 animate-in fade-in slide-in-from-top-2">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">{errorMsg}</h3>
                  </div>
                </div>
              </div>
            )}

            <div className="p-8 sm:p-12 relative">
              {currentStep === 0 && (
                <div className="flex flex-col items-center text-center animate-in fade-in duration-700">
                  
                  {/* Central Capability Cluster */}
                  <div className="relative mb-8 mt-2">
                    {/* Breathing Ambient Glow */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-sage-400/20 rounded-full blur-2xl animate-[pulse_8s_ease-in-out_infinite] pointer-events-none" />
                    
                    <div className="grid grid-cols-2 gap-3 relative z-10">
                      {/* AI */}
                      <div className="flex items-center justify-center gap-2 bg-white/70 backdrop-blur-sm px-5 py-3 rounded-[14px] border border-stone-100/80 shadow-[0_2px_8px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgb(0,0,0,0.04)] animate-in fade-in zoom-in-95 duration-500 fill-mode-both" style={{ animationDelay: '0ms' }}>
                        <Sparkles className="h-4 w-4 text-sage-600" />
                        <span className="text-sm font-medium text-stone-700">AI</span>
                      </div>
                      
                      {/* Voice */}
                      <div className="flex items-center justify-center gap-2 bg-white/70 backdrop-blur-sm px-5 py-3 rounded-[14px] border border-stone-100/80 shadow-[0_2px_8px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgb(0,0,0,0.04)] animate-in fade-in zoom-in-95 duration-500 fill-mode-both" style={{ animationDelay: '80ms' }}>
                        <Volume2 className="h-4 w-4 text-stone-500" />
                        <span className="text-sm font-medium text-stone-700">Voice</span>
                      </div>
                      
                      {/* Knowledge */}
                      <div className="flex items-center justify-center gap-2 bg-white/70 backdrop-blur-sm px-5 py-3 rounded-[14px] border border-stone-100/80 shadow-[0_2px_8px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgb(0,0,0,0.04)] animate-in fade-in zoom-in-95 duration-500 fill-mode-both" style={{ animationDelay: '160ms' }}>
                        <Globe className="h-4 w-4 text-stone-500" />
                        <span className="text-sm font-medium text-stone-700">Knowledge</span>
                      </div>
                      
                      {/* Automation */}
                      <div className="flex items-center justify-center gap-2 bg-white/70 backdrop-blur-sm px-5 py-3 rounded-[14px] border border-stone-100/80 shadow-[0_2px_8px_rgb(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-[2px] hover:shadow-[0_4px_12px_rgb(0,0,0,0.04)] animate-in fade-in zoom-in-95 duration-500 fill-mode-both" style={{ animationDelay: '240ms' }}>
                        <MessagesSquare className="h-4 w-4 text-sage-600" />
                        <span className="text-sm font-medium text-stone-700">Automation</span>
                      </div>
                    </div>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3 tracking-tight">Welcome to {platformName}</h1>
                  
                  <p className="text-base leading-relaxed text-stone-500 max-w-[280px] sm:max-w-sm mx-auto mb-8">
                    Let's set up your AI workspace in a few simple steps.
                  </p>
                  
                  <Button onClick={handleNext} size="lg" className="w-full sm:w-auto px-8 h-11 bg-sage-600 hover:bg-sage-700 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-[2px] group">
                    Get Started <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </Button>
                </div>
              )}

              {currentStep === 1 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Set up your company</h2>
                    <p className="text-slate-500 mt-1">Tell {platformName} a little about your business so your workspace can be configured correctly.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-2">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4" /> Business Details
                      </div>
                      <Label htmlFor="industry" className="text-sm font-medium text-slate-700">Industry</Label>
                      <Combobox
                        id="industry"
                        options={INDUSTRIES}
                        value={industry}
                        onChange={(value) => {
                          setIndustry(value);
                          if (value) setCompanyErrors(prev => ({...prev, industry: undefined}));
                        }}
                        placeholder="Select your industry..."
                        searchPlaceholder="Search industries..."
                        className={companyErrors.industry ? '[&>[role=combobox]]:border-red-300 [&>[role=combobox]]:ring-1 [&>[role=combobox]]:ring-red-100' : ''}
                      />
                      {companyErrors.industry && <p className="text-sm text-red-500 mt-1 animate-in fade-in">{companyErrors.industry}</p>}
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4" /> Location
                      </div>
                      <Label htmlFor="country" className="text-sm font-medium text-slate-700">Country</Label>
                      <Combobox
                        id="country"
                        options={COUNTRIES}
                        value={country}
                        onChange={(value) => {
                          setCountry(value);
                          if (value) setCompanyErrors(prev => ({...prev, country: undefined}));
                        }}
                        placeholder="Select your country..."
                        searchPlaceholder="Search country..."
                        className={companyErrors.country ? '[&>[role=combobox]]:border-red-300 [&>[role=combobox]]:ring-1 [&>[role=combobox]]:ring-red-100' : ''}
                      />
                      {companyErrors.country && <p className="text-sm text-red-500 mt-1 animate-in fade-in">{companyErrors.country}</p>}
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100">
                    <Button variant="ghost" onClick={() => setCurrentStep(0)} disabled={isLoading} className="text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button onClick={handleNext} disabled={isLoading} className="bg-sage-600 hover:bg-sage-700 h-10 px-6 shadow-sm group">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Continue <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-500 flex flex-col lg:flex-row gap-8 lg:gap-12">
                  <div className="flex-1 min-w-0">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Configure your AI agent</h2>
                      <p className="text-slate-500 mt-1">Give your first agent a role, personality, and purpose.</p>
                    </div>
                    
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="agentName" className="text-sm font-medium text-slate-700">Agent Name</Label>
                        <Input 
                          id="agentName" 
                          placeholder="e.g. Front Desk Receptionist" 
                          value={agentName}
                          onChange={(e) => {
                            setAgentName(e.target.value);
                            if (e.target.value.trim().length >= 2) setAgentErrors(prev => ({...prev, name: undefined}));
                          }}
                          className={`h-11 ${agentErrors.name ? 'border-red-300 ring-1 ring-red-100 focus-visible:ring-red-400' : 'focus-visible:ring-sage-500'}`}
                        />
                        {agentErrors.name && <p className="text-sm text-red-500 mt-1 animate-in fade-in">{agentErrors.name}</p>}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="agentRole" className="text-sm font-medium text-slate-700">Role / Purpose</Label>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handleGenerateRole}
                            disabled={isGeneratingRole}
                            className="h-7 px-2 text-xs font-medium text-sage-600 hover:text-sage-700 hover:bg-sage-50 transition-colors"
                          >
                            {isGeneratingRole ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                            Generate with AI
                          </Button>
                        </div>
                        <textarea 
                          id="agentRole" 
                          placeholder="You are a helpful customer support assistant. Answer queries politely and concisely." 
                          className={`flex min-h-[100px] w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${agentErrors.role ? 'border-red-300 ring-1 ring-red-100 focus-visible:ring-red-400' : 'border-slate-200 focus-visible:ring-sage-500'}`}
                          value={agentRole}
                          onChange={(e) => {
                            setAgentRole(e.target.value);
                            if (e.target.value.trim().length >= 10) setAgentErrors(prev => ({...prev, role: undefined}));
                          }}
                        />
                        {agentErrors.role ? (
                          <p className="text-sm text-red-500 mt-1 animate-in fade-in">{agentErrors.role}</p>
                        ) : (
                          <p className="text-xs text-slate-500">Defines how your AI behaves and responds.</p>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="language" className="text-sm font-medium text-slate-700">Language</Label>
                          <Combobox
                            id="language"
                            options={LANGUAGES.map(l => ({ 
                              value: l.id, 
                              label: l.name, 
                              disabled: !l.enabled 
                            }))}
                            value={language}
                            onChange={(value) => {
                              if (value) {
                                setLanguage(value);
                                // Check if current voice is still supported
                                const activeVoice = VOICES.find(v => v.id === voice);
                                if (activeVoice && activeVoice.supportedLanguages && !activeVoice.supportedLanguages.includes(value)) {
                                  // Fallback to first supported enabled voice
                                  const fallbackVoice = VOICES.find(v => v.enabled && (!v.supportedLanguages || v.supportedLanguages.includes(value)));
                                  if (fallbackVoice) setVoice(fallbackVoice.id);
                                }
                              }
                            }}
                            placeholder="Select language..."
                            searchPlaceholder="Search language..."
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="voice" className="text-sm font-medium text-slate-700">Voice</Label>
                          <Combobox
                            id="voice"
                            options={VOICES.map(v => {
                              const isSupported = !v.supportedLanguages || v.supportedLanguages.includes(language);
                              return {
                                value: v.id,
                                label: `${v.name} (${v.gender})`,
                                disabled: !v.enabled || !isSupported,
                              };
                            })}
                            value={voice}
                            onChange={(value) => {
                              if (value) setVoice(value);
                            }}
                            placeholder="Select voice..."
                            searchPlaceholder="Search voices..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-100">
                      <Button variant="ghost" onClick={() => setCurrentStep(1)} disabled={isLoading} className="text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                      </Button>
                      <Button onClick={handleNext} disabled={isLoading} className="bg-sage-600 hover:bg-sage-700 h-10 px-6 shadow-sm group">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create Agent <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Live Preview */}
                  <AgentPreview />
                </div>
              )}

              {currentStep === 3 && (
                <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-sage-100 p-4 rounded-full mb-6 w-20 h-20 flex items-center justify-center border-4 border-white shadow-sm relative">
                    <div className="absolute inset-0 bg-sage-200 rounded-full animate-ping opacity-20"></div>
                    <CheckCircle className="h-10 w-10 text-sage-600 relative z-10" />
                  </div>
                  
                  <h1 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Your ZeniaOne workspace is ready.</h1>
                  <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                    Your company and AI agent setup has been completed successfully.
                  </p>

                  <div className="w-full max-w-sm bg-stone-50/50 border border-stone-100 rounded-2xl p-6 text-left mb-10 shadow-sm hover:shadow-md transition-shadow">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-4 text-center">Setup Summary</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg border border-stone-100 shadow-sm mt-0.5">
                          <Building2 className="h-4 w-4 text-sage-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">Company</div>
                          <div className="text-sm text-slate-500">{companyName || "Ready"}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg border border-stone-100 shadow-sm mt-0.5">
                          <Bot className="h-4 w-4 text-sage-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">AI Agent</div>
                          <div className="text-sm text-slate-500">{createdAgentName || "Configured"}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg border border-stone-100 shadow-sm mt-0.5">
                          <CheckCircle2 className="h-4 w-4 text-sage-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">Status</div>
                          <div className="text-sm text-slate-500">Workspace Ready</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleFinish} size="lg" className="w-full sm:w-auto px-10 h-12 bg-sage-600 hover:bg-sage-700 text-base shadow-md group" disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Go to Dashboard <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
