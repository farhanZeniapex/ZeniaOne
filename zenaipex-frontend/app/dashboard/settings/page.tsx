"use client";

import React, { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SmartSelect } from "@/components/ui/smart-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Building2, Key, Users2, Save, User, Shield, CreditCard, 
  Loader2, Bot, Book, Palette, Briefcase, Clock, AlertTriangle, 
  Image as ImageIcon, Upload, Trash2, CheckCircle2, ChevronRight, Sparkles
} from "lucide-react";
import { useCurrentCompany } from "@/hooks/use-company";
import { companySettingsApi, CompanyProfile, UserProfile } from "@/lib/api/settings";
import { fetchApi, getCompanyLogoUrl } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { agentsApi, Agent } from "@/lib/api/agents";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import SmartWeeklySchedule from "@/components/platform/settings/SmartWeeklySchedule";

const BUILT_IN_VOICES: ComboboxOption[] = [
  "Ritu", "Priya", "Neha", "Pooja", "Shreya", "Kavya", "Rahul", "Rohan", "Aditya", "Kabir", "Amit",
].map(name => ({ value: name.toLowerCase(), label: `${name} · Built-in voice` }));

const SETTINGS_SECTIONS = [
  { id: "general", label: "General & Branding", icon: Building2, group: "Organization" },
  { id: "team", label: "Team & Billing", icon: Users2, group: "Organization" },
  { id: "ai", label: "AI & Integrations", icon: Bot, group: "System" },
  { id: "security", label: "Account & Security", icon: Shield, group: "Personal" },
];

