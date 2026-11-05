"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BellRing, Smartphone, Send, Save, Loader2 } from "lucide-react";
import { GlobalSettings } from "@/lib/api/settings";

export interface AlertsTabProps {
  settings: GlobalSettings;
  setSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  whatsappNumber: string;
  setWhatsappNumber: (v: string) => void;
  slackWebhook: string;
  setSlackWebhook: (v: string) => void;
  savePlatformSection: (sec: keyof GlobalSettings) => Promise<void>;
  savingSection: string | null;
}

export default function AlertsTab({
  settings,
  setSettings,
  whatsappNumber,
  setWhatsappNumber,
  slackWebhook,
  setSlackWebhook,
  savePlatformSection,
  savingSection,
}: AlertsTabProps) {
  return (
<Card className="border-[#D5E4DB] bg-white shadow-sm overflow-hidden">
          <CardContent className="p-7 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-[#19372B] flex items-center gap-2">
                  <BellRing size={19} className="text-[#087F5B]" />
                  Urgent Alerts & Webhook Dispatchers
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Instant real-time notifications sent to WhatsApp, Slack, or Discord when call drops or AI provider failures occur.
                </p>
              </div>
              <Button
                onClick={() => savePlatformSection("notifications")}
                disabled={savingSection === "notifications"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "notifications" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Alert Webhooks
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Smartphone size={13} className="text-[#087F5B]" /> WhatsApp Alert Number (High Priority)
                  </label>
                  <Input
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+919099887880"
                    className="font-mono text-xs font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Critical call drops or circuit breaker trips will be dispatched via WhatsApp instantly.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5 flex items-center gap-1.5">
                    <Send size={13} className="text-[#087F5B]" /> Slack / Discord Incoming Webhook URL
                  </label>
                  <Input
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/T00/B00/XXXXX"
                    className="font-mono text-xs font-medium"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-[#F9FCF9] p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Notification Triggers & Toggles
                </p>

                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.admin_notifications_enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          admin_notifications_enabled: e.target.checked,
                        },
                      })
                    }
                    className="rounded text-[#0C4A31] focus:ring-[#0C4A31]"
                  />
                  Dispatch alerts for AI Provider Failovers
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.system_alerts_enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          system_alerts_enabled: e.target.checked,
                        },
                      })
                    }
                    className="rounded text-[#0C4A31] focus:ring-[#0C4A31]"
                  />
                  Dispatch alerts for Call Minutes Quota Exhaustion (85%+)
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.security_alerts_enabled}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          security_alerts_enabled: e.target.checked,
                        },
                      })
                    }
                    className="rounded text-[#0C4A31] focus:ring-[#0C4A31]"
                  />
                  Dispatch alerts for Suspicious Logins from Unknown IPs
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                onClick={() => savePlatformSection("notifications")}
                disabled={savingSection === "notifications"}
                className="bg-[#0C4A31] hover:bg-[#093A27] text-white text-xs font-bold"
              >
                {savingSection === "notifications" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Alert Webhooks
              </Button>
            </div>
          </CardContent>
        </Card>
  );
}
