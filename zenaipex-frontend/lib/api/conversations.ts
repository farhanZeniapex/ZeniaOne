import { fetchApi } from "./client";

export interface Conversation {
  id: string;
  company_id: string;
  agent_id?: string;
  caller_phone?: string;
  caller_to?: string;
  from_phone?: string;
  to_phone?: string;
  contact_name?: string;
  call_sid?: string;
  recording_url?: string;
  recording_sid?: string;
  direction: string;
  source_type?: "phone_call" | "web_chat" | "voice_chat" | "admin_copilot" | "unverified" | string;
  actual_message_count?: number;
  language: string;
  status: string;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  turn_count: number;
  is_pinned?: boolean;
  is_archived?: boolean;
  title?: string;
  last_message?: string;
}

export interface TranscriptEntry {
  role: string;
  content: string;
  timestamp?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: string;
  text: string;
  timestamp?: string;
}

export const conversationsApi = {
  list: (companyId: string, opts?: { limit?: number; agentId?: string; status?: string; is_archived?: boolean }) => {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.agentId) params.set("agent_id", opts.agentId);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.is_archived !== undefined) params.set("is_archived", String(opts.is_archived));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return fetchApi<{conversations: Conversation[], count: number}>(`/companies/${companyId}/conversations${qs}`);
  },
    
  get: (companyId: string, id: string) => 
    fetchApi<Conversation>(`/companies/${companyId}/conversations/${id}`),
    
  getMessages: (companyId: string, id: string) => {
    try {
      throw new Error("Trace");
    } catch (e: any) {
      const stack = e.stack?.split("\n").slice(1, 4).join(" -> ") || "unknown";
      console.log(`[CONVERSATION_REQUEST] url=/companies/${companyId}/conversations/${id}/messages conversation_id=${id} source=api_client stack=${stack}`);
    }
    return fetchApi<{messages: any[], count: number}>(`/companies/${companyId}/conversations/${id}/messages`);
  },
    
  createForChannel: (companyId: string, channelId: string) =>
    fetchApi<Conversation>(`/companies/${companyId}/channels/${channelId}/conversations`, {
      method: "POST",
    }),
    
  chat: (companyId: string, convId: string, message: string) =>
    fetchApi<{ answer: string; sources: string[] }>(`/companies/${companyId}/conversations/${convId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  archive: (companyId: string, convId: string) =>
    fetchApi<{ success: boolean }>(`/companies/${companyId}/conversations/${convId}/archive`, {
      method: "POST",
    }),

  restore: (companyId: string, convId: string) =>
    fetchApi<{ success: boolean }>(`/companies/${companyId}/conversations/${convId}/restore`, {
      method: "POST",
    }),

  delete: (companyId: string, convId: string) =>
    fetchApi<{ success: boolean }>(`/companies/${companyId}/conversations/${convId}`, {
      method: "DELETE",
    }),

  pin: (companyId: string, convId: string) =>
    fetchApi<{ success: boolean }>(`/companies/${companyId}/conversations/${convId}/pin`, {
      method: "POST",
    }),

  unpin: (companyId: string, convId: string) =>
    fetchApi<{ success: boolean }>(`/companies/${companyId}/conversations/${convId}/unpin`, {
      method: "POST",
    }),

  bulkArchive: (companyId: string, conversationIds: string[]) =>
    fetchApi<{ success: boolean; count: number }>(`/companies/${companyId}/conversations/bulk-archive`, {
      method: "POST",
      body: JSON.stringify({ conversation_ids: conversationIds }),
    }),

  bulkDelete: (companyId: string, conversationIds: string[]) =>
    fetchApi<{ success: boolean; count: number }>(`/companies/${companyId}/conversations/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ conversation_ids: conversationIds }),
    }),
};
