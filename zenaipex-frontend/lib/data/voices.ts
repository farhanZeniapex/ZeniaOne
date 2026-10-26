export interface Voice {
  id: string;
  name: string;
  gender: "Male" | "Female";
  provider: string;
  enabled: boolean;
  description: string;
  tone: string;
  sampleText: string;
  supportedLanguages?: string[];
  accent?: string;
}

export const VOICES: Voice[] = [
  // --- Female Voices ---
  { 
    id: "ritu", 
    name: "Ritu", 
    gender: "Female", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Warm, natural, and friendly. Ideal for customer support and general assistance.",
    tone: "Warm & Friendly",
    sampleText: "Hello! I am Ritu. I am ready to help with customer service and questions.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Indian Natural"
  },
  { 
    id: "priya", 
    name: "Priya", 
    gender: "Female", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Polished and conversational. Perfect for professional business calls and reception.",
    tone: "Professional & Smooth",
    sampleText: "Hello! I am Priya. I can speak naturally with your business customers and clients.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Indian Corporate"
  },
  { 
    id: "neha", 
    name: "Neha", 
    gender: "Female", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Soft, patient, and empathetic. Excellent for healthcare, counseling, and delicate inquiries.",
    tone: "Soft & Empathetic",
    sampleText: "Hello! I am Neha. How can I help you today? I am here to assist.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Gentle Indian"
  },
  { 
    id: "pooja", 
    name: "Pooja", 
    gender: "Female", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "High energy, enthusiastic, and upbeat. Great for sales, outreach, and promotions.",
    tone: "Energetic & Upbeat",
    sampleText: "Hi there! I am Pooja. I can help you find fast and accurate solutions.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Dynamic Indian"
  },
  { 
    id: "shreya", 
    name: "Shreya", 
    gender: "Female", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Modern, expressive, and relatable. Great for e-commerce, consumer apps, and tech.",
    tone: "Modern & Expressive",
    sampleText: "Hello! I am Shreya. I am ready to become your company's smart voice assistant.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Urban Indian"
  },
  { 
    id: "kavya", 
    name: "Kavya", 
    gender: "Female", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Calm, polite, and reassuring. Well-suited for banking, billing, and advisory.",
    tone: "Polite & Reassuring",
    sampleText: "Hello, I am Kavya. I make every call and customer interaction helpful and effortless.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Classic Indian"
  },

  // --- Male Voices ---
  { 
    id: "rahul", 
    name: "Rahul", 
    gender: "Male", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Friendly, casual, and approachable. Outstanding for tech support and everyday chat.",
    tone: "Friendly & Casual",
    sampleText: "Hello! I am Rahul. What question or service would you like to discuss today?",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Conversational Indian"
  },
  { 
    id: "rohan", 
    name: "Rohan", 
    gender: "Male", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Dynamic, quick-witted, and vibrant. Great for sales calls, bookings, and onboarding.",
    tone: "Dynamic & Fast",
    sampleText: "Hello! I am Rohan. I am ready to help with sales and customer support.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Young Professional"
  },
  { 
    id: "aditya", 
    name: "Aditya", 
    gender: "Male", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Crisp, articulated, and clear. Ideal for corporate operations and formal consultations.",
    tone: "Crisp & Articulated",
    sampleText: "Hello, I am Aditya. I can guide your business operations and answer customer questions accurately.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Corporate Indian"
  },
  { 
    id: "kabir", 
    name: "Kabir", 
    gender: "Male", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Deep, confident, and authoritative. Excellent for legal, finance, and leadership updates.",
    tone: "Deep & Confident",
    sampleText: "Hello! I am Kabir. You can rely on me for clear communication and dependable answers.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Deep Indian"
  },
  { 
    id: "amit", 
    name: "Amit", 
    gender: "Male", 
    provider: "Sarvam Bulbul v3", 
    enabled: true,
    description: "Experienced, steady, and trustworthy. Perfect for B2B relationships and enterprise clients.",
    tone: "Steady & Trustworthy",
    sampleText: "Hello! I am Amit. I am available for professional discussions and business support.",
    supportedLanguages: ["Hinglish", "Hindi", "English"],
    accent: "Executive Indian"
  }
];

