"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioTower, Power, AlertTriangle, Save, Loader2 } from "lucide-react";
import { GlobalSettings } from "@/lib/api/settings";

export interface MaintenanceTabProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  savePlatformSection: (sec: keyof GlobalSettings) => Promise<void>;
  savingSection: string | null;
  isMaintenanceOn: boolean;
  handleMaintenanceToggle: (enabled: boolean) => Promise<void>;
}

export default function MaintenanceTab({
  settings,
  setSettings,
  savePlatformSection,
  savingSection,
  isMaintenanceOn,
  handleMaintenanceToggle,
}: MaintenanceTabProps) {
  return (
<Card className="border-[#D5E4DB] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#19372B] flex items-center gap-2">
                  <RadioTower size={19} className="text-amber-600" />
                  Platform Maintenance & Emergency Controls
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Safely isolate telephony webhooks and database writes during updates without crashing active callers.
                </p>
              </div>
              <Button
                onClick={() => savePlatformSection("system")}
                disabled={savingSection === "system"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "system" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Maintenance Config
              </Button>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h3 className="text-sm font-bold text-amber-900">Emergency Platform Kill-Switch</h3>
                  <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                    When Maintenance Mode is ON, inbound calls will hear the broadcast message below and gracefully disconnect. Background queues will be paused.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <Button
                  onClick={() => handleMaintenanceToggle(!isMaintenanceOn)}
                  className={`rounded-xl px-5 text-xs font-bold transition-all shadow-sm ${
                    isMaintenanceOn
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-red-600 hover:bg-red-700 text-white"
                  }`}
                >
                  <Power className="mr-1.5 h-3.5 w-3.5" />
                  {isMaintenanceOn ? "Deactivate Maintenance Mode" : "Activate Maintenance Mode"}
                </Button>
                <span className="text-xs font-medium text-slate-600">
                  Current Status: <strong className={isMaintenanceOn ? "text-red-600" : "text-emerald-700"}>
                    {isMaintenanceOn ? "MAINTENANCE ACTIVE" : "OPERATIONAL"}
                  </strong>
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Broadcast Audio / Banner Message
              </label>
              <Textarea
                rows={3}
                value={settings.system.maintenance_message}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    system: { ...settings.system, maintenance_message: e.target.value },
                  })
                }
                className="text-xs font-medium"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => savePlatformSection("system")}
                disabled={savingSection === "system"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "system" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Maintenance Config
              </Button>
            </div>
          </CardContent>
        </Card>
  );
}
