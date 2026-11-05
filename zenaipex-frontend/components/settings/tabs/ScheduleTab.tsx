"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Save, Loader2 } from "lucide-react";
import SmartWeeklySchedule from "@/components/platform/settings/SmartWeeklySchedule";
import { CompanyProfile } from "@/lib/api/settings";

export interface ScheduleTabProps {
  scheduleData: any;
  setScheduleData: (data: any) => void;
  saveOperatingHours: () => Promise<void>;
  savingSection: string | null;
  currentCompany: CompanyProfile | null;
  timezone: string;
}

export default function ScheduleTab({
  scheduleData,
  setScheduleData,
  saveOperatingHours,
  savingSection,
  currentCompany,
  timezone,
}: ScheduleTabProps) {
  return (
<Card className="border-[#D5E4DB] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#19372B] flex items-center gap-2">
                  <CalendarClock size={19} className="text-[#087F5B]" />
                  Weekly Operating Schedule & Time Management
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure day-to-day open and closing hours. When outside these hours, AI assistants politely notify callers or take voicemails.
                </p>
              </div>
              <Button
                onClick={saveOperatingHours}
                disabled={savingSection === "schedule" || !currentCompany}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "schedule" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Operating Hours
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[#FCFDFC] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Business Hours Matrix (Monday - Sunday)
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Toggle days on/off and adjust start/end shifts for {currentCompany?.name || "the workspace"}.
                  </p>
                </div>
                <span className="rounded-lg bg-[#E6F4EB] px-2.5 py-1 text-xs font-bold text-[#087F5B]">
                  Timezone: {timezone}
                </span>
              </div>

              {/* Dynamic Smart Weekly Schedule Component */}
              <SmartWeeklySchedule
                initialSchedule={scheduleData}
                onChange={(updated) => setScheduleData(updated)}
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={saveOperatingHours}
                disabled={savingSection === "schedule" || !currentCompany}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "schedule" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Operating Hours
              </Button>
            </div>
          </CardContent>
        </Card>
  );
}
