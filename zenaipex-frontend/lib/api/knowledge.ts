import { fetchApi } from "./client";

export interface KnowledgeBase {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  pinecone_namespace: string;
  embedding_model: string;
  total_documents: number;
  total_chunks: number;
  total_vectors: number;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  knowledge_base_id: string;
  filename: string;
  content_type: string;
  file_size_bytes: number;
  status: "pending" | "processing" | "ready" | "failed";
  chunk_count: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
  version?: number;
  source_url?: string;
  auto_sync?: boolean;
  crawl_options?: {
    max_pages: number;
    max_depth: number;
    include_subdomains: boolean;
    include_pdfs: boolean;
    follow_sitemap: boolean;
    include_patterns: string[];
    exclude_patterns: string[];
  };
  crawl_report?: {
    pages_discovered: number;
    pages_scraped: number;
    pages_skipped: number;
    characters_extracted: number;
    crawl_limit: number;
    failed_pages?: Array<{ url: string; error: string }>;
  };
}

export const knowledgeApi = {
  createKnowledgeBase: (companyId: string, data: { name: string; description?: string }) =>
    fetchApi<KnowledgeBase>(`/companies/${companyId}/knowledge-bases`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listKnowledgeBases: (companyId: string) =>
    fetchApi<{ knowledge_bases: KnowledgeBase[] }>(`/companies/${companyId}/knowledge-bases`),

  getKnowledgeBase: (companyId: string, kbId: string) =>
    fetchApi<KnowledgeBase>(`/companies/${companyId}/knowledge-bases/${kbId}`),

  uploadDocument: (companyId: string, kbId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetchApi<Document>(`/companies/${companyId}/knowledge-bases/${kbId}/documents`, {
      method: "POST",
      body: formData,
    });
  },

  uploadUrl: (companyId: string, kbId: string, data: {
    url: string;
    max_pages: number;
    max_depth: number;
    include_subdomains: boolean;
    include_pdfs: boolean;
    follow_sitemap: boolean;
    include_patterns: string[];
    exclude_patterns: string[];
  }) =>
    fetchApi<Document>(`/companies/${companyId}/knowledge-bases/${kbId}/url`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  uploadText: (companyId: string, kbId: string, title: string, content: string) =>
    fetchApi<Document>(`/companies/${companyId}/knowledge-bases/${kbId}/text`, {
      method: "POST",
      body: JSON.stringify({ title, content }),
    }),

  listDocuments: (companyId: string, kbId: string, skip = 0, limit = 50) =>
    fetchApi<{ documents: Document[]; count: number }>(
      `/companies/${companyId}/knowledge-bases/${kbId}/documents?skip=${skip}&limit=${limit}`
    ),

  getDocument: (companyId: string, kbId: string, docId: string) =>
    fetchApi<Document>(`/companies/${companyId}/knowledge-bases/${kbId}/documents/${docId}`),

  getDocumentChunks: (companyId: string, kbId: string, docId: string) =>
    fetchApi<{ chunks: any[] }>(`/companies/${companyId}/knowledge-bases/${kbId}/documents/${docId}/chunks`),

  retryDocument: (companyId: string, kbId: string, docId: string) =>
    fetchApi<Document>(`/companies/${companyId}/knowledge-bases/${kbId}/documents/${docId}/retry`, {
      method: "POST",
    }),

  downloadDocument: async (companyId: string, kbId: string, docId: string) => {
    const token = localStorage.getItem("zenaipex_token");
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === "production"
      ? "https://zeniaone-backend.onrender.com/api/v1"
      : "http://127.0.0.1:8002/api/v1");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/companies/${companyId}/knowledge-bases/${kbId}/documents/${docId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal
      });
    } catch (error: any) {
      if (error.name === "AbortError") {
        throw new Error("Download timed out (backend might be restarting)");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
    
    if (!response.ok) throw new Error("Failed to download document");
    return response.blob();
  },

  deleteDocument: (companyId: string, kbId: string, docId: string) =>
    fetchApi<{ success: boolean; deleted: string }>(
      `/companies/${companyId}/knowledge-bases/${kbId}/documents/${docId}`,
      {
        method: "DELETE",
      }
    ),

  listVersions: (companyId: string, kbId: string, docId: string) =>
    fetchApi<{ current: { version: number; status: string; current: boolean }; versions: Array<{ version: number; filename: string; file_size_bytes: number; chunk_count: number; snapshotted_at: string }> }>(
      `/companies/${companyId}/knowledge-bases/${kbId}/documents/${docId}/versions`,
    ),

  restoreVersion: (companyId: string, kbId: string, docId: string, version: number) =>
    fetchApi<Document>(`/companies/${companyId}/knowledge-bases/${kbId}/documents/${docId}/versions/${version}/restore`, { method: "POST" }),

  getAccess: (companyId: string, kbId: string) =>
    fetchApi<{ scope: string; agent_ids: string[]; agents: Array<{ id: string; name: string; is_active: boolean; allowed: boolean }> }>(`/companies/${companyId}/knowledge-bases/${kbId}/access`),

  updateAccess: (companyId: string, kbId: string, agent_ids: string[]) =>
    fetchApi<{ scope: string; agent_ids: string[] }>(`/companies/${companyId}/knowledge-bases/${kbId}/access`, { method: "PUT", body: JSON.stringify({ agent_ids }) }),

  searchContent: (companyId: string, kbId: string, query: string) =>
    fetchApi<{ query: string; matches: Array<{ id: string; filename: string; status: Document["status"] }>; count: number }>(`/companies/${companyId}/knowledge-bases/${kbId}/content-search?q=${encodeURIComponent(query)}`),

  getAnalytics: (companyId: string, kbId: string) =>
    fetchApi<{ period_days: number; total_searches: number; successful_searches: number; no_result_searches: number; average_results: number }>(`/companies/${companyId}/knowledge-bases/${kbId}/analytics`),
};