export function getVoiceById(id: string | undefined): Voice {
  if (!id) return VOICES[0];
  const found = VOICES.find(v => v.id.toLowerCase() === id.toLowerCase());
  return found || VOICES[0];
}

export const MALE_VOICE_IDS = new Set(["rahul", "rohan", "aditya", "kabir", "amit"]);

export function isMaleVoice(id: string | undefined): boolean {
  if (!id) return false;
  return MALE_VOICE_IDS.has(id.toLowerCase());
}

export interface VoiceAcousticConfig {
  pitch: number;
  rate: number;
  isMale: boolean;
}

export function getVoiceAcoustics(voiceId: string | undefined): VoiceAcousticConfig {
  const vid = (voiceId || "").toLowerCase();
  switch (vid) {
    // --- Male Voices (Distinct Timbres & Cadences) ---
    // Kabir: Deep, heavy, commanding baritone
    case "kabir":
      return { pitch: 0.58, rate: 0.85, isMale: true };
    // Amit: Mature, calm, trustworthy baritone
    case "amit":
      return { pitch: 0.68, rate: 0.90, isMale: true };
    // Aditya: Crisp, articulated, authoritative corporate male
    case "aditya":
      return { pitch: 0.76, rate: 0.96, isMale: true };
    // Rahul: Warm, friendly, approachable conversational male
    case "rahul":
      return { pitch: 0.85, rate: 0.94, isMale: true };
    // Rohan: Vibrant, dynamic, energetic, fast-talking young male
    case "rohan":
      return { pitch: 1.00, rate: 1.08, isMale: true };

    // --- Female Voices (Distinct Timbres & Cadences) ---
    // Kavya: Composed, dignified, polite, calm female
    case "kavya":
      return { pitch: 0.88, rate: 0.88, isMale: false };
    // Ritu: Warm, natural, balanced, friendly support female
    case "ritu":
      return { pitch: 0.98, rate: 0.94, isMale: false };
    // Neha: Soft, gentle, comforting, patient healthcare female
    case "neha":
      return { pitch: 1.02, rate: 0.84, isMale: false };
    // Shreya: Modern, expressive, punchy urban female
    case "shreya":
      return { pitch: 1.08, rate: 1.00, isMale: false };
    // Priya: Crisp, polished, professional corporate female
    case "priya":
      return { pitch: 1.14, rate: 0.96, isMale: false };
    // Pooja: High-energy, enthusiastic, upbeat sales female
    case "pooja":
      return { pitch: 1.24, rate: 1.08, isMale: false };

    default:
      if (isMaleVoice(vid)) {
        return { pitch: 0.82, rate: 0.95, isMale: true };
      }
      return { pitch: 1.02, rate: 0.95, isMale: false };
  }
}

// Specific browser voice preference routing per voice persona
const PERSONA_VOICE_PREFERENCES: Record<string, string[]> = {
  // Male voices
  rohan: ["guy", "ryan", "ravi", "google us english", "google uk english male", "david"],
  kabir: ["prabhat", "george", "david", "richard", "stefan", "ravi"],
  aditya: ["mark", "ravi", "david", "stefan", "google uk english male"],
  rahul: ["ravi", "david", "brian", "guy", "mark"],
  amit: ["prabhat", "richard", "george", "ravi", "david"],

  // Female voices
  pooja: ["neerja", "jenny", "google uk english female", "swara", "zira"],
  neha: ["heera", "kalpana", "swara", "neerja"],
  priya: ["zira", "neerja", "swara", "kalpana"],
  ritu: ["swara", "heera", "neerja", "zira"],
  shreya: ["jenny", "zira", "neerja", "swara"],
  kavya: ["kalpana", "heera", "swara", "neerja"],
};

