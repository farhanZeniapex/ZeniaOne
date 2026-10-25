// Local development keeps the existing default. Hosted environments provide
// NEXT_PUBLIC_API_URL so browser requests never point at a visitor's localhost.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8002/api/v1";

export function getCompanyLogoUrl(companyId: string, logoUrlReference?: string): string | undefined {
  if (!companyId || !logoUrlReference) return undefined;
  return `${API_BASE_URL}/companies/${companyId}/logo?v=${encodeURIComponent(logoUrlReference)}`;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  
  if (typeof window !== "undefined") {
    token = localStorage.getItem("zenaipex_token");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (options.body && typeof (options.body as any).append === 'function') {
    delete headers["Content-Type"];
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const method = String(options.method || "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD" || method === "OPTIONS";
  const retryDelays = canRetry ? [0, 700, 1500, 3000, 6000] : [0];
  let response: Response | undefined;
  let lastError: any = null;

  for (const delay of retryDelays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      break;
    } catch (error: any) {
      lastError = error;
      if (error?.name === "AbortError") {
        throw new ApiError(504, "Server connection timed out (backend might be down or restarting).", null);
      }
      if (!canRetry) break;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (!response) {
    throw new ApiError(503, `Failed to connect to the server: ${lastError?.message || "Network request failed"}`, null);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // If token is invalid/expired, logout
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("zenaipex_token");
      window.location.assign("/login");
    }
    
    // If account is suspended
    if (response.status === 403 && typeof window !== "undefined") {
      const detail = data?.detail;
      if (typeof detail === "string" && detail.includes("account has been suspended")) {
        localStorage.removeItem("zenaipex_active_company_id"); // Clear scoped state if needed
        window.location.assign("/suspended");
      }
    }
    
    let errorMessage = "An error occurred";
    if (data && typeof data === 'object') {
      if (Array.isArray(data.detail)) {
        // Pydantic validation errors — extract human-readable messages
        errorMessage = data.detail
          .map((err: any) => {
            const field = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : "";
            const msg = err.msg || "Invalid value";
            return field && field !== "body" ? `${field}: ${msg}` : msg;
          })
          .join(" · ");
      } else if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (typeof data.detail === 'object' && data.detail !== null) {
        errorMessage = JSON.stringify(data.detail);
      } else if (typeof data.message === 'string') {
        errorMessage = data.message;
      } else if (Object.keys(data).length > 0) {
        // Last resort — stringify but cap length
        const str = JSON.stringify(data);
        errorMessage = str.length < 200 ? str : "An unexpected error occurred.";
      }
    }

    throw new ApiError(response.status, errorMessage, data);
  }

  return data;
}
