"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Save, Loader2 } from "lucide-react";
import { GlobalSettings } from "@/lib/api/settings";

export interface SecurityTabProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  savePlatformSection: (sec: keyof GlobalSettings) => Promise<void>;
  savingSection: string | null;
}

export default function SecurityTab({
  settings,
  setSettings,
  savePlatformSection,
  savingSection,
}: SecurityTabProps) {
  return (
<Card className="border-[#D5E4DB] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#19372B] flex items-center gap-2">
                  <ShieldCheck size={19} className="text-[#087F5B]" />
                  Security Armor & Session Governance
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Session timeouts, password complexity requirements, and multi-tenant isolation safeguards.
                </p>
              </div>
              <Button
                onClick={() => savePlatformSection("security")}
                disabled={savingSection === "security"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "security" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Security Policies
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-700">Admin Session Inactivity Timeout</span>
                    <span className="font-mono font-bold text-[#0C4A31] bg-[#DCF7E4] px-2 py-0.5 rounded-md">
                      {settings.security.session_timeout_minutes} Minutes
                    </span>
                  </div>
                  <input
                    type="range"
                    min="15"
                    max="480"
                    step="15"
                    value={settings.security.session_timeout_minutes}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        security: {
                          ...settings.security,
                          session_timeout_minutes: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full accent-[#0C4A31] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>15 min</span>
                    <span>120 min</span>
                    <span>8 hours</span>
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={settings.security.require_strong_passwords}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        security: {
                          ...settings.security,
                          require_strong_passwords: e.target.checked,
                        },
                      })
                    }
                    className="rounded text-[#0C4A31] focus:ring-[#0C4A31]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800">Enforce Strict Password Complexity</p>
                    <p className="text-[11px] text-slate-500">Requires minimum 10 characters with numbers and special symbols for all tenant admins.</p>
                  </div>
                </label>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-[#F8FAFC] p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Platform Security Safeguards
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-600">JWT Token Signing</span>
                    <span className="font-mono font-bold text-emerald-700">HS256 Verified</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-600">Telephony Webhook HMAC</span>
                    <span className="font-mono font-bold text-emerald-700">Active</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-slate-600">Cross-Tenant DB Isolation</span>
                    <span className="font-mono font-bold text-emerald-700">Enforced (company_id)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => savePlatformSection("security")}
                disabled={savingSection === "security"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "security" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Security Policies
              </Button>
            </div>
          </CardContent>
        </Card>
  );
}
