"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Save, Loader2, Upload } from "lucide-react";
import { API_BASE_URL } from "@/lib/api/client";
import { uploadPlatformLogo, removePlatformLogo, GlobalSettings } from "@/lib/api/settings";
import { ACCENT_PALETTES, TIMEZONE_OPTIONS, LANGUAGE_OPTIONS } from "../types";

export interface BrandingTabProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  savePlatformSection: (sec: keyof GlobalSettings) => Promise<void>;
  savingSection: string | null;
  platformLogoInputRef: React.RefObject<HTMLInputElement | null>;
  uploadingLogo: boolean;
  logoVersion: number;
  setLogoVersion: React.Dispatch<React.SetStateAction<number>>;
  setToast: (toast: { message: string; tone: "success" | "error" | "info" } | null) => void;
  currentAccent: string;
  handleSelectAccent: (hex: string) => void;
}

export default function BrandingTab({
  settings,
  setSettings,
  savePlatformSection,
  savingSection,
  platformLogoInputRef,
  uploadingLogo,
  logoVersion,
  setLogoVersion,
  setToast,
  currentAccent,
  handleSelectAccent,
}: BrandingTabProps) {
  return (
<Card className="border-[#D5E4DB] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#19372B] flex items-center gap-2">
                  <Sparkles size={19} className="text-[#087F5B]" />
                  Theme, White-Label & Accent Palette
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your primary accent palette and customize platform white-label identity.
                </p>
              </div>
              <Button
                onClick={() => savePlatformSection("platform")}
                disabled={savingSection === "platform"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "platform" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Platform Branding
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Platform Brand Name
                  </label>
                  <Input
                    value={settings.platform.platform_name}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        platform: { ...settings.platform, platform_name: e.target.value },
                      })
                    }
                    className="font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Default Business Timezone
                  </label>
                  <select
                    value={settings.platform.default_timezone}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        platform: { ...settings.platform, default_timezone: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium focus:border-[#285A42] focus:outline-none"
                  >
                    {TIMEZONE_OPTIONS.map((t: any) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Default Platform Language
                  </label>
                  <select
                    value={settings.platform.default_language}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        platform: { ...settings.platform, default_language: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium focus:border-[#285A42] focus:outline-none"
                  >
                    {LANGUAGE_OPTIONS.map((l: any) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Working Primary Accent Palette Section */}
              <div className="rounded-2xl border border-slate-200 bg-[#FBFDFC] p-5 space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Primary Accent Palette (Interactive)
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Click any preset below to instantly activate and persist the primary UI accent.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ACCENT_PALETTES.map((pal) => {
                    const isSelected = currentAccent.toLowerCase() === pal.hex.toLowerCase();
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() => handleSelectAccent(pal.hex)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                          isSelected
                            ? "bg-white shadow-md ring-2"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                        }`}
                        style={isSelected ? {
                          borderColor: pal.hex,
                          boxShadow: `0 0 0 2px ${pal.hex}33, 0 4px 12px ${pal.hex}22`,
                        } : undefined}
                      >
                        <span
                          className="h-7 w-7 rounded-full shadow-inner flex items-center justify-center shrink-0"
                          style={{ backgroundColor: pal.hex }}
                        >
                          {isSelected && <Check size={14} className="text-white" />}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{pal.label}</p>
                          <p className="text-[10px] font-mono text-slate-400 uppercase">{pal.hex}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Global Header Logo Upload */}
                <div className="pt-4 border-t border-slate-100 flex items-center gap-4">
                  <div className="grid h-14 w-14 place-items-center rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden p-1.5">
                    <img
                      src={`${API_BASE_URL}/admin/settings/logo?t=${logoVersion}`}
                      alt="Platform Logo"
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/brand/zeniaone-logo.png";
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Global Header Logo</p>
                    <p className="text-[11px] text-slate-400">PNG or SVG · Max 2MB</p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        ref={platformLogoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            setToast({ message: "Logo file is too large. Maximum size is 2MB.", tone: "error" });
                            if (e.target) e.target.value = "";
                            return;
                          }
                          try {
                            await uploadPlatformLogo(file);
                            setLogoVersion(Date.now());
                            setToast({ message: "Global platform logo updated and optimized to WebP!", tone: "success" });
                          } catch (err: any) {
                            setToast({ message: err?.message || "Failed to upload logo.", tone: "error" });
                          } finally {
                            if (e.target) e.target.value = "";
                          }
                        }}
                        className="hidden"
                      />
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => platformLogoInputRef.current?.click()}
                        className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-[11px] h-7 px-3 font-bold"
                      >
                        <Upload size={11} className="mr-1" /> Upload
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={async () => {
                          try {
                            await removePlatformLogo();
                            setLogoVersion(Date.now());
                            setToast({ message: "Global logo removed.", tone: "info" });
                          } catch {
                            setToast({ message: "Failed to remove logo.", tone: "error" });
                          }
                        }}
                        className="border-slate-200 text-slate-600 text-[11px] h-7 px-2.5 font-medium"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => savePlatformSection("platform")}
                disabled={savingSection === "platform"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "platform" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Branding Settings
              </Button>
            </div>
          </CardContent>
        </Card>
  );
}
