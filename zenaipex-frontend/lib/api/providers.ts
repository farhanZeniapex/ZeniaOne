import { fetchApi } from './client';

export interface AIProvider {
  id: string;
  provider: string; // 'sarvam' | 'gemini' | 'groq'
  enabled: boolean;
  priority: number;
  model: string;
  has_api_key: boolean;
  updated_at: string;
  updated_by: string;
  key_hint?: string | null;
}

export interface AIProviderUpdate {
  enabled?: boolean;
  priority?: number;
  api_key?: string;
  model?: string;
}

export interface RuntimeProvider {
  id: string;
  name: string;
  category: string;
  roles: string[];
  configured: boolean;
  source: string;
  model: string;
}

export type ProviderRouting = Record<string, Record<string, string[]>>;

export const providersApi = {
  /**
   * List all configured AI providers. Super Admin only.
   */
  listProviders: async (): Promise<AIProvider[]> => {
    return await fetchApi<AIProvider[]>('/admin/providers');
  },

  /**
   * Update a specific AI provider (enable/disable, update key/model, priority)
   */
  updateProvider: async (id: string, data: AIProviderUpdate): Promise<AIProvider> => {
    return await fetchApi<AIProvider>(`/admin/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * Test a provider's connection
   */
  testConnection: async (id: string, data?: { api_key?: string; model?: string }): Promise<{ status: string; message: string }> => {
    return await fetchApi<{ status: string; message: string }>(`/admin/providers/${id}/test`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  },
  getRuntime: async (): Promise<{ providers: RuntimeProvider[]; routing: ProviderRouting }> => {
    return await fetchApi<{ providers: RuntimeProvider[]; routing: ProviderRouting }>("/admin/providers/runtime");
  },
  updateRuntimeRouting: async (routing: ProviderRouting): Promise<{ routing: ProviderRouting }> => {
    return await fetchApi<{ routing: ProviderRouting }>("/admin/providers/runtime/routing", {
      method: "PUT",
      body: JSON.stringify({ routing }),
    });
  },
};
