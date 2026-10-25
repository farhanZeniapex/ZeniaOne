"use client";

import React, { useState } from "react";
import { SharedSettingsProps } from "./types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutDashboard, Loader2, Bot, Shield, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartSelect } from "@/components/ui/smart-select";

const SETTINGS_SECTIONS = [
  { id: "platform", label: "Platform & Profile", icon: LayoutDashboard, group: "General" },
  { id: "ai", label: "AI Defaults", icon: Bot, group: "Settings" },
  { id: "security", label: "Security & Access", icon: Shield, group: "Settings" },
  { id: "notifications", label: "Notifications", icon: Bell, group: "Settings" },
];

export default function SharedSettingsView({ mode, companyId }: SharedSettingsProps) {
  const isAdmin = mode === "admin";
  const [activeSection, setActiveSection] = useState("platform");
  const [isSaving, setIsSaving] = useState(false);
  const [defaultLanguage, setDefaultLanguage] = useState("en");
  const [defaultProvider, setDefaultProvider] = useState("sarvam");

  // Group sections
  const groupedSections = SETTINGS_SECTIONS.reduce((acc, section) => {
    if (!acc[section.group]) acc[section.group] = [];
    acc[section.group].push(section);
    return acc;
  }, {} as Record<string, typeof SETTINGS_SECTIONS>);

  return (
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {isAdmin ? "Admin Settings" : "Company Settings"}
        </h1>
        <p className="mt-1 text-slate-500">
          {isAdmin ? "Platform configuration, global pricing, and system defaults." : "Manage your company profile and preferences."}
        </p>
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
                          ? "bg-sage-100 text-sage-900" 
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <section.icon className={cn("h-4 w-4", activeSection === section.id ? "text-sage-700" : "text-slate-400")} />
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
          
          {/* Section: Platform / Profile */}
          {activeSection === "platform" && (
            <form className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                  <CardTitle className="text-lg">{isAdmin ? "Platform Branding" : "Company Profile"}</CardTitle>
                  <CardDescription>
                    {isAdmin ? "Global branding used on the admin panel." : "Your company name and basic information."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-6 md:grid-cols-2 mb-8">
                    <div className="space-y-2">
                      <Label htmlFor="name">{isAdmin ? "Platform Name" : "Company Name"}</Label>
                      <Input id="name" name="name" placeholder={isAdmin ? "ZeniaOne" : "Your Company"} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="default_language">Default Language</Label>
                      <SmartSelect id="default_language" name="default_language" value={defaultLanguage} onChange={setDefaultLanguage} searchable={false} options={[{value:"en",label:"English (US)"},{value:"hi",label:"Hindi"}]} />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                  <Button type="button" className="bg-sage-600 hover:bg-sage-700 min-w-[120px]" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"} 
                  </Button>
                </CardFooter>
              </Card>
            </form>
          )}

          {/* Section: AI Defaults (Admin only view of secrets) */}
          {activeSection === "ai" && (
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
              <form>
                <Card className="shadow-sm border-slate-200 overflow-hidden mb-6">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-5">
                    <CardTitle className="text-lg">
                      {isAdmin ? "Global AI & Agent Defaults" : "Company AI Preferences"}
                    </CardTitle>
                    <CardDescription>
                      {isAdmin 
                        ? "Default model parameters applied to all new workspaces across the platform." 
                        : "Set default models and AI behaviors for your company."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="default_provider">Default Provider</Label>
                        <SmartSelect id="default_provider" name="default_provider" value={defaultProvider} onChange={setDefaultProvider} searchable={false} options={[{value:"sarvam",label:"Sarvam AI"},{value:"gemini",label:"Google Gemini"},{value:"groq",label:"Groq"}]} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="default_model">Default Model</Label>
                        <Input id="default_model" name="default_model" placeholder="llama3-8b-8192" />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                    <Button type="button" className="bg-sage-600 hover:bg-sage-700 min-w-[120px]" disabled={isSaving}>
                      Save Defaults
                    </Button>
                  </CardFooter>
                </Card>
              </form>

              {/* SECURITY: ADMIN ONLY SECRETS BLOCK */}
              {isAdmin && (
                <Card className="shadow-sm border-red-200 overflow-hidden">
                  <CardHeader className="bg-red-50/30 border-b border-red-100 pb-5">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-red-600" />
                      <CardTitle className="text-lg text-red-700">Platform API Secrets</CardTitle>
                    </div>
                    <CardDescription className="text-slate-600">
                      Configure the master API keys used to power AI features for all companies.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="groq_key" className="text-red-700 font-medium">Groq API Key</Label>
                      <Input id="groq_key" type="password" placeholder="gsk_******************************" className="border-red-200 focus-visible:ring-red-500" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gemini_key" className="text-red-700 font-medium">Gemini API Key</Label>
                      <Input id="gemini_key" type="password" placeholder="AIzaSy**************************" className="border-red-200 focus-visible:ring-red-500" />
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                      <p className="text-xs text-red-600 font-medium text-center">
                        🔒 Company users cannot access or view this section.
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-red-100 bg-red-50/50 flex justify-end">
                    <Button type="button" variant="destructive" className="min-w-[120px]" disabled={isSaving}>
                      Update Secrets
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
