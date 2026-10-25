import { fetchApi } from "./client";

export interface Company {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  country: string;
  timezone: string;
  plan: string;
  is_active: boolean;
  user_role?: string;
}

export const companiesApi = {
  list: () => 
    fetchApi<{companies: Company[]}>("/companies"),
    
  get: (id: string) => 
    fetchApi<Company>(`/companies/${id}`),
    
  getOverview: (id: string) =>
    fetchApi<{metrics: {
      total_agents: number;
      active_agents: number;
      total_conversations: number;
      total_documents: number;
      call_minutes_used: number;
    }}>(`/companies/${id}/overview`),
    
  getUsage: (id: string) =>
    fetchApi<{
      subscription: { plan: string; status: string; limits: Record<string, number> };
      usage: { minutes_used: number; storage_mb_used: number };
    }>(`/companies/${id}/subscription`),
};
