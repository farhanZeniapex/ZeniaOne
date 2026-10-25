export interface Language {
  id: string;
  name: string;
  nativeName: string;
  enabled: boolean;
}

export const LANGUAGES: Language[] = [
  { id: "en-IN", name: "English (India)", nativeName: "English", enabled: true },
  { id: "en-US", name: "English (US)", nativeName: "English", enabled: true },
  { id: "hi-IN", name: "Hindi", nativeName: "हिंदी", enabled: true },
  { id: "ta-IN", name: "Tamil", nativeName: "தமிழ்", enabled: true },
  { id: "te-IN", name: "Telugu", nativeName: "తెలుగు", enabled: true },
  { id: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ", enabled: true },
  { id: "ml-IN", name: "Malayalam", nativeName: "മലയാളം", enabled: true },
  { id: "mr-IN", name: "Marathi", nativeName: "मराठी", enabled: true },
  { id: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી", enabled: true },
  { id: "bn-IN", name: "Bengali", nativeName: "বাংলা", enabled: true },
  { id: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", enabled: true },
  { id: "ur-IN", name: "Urdu", nativeName: "اردو", enabled: true },
  { id: "or-IN", name: "Odia", nativeName: "ଓଡ଼ିଆ", enabled: true },
  { id: "as-IN", name: "Assamese", nativeName: "অসমীয়া", enabled: true },
  { id: "ks-IN", name: "Kashmiri", nativeName: "کأشُر", enabled: true },
  // Disabled / Coming Soon Languages
  { id: "ne-IN", name: "Nepali", nativeName: "नेपाली", enabled: false },
  { id: "sd-IN", name: "Sindhi", nativeName: "سنڌي", enabled: false },
  { id: "si-LK", name: "Sinhala", nativeName: "සිංහල", enabled: false },
  { id: "ar-AE", name: "Arabic (UAE)", nativeName: "العربية", enabled: false },
  { id: "fr-FR", name: "French", nativeName: "Français", enabled: false },
  { id: "es-ES", name: "Spanish", nativeName: "Español", enabled: false },
  { id: "zh-CN", name: "Mandarin", nativeName: "中文", enabled: false },
];
