"use client";

import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SmartSelect } from "@/components/ui/smart-select";

type DaySchedule = {
  active: boolean;
  start: string;
  end: string;
};

const DEFAULT_SCHEDULE = {
  monday: { active: true, start: "09:00", end: "17:00" },
  tuesday: { active: true, start: "09:00", end: "17:00" },
  wednesday: { active: true, start: "09:00", end: "17:00" },
  thursday: { active: true, start: "09:00", end: "17:00" },
  friday: { active: true, start: "09:00", end: "17:00" },
  saturday: { active: false, start: "10:00", end: "14:00" },
  sunday: { active: false, start: "10:00", end: "14:00" },
};

const DAYS = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
];

const TIME_OPTIONS = Array.from({ length: 48 }).map((_, i) => {
  const hour = Math.floor(i / 2);
  const min = i % 2 === 0 ? "00" : "30";
  const formattedHour = hour.toString().padStart(2, "0");
  const value = `${formattedHour}:${min}`;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  const display = `${displayHour}:${min} ${ampm}`;
  return { value, display };
});

export default function SmartWeeklySchedule({ initialSchedule }: { initialSchedule?: any }) {
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(() => {
    let parsed = initialSchedule;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch(e) {
        parsed = {};
      }
    }
    if (!parsed || typeof parsed !== 'object') {
      parsed = {};
    }
    
    const finalSchedule = { ...DEFAULT_SCHEDULE };
    for (const key of Object.keys(DEFAULT_SCHEDULE)) {
      if (parsed && parsed[key] && typeof parsed[key] === 'object') {
        finalSchedule[key as keyof typeof DEFAULT_SCHEDULE] = {
          ...DEFAULT_SCHEDULE[key as keyof typeof DEFAULT_SCHEDULE],
          ...parsed[key]
        };
      }
    }
    return finalSchedule;
  });
  const toggleDay = (day: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], active: !prev[day].active }
    }));
  };

  const updateTime = (day: string, field: "start" | "end", value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  return (
    <div className="space-y-4">
      <input type="hidden" name="business_hours" value={JSON.stringify(schedule)} />
      {DAYS.map((day) => {
        const { active, start, end } = schedule[day.id];
        return (
          <div key={day.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
            <div className="flex items-center gap-4 w-1/3">
              <Switch 
                id={`switch-${day.id}`} 
                checked={active} 
                onCheckedChange={() => toggleDay(day.id)} 
              />
              <Label htmlFor={`switch-${day.id}`} className={`font-medium ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                {day.label}
              </Label>
            </div>

            {active ? (
              <div className="flex items-center gap-3 w-2/3 justify-end">
                <SmartSelect value={start} onChange={(value) => updateTime(day.id, "start", value)} searchable={false} options={TIME_OPTIONS.map(opt => ({ value: opt.value, label: opt.display }))} className="w-28 [&>button]:h-9 [&>button]:rounded-md [&>button]:px-2" />
                <span className="text-slate-400 text-sm font-medium">to</span>
                <SmartSelect value={end} onChange={(value) => updateTime(day.id, "end", value)} searchable={false} options={TIME_OPTIONS.map(opt => ({ value: opt.value, label: opt.display }))} className="w-28 [&>button]:h-9 [&>button]:rounded-md [&>button]:px-2" />
              </div>
            ) : (
              <div className="w-2/3 flex justify-end">
                <span className="text-sm font-medium text-slate-400 px-4 py-1.5 bg-slate-50 rounded-md">Closed</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