export function findBrowserVoice(
  voices: SpeechSynthesisVoice[], 
  isMale: boolean, 
  langCode: string = "en-IN", 
  text: string = "",
  voiceId?: string
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const vid = (voiceId || "").toLowerCase();
  const MALE_NAMES = ["male", "prabhat", "ravi", "david", "guy", "ryan", "mark", "george", "richard", "james", "stefan", "brian", "eric", "christopher", "hemant", "en-in-standard-b", "en-in-standard-c", "en-in-wavenet-b", "en-in-wavenet-c"];
  const FEMALE_NAMES = ["female", "swara", "neerja", "heera", "kalpana", "priya", "veena", "ananya", "zira", "jenny", "en-in-standard-a", "en-in-standard-d", "en-in-wavenet-a", "en-in-wavenet-d"];

  const checkIsMaleVoice = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    return MALE_NAMES.some(m => n.includes(m)) && !FEMALE_NAMES.some(f => n.includes(f));
  };

  const checkIsFemaleVoice = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase();
    return FEMALE_NAMES.some(f => n.includes(f)) || (!MALE_NAMES.some(m => n.includes(m)) && !n.includes("male"));
  };

  const isGujarati = /[\u0A80-\u0AFF]/.test(text) || langCode.toLowerCase().startsWith("gu");
  if (isGujarati) {
    const gujVoice = voices.find(v => v.lang.toLowerCase().startsWith("gu") || v.name.toLowerCase().includes("gujarati"));
    if (gujVoice) return gujVoice;
  }

  // 1. Try persona-specific preferred voice names first
  const preferredNames = PERSONA_VOICE_PREFERENCES[vid] || [];
  for (const pref of preferredNames) {
    const matchedPref = voices.find(v => {
      const n = v.name.toLowerCase();
      if (!n.includes(pref)) return false;
      return isMale ? checkIsMaleVoice(v) : checkIsFemaleVoice(v);
    });
    if (matchedPref) return matchedPref;
  }

  if (isMale) {
    // 2. Indian English / Hindi Male Voice
    const indianMale = voices.find(v => (
      v.name.toLowerCase().includes("ravi") || 
      v.name.toLowerCase().includes("prabhat") || 
      (v.lang.toLowerCase().includes("in") && checkIsMaleVoice(v))
    ));
    if (indianMale) return indianMale;

    // 3. Any natural/neural male voice
    const naturalMale = voices.find(v => 
      checkIsMaleVoice(v) && 
      (v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("online") || v.name.toLowerCase().includes("neural"))
    );
    if (naturalMale) return naturalMale;

    // 4. Any male voice in the OS
    const anyMale = voices.find(v => checkIsMaleVoice(v));
    if (anyMale) return anyMale;

    // 5. Fallback
    return voices.find(v => !FEMALE_NAMES.some(f => v.name.toLowerCase().includes(f))) || voices[0];
  } else {
    // 2. Indian English / Hindi Female Voice
    const indianFemale = voices.find(v => (
      v.name.toLowerCase().includes("swara") || 
      v.name.toLowerCase().includes("neerja") || 
      v.name.toLowerCase().includes("heera") || 
      v.name.toLowerCase().includes("kalpana") || 
      (v.lang.toLowerCase().includes("in") && checkIsFemaleVoice(v))
    ));
    if (indianFemale) return indianFemale;

    // 3. Any natural/neural female voice (e.g. Zira, Swara)
    const naturalFemale = voices.find(v => 
      checkIsFemaleVoice(v) && 
      (v.name.toLowerCase().includes("natural") || v.name.toLowerCase().includes("online") || v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("neural"))
    );
    if (naturalFemale) return naturalFemale;

    // 4. Any female voice
    const anyFemale = voices.find(v => checkIsFemaleVoice(v));
    if (anyFemale) return anyFemale;

    return voices[0];
  }
}

