import { fetchApi } from "./client";

export interface PlatformSettings {
  platform_name: string;
  default_language: string;
  default_timezone: string;
  logo_path?: string;
  has_logo?: boolean;
}

export interface AIDefaults {
  default_provider: string;
  default_model: string;
  default_token_limit: number;
  default_temperature: number;
}

export interface SecuritySettings {
  session_timeout_minutes: number;
  require_strong_passwords: boolean;
}

export interface NotificationSettings {
  admin_notifications_enabled: boolean;
  system_alerts_enabled: boolean;
  security_alerts_enabled: boolean;
}

export interface SystemSettings {
  maintenance_mode: boolean;
  maintenance_message: string;
}

export interface GlobalSettings {
  type: string;
  platform: PlatformSettings;
  ai_defaults: AIDefaults;
  security: SecuritySettings;
  notifications: NotificationSettings;
  system: SystemSettings;
  pricing?: any;
  updated_at?: string;
  env_overrides?: {
    ai_billing_enforcement: boolean;
  };
}

export async function getAdminSettings(): Promise<GlobalSettings> {
  const res = await fetchApi<{ settings: GlobalSettings }>("/admin/settings");
  return res.settings;
}

export async function updateAdminSettings(data: Partial<{
  platform: Partial<PlatformSettings>;
  ai_defaults: Partial<AIDefaults>;
  security: Partial<SecuritySettings>;
  notifications: Partial<NotificationSettings>;
  system: Partial<SystemSettings>;
  pricing: any;
}>): Promise<GlobalSettings> {
  const res = await fetchApi<{ success: boolean; settings: GlobalSettings }>("/admin/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.settings;
}

export async function uploadPlatformLogo(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  
  await fetchApi("/admin/settings/logo", {
    method: "POST",
    body: formData,
  });
}

export async function removePlatformLogo(): Promise<void> {
  await fetchApi("/admin/settings/logo", {
    method: "DELETE",
  });
}

// ── Company Settings API ────────────────────────────────────────────────────────

export interface CompanySettingsData {
  default_agent?: string;
  default_language?: string;
  default_voice?: string;
  business_hours?: any;
  greeting_message?: string;
  business_email?: string;
  phone?: string;
  website?: string;
  address?: string;
  legal_name?: string;
  business_description?: string;
  logo_url?: string;
  [key: string]: any;
}

export interface CompanyProfile {
  id: string;
  name: string;
  industry?: string;
  country: string;
  timezone: string;
  plan: string;
  is_active: boolean;
  settings: CompanySettingsData;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  is_verified?: boolean;
}

export const companySettingsApi = {
  // Company
  getCompany: (companyId: string) =>
    fetchApi<CompanyProfile>(`/companies/${companyId}`),

  updateCompany: (companyId: string, data: Partial<CompanyProfile>) =>
    fetchApi<CompanyProfile>(`/companies/${companyId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getSubscription: (companyId: string) =>
    fetchApi(`/companies/${companyId}/subscription`),

  autoFillFromKB: (companyId: string) =>
    fetchApi<any>(`/companies/${companyId}/autofill-from-kb`, {
      method: "POST"
    }),

  listCustomVoices: (companyId: string) =>
    fetchApi<{ voices: Array<{ id: string; name?: string; display_name?: string; voice_id?: string }> }>(`/companies/${companyId}/voices`),

  generateGreeting: (companyId: string, direction: "inbound" | "outbound", language: string) =>
    fetchApi<{ greeting: string; direction: string }>(`/companies/${companyId}/greeting-suggestions`, {
      method: "POST",
      body: JSON.stringify({ direction, language }),
    }),

  uploadCompanyLogo: async (companyId: string, file: File): Promise<{ logo_url: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    return fetchApi<{ logo_url: string }>(`/companies/${companyId}/logo`, {
      method: "POST",
      body: formData,
    });
  },

  removeCompanyLogo: (companyId: string) =>
    fetchApi(`/companies/${companyId}/logo`, {
      method: "DELETE",
    }),

  // Team
  getTeamMembers: (companyId: string) =>
    fetchApi(`/companies/${companyId}/team`),

  inviteTeamMember: (companyId: string, email: string, role: string) =>
    fetchApi(`/companies/${companyId}/team`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),

  updateTeamMember: (companyId: string, userId: string, role: string) =>
    fetchApi(`/companies/${companyId}/team/${userId}?role=${role}`, {
      method: "PATCH",
    }),

  removeTeamMember: (companyId: string, userId: string) =>
    fetchApi(`/companies/${companyId}/team/${userId}`, {
      method: "DELETE",
    }),

  // User Auth
  getMe: () => fetchApi<UserProfile>("/auth/me"),
  
  updateMe: (data: { name?: string; avatar_url?: string }) =>
    fetchApi<UserProfile>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  changePassword: (data: any) =>
    fetchApi("/auth/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
