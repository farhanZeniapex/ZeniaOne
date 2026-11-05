import { Building2, CalendarClock, Mic, Sparkles, RadioTower, BellRing, ShieldCheck, Bot } from "lucide-react";

export const ACCENT_PALETTES = [
  { id: "emerald", label: "Emerald Cyber", hex: "#0C4A31", borderHex: "#10B981" },
  { id: "indigo", label: "Indigo Quantum", hex: "#4F46E5", borderHex: "#818CF8" },
  { id: "oceanic", label: "Oceanic Blue", hex: "#0284C7", borderHex: "#38BDF8" },
  { id: "violet", label: "Royal Violet", hex: "#7C3AED", borderHex: "#A78BFA" },
  { id: "obsidian", label: "Obsidian Dark", hex: "#18181B", borderHex: "#71717A" },
];

export const SETTINGS_TABS = [
  { id: "business", label: "🏢 Business Profile & Logo", icon: Building2 },
  { id: "schedule", label: "⏰ Operating Hours & Time", icon: CalendarClock },
  { id: "voice", label: "🎙️ Voice, Greetings & Policy", icon: Mic },
  { id: "branding", label: "🎨 Theme & Accent Palette", icon: Sparkles },
  { id: "maintenance", label: "🛑 Maintenance & Kill-Switch", icon: RadioTower },
  { id: "alerts", label: "🔔 WhatsApp & Slack Alerts", icon: BellRing },
  { id: "security", label: "🛡️ Security Armor", icon: ShieldCheck },
  { id: "ai", label: "🤖 AI Guardrails", icon: Bot },
] as const;

export const STANDARD_VOICES = [
  { value: "ritu", label: "Ritu (Warm & Professional · Hindi/English)" },
  { value: "priya", label: "Priya (Friendly & Clear · Hinglish)" },
  { value: "neha", label: "Neha (Energetic Support · English/Hindi)" },
  { value: "pooja", label: "Pooja (Calm & Empathetic · Hindi)" },
  { value: "shreya", label: "Shreya (Executive Tone · English)" },
  { value: "kavya", label: "Kavya (Soft & Polished · Gujarati/Hindi)" },
  { value: "rahul", label: "Rahul (Assertive & Confident · Hindi/English)" },
  { value: "rohan", label: "Rohan (Casual & Tech · English)" },
  { value: "aditya", label: "Aditya (Corporate Formal · Hindi/English)" },
  { value: "kabir", label: "Kabir (Deep & Authoritative · Hindi)" },
  { value: "amit", label: "Amit (Customer Care Lead · Hinglish)" },
];

export const LANGUAGE_OPTIONS = [
  { value: "en-IN", label: "English (India · en-IN)" },
  { value: "hi-IN", label: "Hindi / Hinglish (hi-IN)" },
  { value: "gu-IN", label: "Gujarati (gu-IN)" },
  { value: "en-US", label: "English (US · en-US)" },
  { value: "en-GB", label: "English (UK · en-GB)" },
];

export const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST · +05:30)" },
  { value: "UTC", label: "UTC (Universal Coordinated Time)" },
  { value: "America/New_York", label: "America/New York (EST · -05:00)" },
  { value: "Europe/London", label: "Europe/London (GMT · +00:00)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST · +04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT · +08:00)" },
];

