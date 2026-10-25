import { fetchApi } from './client';

export interface Channel {
  id: string;
  company_id: string;
  agent_id: string;
  name: string;
  type: 'twilio_voice' | 'exotel_voice' | 'exotel' | 'web_chat' | 'whatsapp' | 'sms' | string;
  phone_number?: string;
  public_identifier?: string;
  has_custom_twilio: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateChannelData {
  name: string;
  type: string;
  agent_id: string;
  phone_number?: string;
}

export interface UpdateChannelData {
  name?: string;
  agent_id?: string;
  phone_number?: string;
  is_active?: boolean;
}

export const channelsApi = {
  list: (companyId: string, type?: string) => {
    // We only need the query params, so we can just construct a local query string
    let path = `/companies/${companyId}/channels`;
    if (type) path += `?type=${encodeURIComponent(type)}`;
    return fetchApi<{ channels: Channel[]; count: number }>(path);
  },
  
  get: (companyId: string, channelId: string) => {
    return fetchApi<Channel>(`/companies/${companyId}/channels/${channelId}`);
  },

  create: (companyId: string, data: CreateChannelData) => {
    return fetchApi<Channel>(`/companies/${companyId}/channels`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (companyId: string, channelId: string, data: UpdateChannelData) => {
    return fetchApi<Channel>(`/companies/${companyId}/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete: (companyId: string, channelId: string) => {
    return fetchApi<{ success: boolean }>(`/companies/${companyId}/channels/${channelId}`, {
      method: 'DELETE',
    });
  }
};