export default function SettingsPage() {
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("general");
  
  // Data States
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [workspaceAgents, setWorkspaceAgents] = useState<Agent[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<ComboboxOption[]>(BUILT_IN_VOICES);
  const [selectedDefaultAgent, setSelectedDefaultAgent] = useState("");
  const [selectedDefaultVoice, setSelectedDefaultVoice] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isInviting, setIsInviting] = useState(false);
  
  // Interaction States
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!companyId) {
      if (!isCompanyLoading) setIsLoading(false);
      return;
    }
    loadAllData();
  }, [companyId, isCompanyLoading]);

  async function loadAllData() {
    try {
      setIsLoading(true);
      const [compRes, userRes] = await Promise.all([
        companySettingsApi.getCompany(companyId!),
        companySettingsApi.getMe(),
      ]);
      setCompany(compRes);
      setUserProfile(userRes);
      setSelectedDefaultAgent(compRes.settings?.default_agent || "");
      setSelectedDefaultVoice(compRes.settings?.default_voice || "");

      try {
        const [agentsRes, voicesRes] = await Promise.all([
          agentsApi.list(companyId!),
          companySettingsApi.listCustomVoices(companyId!),
        ]);
        const agents = agentsRes.agents || [];
        setWorkspaceAgents(agents);
        const customVoices = (voicesRes.voices || []).map(voice => ({
          value: voice.voice_id || voice.id,
          label: `${voice.display_name || voice.name || "Custom voice"} · Cloned voice`,
        }));
        const knownVoiceNames = new Map([...BUILT_IN_VOICES, ...customVoices].map(voice => [voice.value, voice.label.split(" · ")[0]]));
        const agentVoices = agents
          .filter(agent => agent.tts_voice)
          .map(agent => ({ value: agent.tts_voice, label: `${knownVoiceNames.get(agent.tts_voice) || "Assigned agent voice"} · Used by ${agent.name}` }));
        const uniqueVoices = [...BUILT_IN_VOICES, ...customVoices, ...agentVoices]
          .filter((voice, index, list) => list.findIndex(item => item.value === voice.value) === index);
        setVoiceOptions(uniqueVoices);
      } catch (err) {
        console.error("Failed to load workspace AI options", err);
      }

      try {
        const subRes = await companySettingsApi.getSubscription(companyId!);
        setSubscription(subRes.subscription);
        setUsage(subRes.usage);
      } catch (err: any) {
        if (err?.status !== 403 && err?.status !== 402) console.error("Failed to load subscription data", err);
      }

      try {
        const teamRes = await companySettingsApi.getTeamMembers(companyId!);
        setTeamMembers(teamRes.members);
      } catch (err: any) {
        if (err?.status !== 403 && err?.status !== 402) console.error("Failed to load team data", err);
      }
      
    } catch (err) {
      console.error("Failed to load core settings data", err);
    } finally {
      setIsLoading(false);
    }
  }

  const showSaveToast = (text: string, type: "success" | "error" = "success") => {
    setSaveMessage({ text, type });
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleGenericSave = async (updates: Partial<CompanyProfile>, successMsg: string) => {
    if (!companyId || !company) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await companySettingsApi.updateCompany(companyId, updates);
      setCompany(res);
      showSaveToast(successMsg);
      
      // Dispatch an event so sidebar/header can re-fetch company details
      window.dispatchEvent(new CustomEvent("company-updated"));
    } catch (error: any) {
      if (error?.status === 403) {
        showSaveToast("Please verify your email address to update settings.", "error");
      } else {
        showSaveToast("Couldn't save your changes. Please try again.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompanySave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    handleGenericSave({
      name: formData.get("name") as string,
      industry: formData.get("industry") as string,
      country: formData.get("country") as string,
      timezone: formData.get("timezone") as string,
    }, "Company profile saved");
  };

  const handleBusinessInfoSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    handleGenericSave({
      settings: {
        ...company?.settings,
        legal_name: formData.get("legal_name") as string,
        business_email: formData.get("business_email") as string,
        phone: formData.get("phone") as string,
        website: formData.get("website") as string,
        address: formData.get("address") as string,
        business_description: formData.get("business_description") as string,
      }
    }, "Business information saved");
  };

  const handleAISave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    handleGenericSave({
      settings: {
        ...company?.settings,
        default_agent: selectedDefaultAgent,
        default_language: formData.get("default_language") as string,
        default_voice: selectedDefaultVoice,
        greeting_message: formData.get("greeting_message") as string,
      }
    }, "AI settings saved");
  };

  const handleInviteMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!companyId || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await companySettingsApi.inviteTeamMember(companyId, inviteEmail.trim(), inviteRole);
      const teamRes = await companySettingsApi.getTeamMembers(companyId);
      setTeamMembers(teamRes.members || []);
      setInviteEmail("");
      setInviteRole("member");
      showSaveToast("Team member added to this workspace.");
    } catch (error: any) {
      showSaveToast(error?.message || "Could not add this team member. They must have a registered account.", "error");
    } finally {
      setIsInviting(false);
    }
  };

  const handleMemberRoleChange = async (userId: string, role: string) => {
    if (!companyId) return;
    try {
      await companySettingsApi.updateTeamMember(companyId, userId, role);
      setTeamMembers(current => current.map(member => member.user_id === userId ? { ...member, role } : member));
      showSaveToast("Team member role updated.");
    } catch (error: any) {
      showSaveToast(error?.message || "Could not update team role.", "error");
    }
  };

  const handleRemoveMember = async (member: any) => {
    if (!companyId || !member?.user_id || !window.confirm(`Remove ${member.name || member.email} from this workspace?`)) return;
    try {
      await companySettingsApi.removeTeamMember(companyId, member.user_id);
      setTeamMembers(current => current.filter(item => item.user_id !== member.user_id));
      showSaveToast("Team member removed.");
    } catch (error: any) {
      showSaveToast(error?.message || "Could not remove this team member.", "error");
    }
  };

  const handleHoursSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    let parsedHours = undefined;
    try {
      parsedHours = JSON.parse(formData.get("business_hours") as string);
    } catch(e) {}

    handleGenericSave({
      settings: {
        ...company?.settings,
        business_hours: parsedHours,
      }
    }, "Business hours updated");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    
    setIsUploadingLogo(true);
    try {
      const res = await companySettingsApi.uploadCompanyLogo(companyId, file);
      setCompany(prev => prev ? {
        ...prev,
        settings: { 
          ...prev.settings, 
          logo_url: res.logo_url,
          logo_size: file.size,
          logo_uploaded_at: new Date().toISOString()
        }
      } : null);
      showSaveToast("Logo updated successfully");
      window.dispatchEvent(new CustomEvent("company-updated"));
    } catch (err: any) {
      showSaveToast(err.message || "Failed to upload logo", "error");
    } finally {
      setIsUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogoRemove = async () => {
    if (!companyId) return;
    setIsUploadingLogo(true);
    try {
      await companySettingsApi.removeCompanyLogo(companyId);
      setCompany(prev => prev ? {
        ...prev,
        settings: { ...prev.settings, logo_url: undefined }
      } : null);
      showSaveToast("Logo removed");
      window.dispatchEvent(new CustomEvent("company-updated"));
    } catch (err: any) {
      showSaveToast("Failed to remove logo", "error");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await companySettingsApi.updateMe({ name: formData.get("name") as string });
      setUserProfile(res);
      showSaveToast("Profile updated");
    } catch (error: any) {
      if (error?.status === 403) {
        showSaveToast("Please verify your email address to update user profile.", "error");
      } else {
        showSaveToast("Failed to update user profile.", "error");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveMessage(null);
    
    if (newPassword !== confirmPassword) {
      showSaveToast("New passwords do not match.", "error");
      return;
    }
    if (newPassword.length < 8) {
      showSaveToast("Password must be at least 8 characters.", "error");
      return;
    }

    setIsSaving(true);
    try {
      await companySettingsApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      showSaveToast("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      showSaveToast(error.message || "Failed to change password.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      await fetchApi("/auth/resend-verification", { method: "POST" });
      showSaveToast("Verification email sent! Please check your inbox.");
    } catch (error: any) {
      showSaveToast(error.message || "Failed to send verification email.", "error");
    }
  };

  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [autoFillKey, setAutoFillKey] = useState(0);

  const handleAutoFill = async () => {
    if (!companyId) return;
    setIsAutoFilling(true);
    showSaveToast("Extracting data from Knowledge Base... This may take a few seconds.");
    try {
      const data = await companySettingsApi.autoFillFromKB(companyId);
      if (data) {
        let updatedCompanyPayload: any = null;
        setCompany(prev => {
          if (!prev) return null;
          const newSettings = {
            ...prev.settings,
            legal_name: data.legal_name || prev.settings?.legal_name,
            business_email: data.business_email || prev.settings?.business_email,
            phone: data.phone || prev.settings?.phone,
            website: data.website || prev.settings?.website,
            address: data.address || prev.settings?.address,
            business_description: data.business_description || prev.settings?.business_description,
            business_hours: data.business_hours || prev.settings?.business_hours,
          };
          updatedCompanyPayload = {
            name: data.legal_name || prev.name,
            industry: data.industry || prev.industry,
            settings: newSettings
          };
          return {
            ...prev,
            ...updatedCompanyPayload
          };
        });
        
        if (updatedCompanyPayload) {
          await companySettingsApi.updateCompany(companyId, updatedCompanyPayload);
        }
        
        // Force DOM update for uncontrolled text inputs
        setTimeout(() => {
          const textFields = ["legal_name", "business_email", "phone", "website", "address", "business_description", "name", "industry"];
          textFields.forEach(id => {
            const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
            if (el && data[id]) {
              el.value = data[id];
            }
          });
          // Update the key to force re-render of components like SmartWeeklySchedule that rely on initial data
          setAutoFillKey(prev => prev + 1);
        }, 50);

        showSaveToast("Business info auto-filled and saved successfully!");
      }
    } catch (err: any) {
      showSaveToast(err.message || "Failed to auto-fill", "error");
    } finally {
      setIsAutoFilling(false);
    }
  };

  if (isLoading || isCompanyLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl animate-pulse space-y-6 py-6">
        <div className="h-9 w-52 rounded-lg bg-slate-200" />
        <div className="h-5 w-96 max-w-full rounded bg-slate-100" />
        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <div className="h-56 rounded-2xl border border-slate-100 bg-white" />
          <div className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6"><div className="h-6 w-48 rounded bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2"><div className="h-11 rounded-lg bg-slate-100" /><div className="h-11 rounded-lg bg-slate-100" /><div className="h-11 rounded-lg bg-slate-100" /><div className="h-11 rounded-lg bg-slate-100" /></div></div>
        </div>
      </div>
    );
  }

  if (!companyId) return null;

  // Group sections
  const groupedSections = SETTINGS_SECTIONS.reduce((acc, section) => {
    if (!acc[section.group]) acc[section.group] = [];
    acc[section.group].push(section);
    return acc;
  }, {} as Record<string, typeof SETTINGS_SECTIONS>);

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-slate-500">Manage your workspace configuration, profile, branding, and preferences.</p>
        </div>
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleAutoFill} 
          disabled={isAutoFilling}
          className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 bg-amber-50/50 shadow-sm transition-all"
        >
          {isAutoFilling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-amber-500" />}
          ✨ Auto-fill from Knowledge Base
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Sidebar Nav */}
        <nav className="w-full md:w-64 shrink-0 flex flex-col gap-6 sticky top-24">
          {Object.entries(groupedSections).map(([group, sections]) => (
            <div key={group}>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-3">
                {group}
              </h4>
              <ul className="space-y-1">
                {sections.map(section => (
                  <li key={section.id}>
                    <button
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                        activeSection === section.id 
                          ? section.group === "Danger" 
                            ? "bg-red-50 text-red-700" 
                            : "bg-sage-100 text-sage-900" 
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <section.icon className={cn("h-4 w-4", activeSection === section.id ? (section.group === "Danger" ? "text-red-600" : "text-sage-700") : "text-slate-400")} />
                        {section.label}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Content Area */}
        <div className="flex-1 w-full relative">
          
          {/* Toast Overlay */}
          {saveMessage && (
            <div className={cn(
              "absolute -top-14 right-0 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg border animate-in fade-in slide-in-from-top-2 z-50",
              saveMessage.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
            )}>
              {saveMessage.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-red-600" />}
              <span className="text-sm font-medium">{saveMessage.text}</span>
            </div>
          )}

          {/* Section: Company Profile */}
          {activeSection === "general" && (
            <form onSubmit={handleCompanySave} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">Company Profile</CardTitle>
                  <CardDescription>The core identity of your workspace.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Company Name</Label>
                      <Input id="name" name="name" defaultValue={company?.name || ""} required />
                      <p className="text-xs text-slate-500">This is displayed in the workspace selector.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industry">Industry</Label>
                      <Input id="industry" name="industry" defaultValue={company?.industry || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country (Code)</Label>
                      <Input id="country" name="country" defaultValue={company?.country || ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Input id="timezone" name="timezone" defaultValue={company?.timezone || ""} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Workspace ID (Read Only)</Label>
                      <Input defaultValue={companyId} disabled className="bg-slate-50 font-mono text-slate-500" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <Button type="submit" className="bg-sage-600 hover:bg-sage-700 min-w-[120px]" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"} 
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}

          {/* Section: Branding */}
          {activeSection === "general" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">Company Branding</CardTitle>
                  <CardDescription>Manage your company logo used across customer-facing interfaces.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row gap-8 items-start">
                    
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-32 w-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden relative shadow-inner">
                        {company?.settings?.logo_url ? (
                          <img 
                            src={getCompanyLogoUrl(companyId, company.settings.logo_url) || ""} 
                            alt="Company Logo" 
                            className="h-full w-full object-contain p-2" 
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-slate-300" />
                        )}
                        {isUploadingLogo && (
                          <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                            <Loader2 className="h-6 w-6 animate-spin text-sage-600" />
                          </div>
                        )}
                      </div>
                      {company?.settings?.logo_url && (
                        <div className="flex flex-col items-center mt-2">
                          {company.settings.logo_size && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              {Math.round(company.settings.logo_size / 1024)} KB
                            </span>
                          )}
                          {company.settings.logo_uploaded_at && (
                            <span className="text-[10px] text-slate-400">
                              {new Date(company.settings.logo_uploaded_at).toLocaleDateString()}
                            </span>
                          )}
                          <Button variant="ghost" size="sm" onClick={handleLogoRemove} className="text-red-600 hover:text-red-700 hover:bg-red-50 mt-1" disabled={isUploadingLogo}>
                            <Trash2 className="h-4 w-4 mr-2" /> Remove
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Upload new logo</h4>
                        <p className="text-sm text-slate-500 mt-1">Recommended format: Square PNG, JPG, or SVG, max 2MB.</p>
                      </div>
                      <input 
                        type="file" 
                        accept="image/png, image/jpeg, image/svg+xml" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                      />
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingLogo}>
                        <Upload className="h-4 w-4 mr-2" /> Choose Image
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Section: Business Information */}
          {activeSection === "general" && (
            <form onSubmit={handleBusinessInfoSave} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">Business Information</CardTitle>
                  <CardDescription>Operational details used by AI agents to answer customer questions.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="legal_name">Legal / Registered Name</Label>
                      <Input id="legal_name" name="legal_name" defaultValue={company?.settings?.legal_name || ""} placeholder="NovaCare LLC" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business_email">Public Email</Label>
                      <Input id="business_email" name="business_email" type="email" defaultValue={company?.settings?.business_email || ""} placeholder="contact@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Public Phone</Label>
                      <Input id="phone" name="phone" defaultValue={company?.settings?.phone || ""} placeholder="+1 (555) 000-0000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website URL</Label>
                      <Input id="website" name="website" type="url" defaultValue={company?.settings?.website || ""} placeholder="https://example.com" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Physical Address</Label>
                      <Input id="address" name="address" defaultValue={company?.settings?.address || ""} placeholder="123 Main St, City, Country" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="business_description">Business Description</Label>
                      <Textarea 
                        id="business_description" 
                        name="business_description" 
                        defaultValue={company?.settings?.business_description || ""} 
                        placeholder="Describe what your business does. Agents use this context." 
                        className="h-24 resize-none"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <Button type="submit" className="bg-sage-600 hover:bg-sage-700 min-w-[120px]" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"} 
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}

          {/* Section: Business Hours */}
          {activeSection === "general" && (
            <form key={`hours-${autoFillKey}`} onSubmit={handleHoursSave} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">Business Hours</CardTitle>
                  <CardDescription>Define when your business is considered "open". Agents can use this to route calls appropriately.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 mb-4">
                      <Label className="text-base font-semibold">Smart Weekly Schedule</Label>
                      <p className="text-xs text-slate-500">
                        Configure exact opening and closing hours for each day. Your AI agent will use these exact timings when answering customer inquiries.
                      </p>
                    </div>
                    <SmartWeeklySchedule initialSchedule={company?.settings?.business_hours} />
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <Button type="submit" className="bg-sage-600 hover:bg-sage-700 min-w-[120px]" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Hours"} 
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}

          {/* Section: AI Defaults */}
          {activeSection === "ai" && (
            <form onSubmit={handleAISave} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">AI & Agent Defaults</CardTitle>
                  <CardDescription>Set fallback behavior and global voice settings.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="default_agent">Default AI agent</Label>
                      <Combobox id="default_agent" value={selectedDefaultAgent} onChange={setSelectedDefaultAgent} placeholder="Choose an agent" searchPlaceholder="Search workspace agents..." emptyMessage="Create an agent first" options={workspaceAgents.map(agent => ({ value: agent.id, label: `${agent.name} · ${agent.status} · ${voiceOptions.find(voice => voice.value === agent.tts_voice)?.label.split(" · ")[0] || "voice assigned"}` }))} />
                      <p className="text-xs text-slate-500">New chat and voice sessions use this agent unless a channel has its own assignment.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default_language">Default Language</Label>
                      <Input id="default_language" name="default_language" defaultValue={company?.settings?.default_language || "en-US"} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default_voice">Default voice</Label>
                      <Combobox id="default_voice" value={selectedDefaultVoice} onChange={setSelectedDefaultVoice} placeholder="Choose a built-in or cloned voice" searchPlaceholder="Search voice library..." emptyMessage="No voice is available" options={voiceOptions} />
                      <p className="text-xs text-slate-500">Cloned voices and voices already used by your agents appear here automatically.</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="greeting_message">Global Greeting Message</Label>
                      <Textarea 
                        id="greeting_message" 
                        name="greeting_message" 
                        defaultValue={company?.settings?.greeting_message || ""} 
                        placeholder="Hello, welcome! How can I help you today?" 
                        className="h-20 resize-none"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <Button type="submit" className="bg-sage-600 hover:bg-sage-700 min-w-[120px]" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Defaults"} 
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}

          {/* Section: Team Members */}
          {activeSection === "team" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">Team Members</CardTitle>
                  <CardDescription>Manage who has access to this workspace.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {!userProfile?.is_verified ? (
                    <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg text-amber-800 text-sm flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      Please verify your email address to manage team members.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <form onSubmit={handleInviteMember} className="grid gap-3 rounded-2xl border border-sage-100 bg-sage-50/50 p-4 md:grid-cols-[1fr_150px_auto]">
                        <div className="space-y-1.5"><Label htmlFor="invite-email">Add registered user</Label><Input id="invite-email" type="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@company.com" required /></div>
                        <div className="space-y-1.5"><Label htmlFor="invite-role">Workspace role</Label><SmartSelect value={inviteRole} onChange={setInviteRole} id="invite-role" searchable={false} options={[{value:"member",label:"Member"},{value:"admin",label:"Admin"}]} /></div>
                        <Button type="submit" disabled={isInviting} className="self-end bg-sage-600 hover:bg-sage-700">{isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users2 className="mr-2 h-4 w-4" />}Add member</Button>
                      </form>
                      {teamMembers.map((member: any) => (
                        <div key={member.user_id} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-sage-100 flex items-center justify-center text-sage-700 font-semibold text-sm">
                              {member.name ? member.name.substring(0, 1).toUpperCase() : member.email.substring(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{member.name || "User"}</p>
                              <p className="text-xs text-slate-500">{member.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2"><SmartSelect aria-label={`${member.name || member.email} role`} value={member.role} disabled={member.role === "owner" || member.user_id === userProfile?.id} onChange={value => handleMemberRoleChange(member.user_id, value)} searchable={false} className="w-28 [&>button]:h-9 [&>button]:rounded-lg [&>button]:px-2 [&>button]:text-xs [&>button]:uppercase" options={[{value:"member",label:"Member"},{value:"admin",label:"Admin"}, ...(member.role === "owner" ? [{value:"owner",label:"Owner"}] : [])]} />{member.role !== "owner" && member.user_id !== userProfile?.id && <Button type="button" variant="ghost" onClick={() => handleRemoveMember(member)} className="h-9 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /><span className="sr-only">Remove member</span></Button>}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Section: Subscription */}
          {activeSection === "team" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">Subscription & Billing</CardTitle>
                  <CardDescription>View your current plan and usage limits.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {!userProfile?.is_verified ? (
                    <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg text-amber-800 text-sm">
                      Please verify your email address to view subscription details.
                    </div>
                  ) : subscription && (
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="p-5 border border-slate-100 rounded-xl bg-slate-50 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                          <CreditCard className="h-24 w-24" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">Current Plan</p>
                        <h3 className="text-3xl font-bold text-slate-900 capitalize mt-2 mb-3">{subscription.plan.replace('_', ' ')}</h3>
                        <Badge className="border-none" variant={subscription.status === 'active' ? 'default' : 'secondary'}>{subscription.status}</Badge>
                      </div>
                      <div className="p-5 border border-slate-100 rounded-xl bg-slate-50 shadow-sm">
                        <p className="text-sm text-slate-500 font-medium">Usage (This Month)</p>
                        <div className="mt-2 flex items-baseline gap-2">
                          <h3 className="text-3xl font-bold text-slate-900">{usage?.minutes_used?.toFixed(1) || 0}</h3>
                          <span className="text-sm text-slate-500 font-medium">/ {subscription.limits?.voice_minutes || "∞"} minutes</span>
                        </div>
                        <div className="mt-4 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-sage-500 rounded-full transition-all" 
                            style={{ width: `${Math.min(100, ((usage?.minutes_used || 0) / (subscription.limits?.voice_minutes || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Section: Personal Profile */}
          {activeSection === "security" && (
            <form onSubmit={handleProfileSave} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">Personal Profile</CardTitle>
                  <CardDescription>Manage your individual account settings and email verification.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="userName">Full Name</Label>
                      <Input id="userName" name="name" defaultValue={userProfile?.name || ""} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="userEmail">Email Address</Label>
                      <Input id="userEmail" defaultValue={userProfile?.email || ""} disabled className="bg-slate-50 text-slate-500 cursor-not-allowed" />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Role</Label>
                      <Input defaultValue={userProfile?.role || ""} disabled className="bg-slate-50 text-slate-500 cursor-not-allowed uppercase" />
                    </div>
                    <div className="space-y-2">
                      <Label>Verification Status</Label>
                      <div className="pt-2 flex items-center gap-3">
                        {userProfile?.is_verified ? (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 px-3 py-1">Verified</Badge>
                        ) : (
                          <>
                            <Badge variant="destructive" className="px-3 py-1">Unverified</Badge>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              onClick={handleResendVerification}
                            >
                              Resend Verification
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <Button type="submit" className="bg-sage-600 hover:bg-sage-700 min-w-[120px]" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Profile"} 
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}

          {/* Section: Security */}
          {activeSection === "security" && (
            <form onSubmit={handlePasswordChange} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">Security & Password</CardTitle>
                  <CardDescription>Keep your account secure.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input id="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} />
                    </div>
                  </div>
                  
                  <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-start gap-4">
                      <Key className="mt-1 h-5 w-5 text-amber-600 shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-amber-900">Developer API Keys</h4>
                        <p className="mt-1 text-sm text-amber-800 leading-relaxed">
                          API Key generation is currently restricted to Enterprise plans. Contact support for programmatic access to the API.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <Button type="submit" className="bg-sage-600 hover:bg-sage-700 min-w-[120px]" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Change Password"} 
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}

          {/* Workspace lifecycle is managed from the platform organization console. */}
          {activeSection === "security" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="border-amber-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-5">
                  <CardTitle className="text-lg text-amber-800">Workspace lifecycle</CardTitle>
                  <CardDescription className="text-amber-700/80">Safety-sensitive workspace actions.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-white p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <h4 className="font-semibold text-slate-900">Deletion is protected</h4>
                      <p className="mt-1 text-sm text-slate-600">Company deletion, retention review and data export are handled by the Platform Admin organization console. This workspace page never shows a button that cannot safely complete the action.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
