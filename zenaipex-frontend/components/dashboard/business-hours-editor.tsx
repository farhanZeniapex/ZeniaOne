"use client";

import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Copy, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DayHours {
  isOpen: boolean;
  open: string;
  close: string;
}

export interface Holiday {
  date: string;
  name: string;
}

export interface BusinessHoursState {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
  holidays: Holiday[];
}

const DEFAULT_HOURS: DayHours = { isOpen: true, open: "09:00", close: "17:00" };
const CLOSED_HOURS: DayHours = { isOpen: false, open: "09:00", close: "17:00" };

const DEFAULT_STATE: BusinessHoursState = {
  monday: { ...DEFAULT_HOURS },
  tuesday: { ...DEFAULT_HOURS },
  wednesday: { ...DEFAULT_HOURS },
  thursday: { ...DEFAULT_HOURS },
  friday: { ...DEFAULT_HOURS },
  saturday: { ...CLOSED_HOURS },
  sunday: { ...CLOSED_HOURS },
  holidays: [],
};

const DAYS_OF_WEEK: (keyof Omit<BusinessHoursState, "holidays">)[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
];

export function BusinessHoursEditor({ initialValue }: { initialValue?: string }) {
  const [state, setState] = useState<BusinessHoursState>(DEFAULT_STATE);

  useEffect(() => {
    if (initialValue) {
      try {
        const parsed = JSON.parse(initialValue);
        // Safely normalize partial data to ensure all 7 days exist
        const normalized = { ...DEFAULT_STATE };
        for (const day of DAYS_OF_WEEK) {
          if (parsed[day]) {
            normalized[day] = { ...DEFAULT_STATE[day], ...parsed[day] };
          }
        }
        if (parsed.holidays && Array.isArray(parsed.holidays)) {
          normalized.holidays = parsed.holidays;
        }
        setState(normalized);
      } catch (e) {
        // Fallback for legacy string format
        console.warn("Legacy business hours format detected, using defaults.");
      }
    }
  }, [initialValue]);

  const updateDay = (day: keyof BusinessHoursState, updates: Partial<DayHours>) => {
    setState(prev => ({
      ...prev,
      [day]: { ...(prev[day] as DayHours), ...updates }
    }));
  };

  const copyToAllWeekdays = (sourceDay: keyof BusinessHoursState) => {
    const sourceHours = state[sourceDay] as DayHours;
    setState(prev => ({
      ...prev,
      monday: { ...sourceHours },
      tuesday: { ...sourceHours },
      wednesday: { ...sourceHours },
      thursday: { ...sourceHours },
      friday: { ...sourceHours }
    }));
  };

  const addHoliday = () => {
    setState(prev => ({
      ...prev,
      holidays: [...prev.holidays, { date: "", name: "" }]
    }));
  };

  const updateHoliday = (index: number, updates: Partial<Holiday>) => {
    setState(prev => {
      const newHolidays = [...prev.holidays];
      newHolidays[index] = { ...newHolidays[index], ...updates };
      return { ...prev, holidays: newHolidays };
    });
  };

  const removeHoliday = (index: number) => {
    setState(prev => {
      const newHolidays = [...prev.holidays];
      newHolidays.splice(index, 1);
      return { ...prev, holidays: newHolidays };
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {DAYS_OF_WEEK.map((day) => {
          const dayData = state[day] as DayHours;
          return (
            <div key={day} className={cn(
              "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg border transition-colors",
              dayData.isOpen ? "bg-white border-slate-200 shadow-sm" : "bg-slate-50 border-transparent opacity-80"
            )}>
              <div className="flex items-center gap-4 w-32 shrink-0">
                <Switch 
                  checked={dayData.isOpen} 
                  onCheckedChange={(checked) => updateDay(day, { isOpen: checked })} 
                  aria-label={`Toggle ${day}`}
                />
                <span className={cn("font-medium capitalize", dayData.isOpen ? "text-slate-800" : "text-slate-500")}>{day}</span>
              </div>
              
              <div className="flex items-center gap-3 flex-1">
                {dayData.isOpen ? (
                  <>
                    <Input 
                      type="time" 
                      value={dayData.open} 
                      onChange={e => updateDay(day, { open: e.target.value })} 
                      className="w-[110px] focus-visible:ring-sage-500"
                      required={dayData.isOpen}
                    />
                    <span className="text-slate-400 text-sm font-medium">to</span>
                    <Input 
                      type="time" 
                      value={dayData.close} 
                      onChange={e => updateDay(day, { close: e.target.value })} 
                      className="w-[110px] focus-visible:ring-sage-500" 
                      required={dayData.isOpen}
                    />
                  </>
                ) : (
                  <div className="px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200/60 text-xs font-medium text-slate-500">
                    Closed
                  </div>
                )}
              </div>
              
              <div className="w-28 flex justify-end shrink-0">
                {day === "monday" && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => copyToAllWeekdays(day)}
                    className="text-xs text-sage-600 hover:text-sage-700 hover:bg-sage-50 whitespace-nowrap"
                  >
                    <Copy className="h-3 w-3 mr-1.5" /> Copy to M–F
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h5 className="font-medium text-slate-900">Holidays & Special Closures</h5>
            <p className="text-xs text-slate-500 mt-0.5">Define days your business is fully closed.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addHoliday}>
            <Plus className="h-4 w-4 mr-2" /> Add Holiday
          </Button>
        </div>

        {state.holidays.length > 0 ? (
          <div className="space-y-3">
            {state.holidays.map((holiday, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-center gap-4 bg-white border border-slate-200 rounded-lg p-3 shadow-sm hover:border-slate-300 transition-colors relative group">
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Date</Label>
                    <Input 
                      type="date" 
                      value={holiday.date} 
                      onChange={e => updateHoliday(idx, { date: e.target.value })} 
                      className="focus-visible:ring-sage-500 h-9"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Holiday Name / Reason</Label>
                    <Input 
                      placeholder="e.g. New Year's Day" 
                      value={holiday.name} 
                      onChange={e => updateHoliday(idx, { name: e.target.value })} 
                      className="focus-visible:ring-sage-500 h-9"
                      required
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 sm:self-end sm:mb-0.5">
                  <div className="px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600 whitespace-nowrap">
                    Full-day closure
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeHoliday(idx)}
                    className="text-slate-400 opacity-70 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                    title="Remove closure"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <span className="text-lg">🏝️</span>
            </div>
            <h4 className="text-sm font-medium text-slate-900">No special closures added</h4>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">Add holidays or one-off closure dates for this workspace.</p>
          </div>
        )}
      </div>

      <input type="hidden" name="business_hours" value={JSON.stringify(state)} />
    </div>
  );
}
