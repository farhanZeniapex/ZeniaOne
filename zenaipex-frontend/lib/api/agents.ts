import { fetchApi } from "./client";

export interface Agent {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description?: string;
  system_prompt: string;
  default_language: string;
  supported_languages: string[];
  tts_voice: string;
  tts_model: string;
  voice_engine?: "pipeline" | "gemini_live" | "gemini_clone";
  gemini_voice?: string;
  llm_model: string;
  llm_max_tokens: number;
  llm_temperature: number;
  greeting_messages: Record<string, string>;
  goodbye_messages: Record<string, string>;
  knowledge_base_id?: string;
  max_conversation_turns: number;
  silence_timeout_ms: number;
  force_process_timeout_sec: number;
  enable_background_audio: boolean;
  status: "active" | "draft" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface CustomVoice {
  id: string;
  voice_id?: string;
  name?: string;
  gender?: "Male" | "Female";
  description?: string;
  tone?: string;
  status?: string;
}

export const agentsApi = {
  list: (companyId: string) => 
    fetchApi<{agents: Agent[], count: number}>(`/companies/${companyId}/agents`),
  
  get: (companyId: string, agentId: string) => 
    fetchApi<Agent>(`/companies/${companyId}/agents/${agentId}`),
    
  create: (companyId: string, data: Partial<Agent>) => 
    fetchApi<Agent>(`/companies/${companyId}/agents`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  update: (companyId: string, agentId: string, data: Partial<Agent>) => 
    fetchApi<Agent>(`/companies/${companyId}/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
    
  activate: (companyId: string, agentId: string) => 
    fetchApi<{success: boolean, status: string}>(`/companies/${companyId}/agents/${agentId}/activate`, {
      method: "POST",
    }),
    
  delete: (companyId: string, agentId: string) => 
    fetchApi<{success: boolean}>(`/companies/${companyId}/agents/${agentId}`, {
      method: "DELETE",
    }),

  testChat: (companyId: string, agentId: string, message: string, history: {role: string, content: string}[], conversationId?: string) => 
    fetchApi<{answer: string, sources: any[], conversation_id?: string}>(`/companies/${companyId}/agents/${agentId}/test-chat`, {
      method: "POST",
      body: JSON.stringify({ message, history, conversation_id: conversationId }),
    }),

  createConversation: (companyId: string, agentId: string, direction: "test-chat" | "voice_chat" = "test-chat") =>
    fetchApi<{conversation_id: string}>(`/companies/${companyId}/agents/${agentId}/conversations?direction=${direction}`, {
      method: "POST",
    }),

  testVoiceChat: async (companyId: string, agentId: string, audioBlob: Blob, history: {role: string, content: string}[], conversationId?: string, speechStartMs?: number, speechEndMs?: number, pendingTranscript?: string) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("history", JSON.stringify(history));
    if (conversationId) {
      formData.append("conversation_id", conversationId);
    }
    if (speechStartMs !== undefined) {
      formData.append("speech_start_ms", speechStartMs.toString());
    }
    if (speechEndMs !== undefined) {
      formData.append("speech_end_ms", speechEndMs.toString());
    }
    if (pendingTranscript) {
      formData.append("pending_transcript", pendingTranscript);
    }
    
    return fetchApi<{answer: string, sources: any[], conversation_id?: string, transcript?: string, audio_base64?: string, no_speech?: boolean, is_incomplete?: boolean}>(
      `/companies/${companyId}/agents/${agentId}/voice-chat`, 
      {
        method: "POST",
        body: formData,
      }
    );
  },

  generateRole: (companyId: string, agentName: string, companyName?: string, industry?: string, country?: string) => 
    fetchApi<{draft_role: string}>(`/companies/${companyId}/agents/generate-role`, {
      method: "POST",
      body: JSON.stringify({ agent_name: agentName, company_name: companyName, industry, country }),
    }),

  speak: (companyId: string, agentId: string, text: string) =>
    fetchApi<{ audio_base64: string; audio_bytes: number; fallback_tts?: boolean }>(
      `/companies/${companyId}/agents/${agentId}/speak`,
      {
        method: "POST",
        body: JSON.stringify({ text }),
      }
    ),

  previewVoice: (companyId: string, voice: string, text?: string, language?: string) =>
    fetchApi<{ audio_base64: string; audio_bytes: number; fallback_tts?: boolean }>(
      `/companies/${companyId}/voices/preview`,
      {
        method: "POST",
        body: JSON.stringify({ voice, text, language }),
      }
    ),

  listCustomVoices: (companyId: string) =>
    fetchApi<{ voices: CustomVoice[] }>(`/companies/${companyId}/voices`),
};
