import { fetchApi } from './client';

export interface AnalyticsKPI {
  total_conversations: number;
  total_customer_messages: number;
  ai_requests: number;
  total_tokens: number;
  total_cost: number;
  success_rate: number;
  active_agents: number;
}

export interface UsageTrend {
  date: string;
  conversations: number;
  ai_requests: number;
  total_tokens: number;
  cost: number;
}

export interface ProviderUsage {
  provider: string;
  api_calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  success: number;
  failed: number;
  cost: number | null;
  models: {
    model: string;
    api_calls: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    success: number;
    failed: number;
    avg_latency: number;
    cost: number | null;
  }[];
}

export interface AgentUsage {
  agent_id: string;
  name: string;
  conversations: number;
  ai_requests: number;
  total_tokens: number;
  cost: number;
  success_rate: number;
  failed: number;
}

export interface RecentActivity {
  _id: string;
  started_at: string;
  duration_seconds: number;
  turn_count: number;
  status: string;
  agent_name: string;
  direction?: string;
}

export interface TopicCount {
  topic: string;
  count: number;
}

export interface TopQuestion {
  question: string;
  count: number;
}

export interface DetailedAnalytics {
  kpi: AnalyticsKPI;
  usage_trend: UsageTrend[];
  providers: ProviderUsage[];
  agents: AgentUsage[];
  recent_activity: RecentActivity[];
  topics: TopicCount[];
  top_questions: TopQuestion[];
  total_user_messages_analyzed: number;
}

export const analyticsApi = {
  get: async (companyId: string, range: string = '30d'): Promise<DetailedAnalytics> => {
    return fetchApi(`/companies/${companyId}/analytics?range=${range}`);
  },
};
