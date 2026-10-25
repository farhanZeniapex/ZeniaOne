"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Book,
  FileText,
  Upload,
  Trash2,
  Loader2,
  Database,
  Search,
  Filter,
  CheckCircle2,
  RotateCcw,
  ExternalLink,
  X,
  Copy,
  Check,
  RefreshCw,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ShieldCheck,
  BarChart3,
  History,
  CloudCog,
  AlertTriangle,
} from "lucide-react";
import { useCurrentCompany } from "@/hooks/use-company";
import {
  formatRelativeTime,
  formatBytes,
  formatSystemDateTime,
} from "@/lib/utils";
import { SubtleGrid } from "@/components/ui/decorative-backgrounds";
import { knowledgeApi, Document, KnowledgeBase } from "@/lib/api/knowledge";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toast } from "@/components/ui/toast";

export default function KnowledgeBasePage() {
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL & Text Upload State
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [crawlOptions, setCrawlOptions] = useState({
    max_pages: 20,
    max_depth: 3,
    include_subdomains: true,
    include_pdfs: false,
    follow_sitemap: false,
    include_patterns: "",
    exclude_patterns: "",
  });
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [textTitleInput, setTextTitleInput] = useState("");
  const [textContentInput, setTextContentInput] = useState("");

  // Chunk Viewer State
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [docChunks, setDocChunks] = useState<any[]>([]);
  const [isChunksLoading, setIsChunksLoading] = useState(false);
  const [chunkSearchQuery, setChunkSearchQuery] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [operationNotice, setOperationNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Document["status"]>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [contentMatchIds, setContentMatchIds] = useState<Set<string> | null>(null);
  const [analytics, setAnalytics] = useState<{ total_searches: number; successful_searches: number; no_result_searches: number; average_results: number } | null>(null);
  const [accessAgents, setAccessAgents] = useState<Array<{ id: string; name: string; is_active: boolean; allowed: boolean }>>([]);
  const [accessDraft, setAccessDraft] = useState<string[]>([]);
  const [showAccessEditor, setShowAccessEditor] = useState(false);
  const [isAccessSaving, setIsAccessSaving] = useState(false);
  const [versionDocId, setVersionDocId] = useState<string | null>(null);
  const [versions, setVersions] = useState<Array<{ version: number; filename: string; file_size_bytes: number; chunk_count: number; snapshotted_at: string }>>([]);

  const handleCopyAll = async () => {
    if (!docChunks || docChunks.length === 0) return;

    const textToCopy = docChunks
      .map((c, i) => {
        return `===== Chunk ${i + 1} =====\nModule: ${c.module_number || "N/A"}\nSection: ${c.section || "N/A"}\nPage: ${c.page_number || "N/A"}\n\n${c.text}`;
      })
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
      setOperationNotice({
        tone: "error",
        message: "Could not copy chunks. Please try again.",
      });
    }
  };

  const loadData = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoadError(null);
      let currentKb = kb;
      if (!currentKb) {
        const kbRes = await knowledgeApi.listKnowledgeBases(companyId);
        if (kbRes.knowledge_bases && kbRes.knowledge_bases.length > 0) {
          currentKb = kbRes.knowledge_bases[0];
          setKb(currentKb);
        } else {
          const newKb = await knowledgeApi.createKnowledgeBase(companyId, {
            name: "Default Knowledge Base",
            description: "Main knowledge base for the company",
          });
          currentKb = newKb;
          setKb(currentKb);
        }
      }

      if (currentKb) {
        const docRes = await knowledgeApi.listDocuments(
          companyId,
          currentKb.id,
        );
        setDocuments(docRes.documents || []);
      }
    } catch (error: any) {
      console.error(error);
      setLoadError(
        error?.data?.detail ||
          error?.message ||
          "Knowledge data could not be loaded. Please refresh and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [companyId, kb]);

  useEffect(() => {
    if (!companyId) {
      if (!isCompanyLoading) setIsLoading(false);
      return;
    }
    loadData();
  }, [companyId, isCompanyLoading, loadData]);

  // Polling for processing documents
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.status === "processing" || d.status === "pending",
    );
    if (hasProcessing) {
      const interval = setInterval(loadData, 3000);
      return () => clearInterval(interval);
    }
  }, [documents, loadData]);

  useEffect(() => {
    if (!companyId || !kb) return;
    Promise.all([knowledgeApi.getAnalytics(companyId, kb.id), knowledgeApi.getAccess(companyId, kb.id)])
      .then(([stats, access]) => {
        setAnalytics(stats);
        setAccessAgents(access.agents || []);
        setAccessDraft((access.agent_ids || []).slice());
      })
      .catch((error) => console.error("Knowledge controls could not be loaded", error));
  }, [companyId, kb]);

  useEffect(() => {
    if (!companyId || !kb || searchQuery.trim().length < 2) {
      setContentMatchIds(null);
      return;
    }
    const timer = window.setTimeout(() => {
      knowledgeApi.searchContent(companyId, kb.id, searchQuery.trim())
        .then((result) => setContentMatchIds(new Set(result.matches.map((match) => match.id))))
        .catch((error) => { console.error("Content search failed", error); setContentMatchIds(null); });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [companyId, kb, searchQuery]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !companyId || !kb) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      // Upload sequentially for simplicity
      for (let i = 0; i < files.length; i++) {
        if (files[i].size > 50 * 1024 * 1024) {
          setOperationNotice({
            tone: "error",
            message: `${files[i].name} is larger than the 50 MB upload limit.`,
          });
          continue;
        }
        await knowledgeApi.uploadDocument(companyId, kb.id, files[i]);
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      await loadData();
    } catch (error: any) {
      console.error("Upload failed", error);
      setOperationNotice({
        tone: "error",
        message:
          error?.data?.detail ||
          error?.message ||
          "Document upload failed. Please try again.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [crawlText, setCrawlText] = useState("Preparing website import…");

  const handleUploadUrl = async () => {
    if (!companyId || !kb || !urlInput.trim()) return;
    setIsUploading(true);
    setCrawlText("Fetching website content and creating knowledge chunks…");

    try {
      await knowledgeApi.uploadUrl(companyId, kb.id, {
        url: urlInput.trim(),
        max_pages: crawlOptions.max_pages,
        max_depth: crawlOptions.max_depth,
        include_subdomains: crawlOptions.include_subdomains,
        include_pdfs: crawlOptions.include_pdfs,
        follow_sitemap: crawlOptions.follow_sitemap,
        include_patterns: crawlOptions.include_patterns.split(",").map((v) => v.trim()).filter(Boolean),
        exclude_patterns: crawlOptions.exclude_patterns.split(",").map((v) => v.trim()).filter(Boolean),
      });
      setIsUrlModalOpen(false);
      setUrlInput("");
      await loadData();
      setOperationNotice({
        tone: "success",
        message:
          "Website content was added to the knowledge base. Indexing status appears in the document list.",
      });
    } catch (error: any) {
      console.error("URL upload failed", error);
      setOperationNotice({
        tone: "error",
        message:
          error?.data?.detail ||
          error?.message ||
          "Website import failed. Check the URL and try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadText = async () => {
    if (!companyId || !kb || !textTitleInput.trim() || !textContentInput.trim())
      return;
    setIsUploading(true);
    try {
      await knowledgeApi.uploadText(
        companyId,
        kb.id,
        textTitleInput.trim(),
        textContentInput.trim(),
      );
      setIsTextModalOpen(false);
      setTextTitleInput("");
      setTextContentInput("");
      await loadData();
    } catch (error: any) {
      console.error("Text upload failed", error);
      setOperationNotice({
        tone: "error",
        message:
          error?.data?.detail ||
          error?.message ||
          "Could not add the text to the knowledge base.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  const handleDelete = async (docId: string) => {
    if (!companyId || !kb) return;
    if (!confirm("Are you sure you want to delete this document?")) return;

    // Optimistic update
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(docId);
      return next;
    });
    try {
      await knowledgeApi.deleteDocument(companyId, kb.id, docId);
      await loadData();
    } catch (error) {
      console.error("Delete failed", error);
      await loadData(); // revert
    }
  };

  const toggleSelected = (docId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const handleBulkRetry = async () => {
    if (!companyId || !kb || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setDocuments((prev) => prev.map((doc) => ids.includes(doc.id) ? { ...doc, status: "processing" } : doc));
    await Promise.allSettled(ids.map((id) => knowledgeApi.retryDocument(companyId, kb.id, id)));
    setSelectedIds(new Set());
    await loadData();
    setOperationNotice({ tone: "success", message: `${ids.length} document${ids.length > 1 ? "s" : ""} queued for re-processing.` });
  };

  const handleBulkDelete = async () => {
    if (!companyId || !kb || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (!window.confirm(`Delete ${ids.length} selected document${ids.length > 1 ? "s" : ""}?`)) return;
    await Promise.allSettled(ids.map((id) => knowledgeApi.deleteDocument(companyId, kb.id, id)));
    setSelectedIds(new Set());
    await loadData();
    setOperationNotice({ tone: "success", message: `${ids.length} document${ids.length > 1 ? "s" : ""} deleted.` });
  };

  const handleOpen = async (docId: string, filename: string) => {
    if (!companyId || !kb) return;
    try {
      const blob = await knowledgeApi.downloadDocument(companyId, kb.id, docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // If PDF, suggest open in new tab. Other files will likely download or preview natively based on browser.
      a.target = "_blank";
      // We don't force a download attribute so PDFs open natively in tab.
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error("Failed to open document", error);
      setOperationNotice({
        tone: "error",
        message: "Could not open this document.",
      });
    }
  };

  const handleRetry = async (docId: string) => {
    if (!companyId || !kb) return;
    try {
      // Optimistic update
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: "processing" } : d)),
      );
      await knowledgeApi.retryDocument(companyId, kb.id, docId);
      await loadData();
      setOperationNotice({
        tone: "success",
        message:
          "Document processing restarted. Its live status will update automatically.",
      });
    } catch (error) {
      console.error("Retry failed", error);
      setOperationNotice({
        tone: "error",
        message: "Could not restart document processing.",
      });
      await loadData(); // revert
    }
  };

  const handleViewChunks = async (docId: string) => {
    if (!companyId || !kb) return;
    setSelectedDocId(docId);
    setIsChunksLoading(true);
    setChunkSearchQuery("");
    try {
      const res = await knowledgeApi.getDocumentChunks(companyId, kb.id, docId);
      setDocChunks(res.chunks || []);
    } catch (error) {
      console.error("Failed to load chunks", error);
      setOperationNotice({
        tone: "error",
        message: "Could not load document chunks.",
      });
      setSelectedDocId(null);
    } finally {
      setIsChunksLoading(false);
    }
  };

  const handleViewVersions = async (docId: string) => {
    if (!companyId || !kb) return;
    try {
      const result = await knowledgeApi.listVersions(companyId, kb.id, docId);
      setVersions(result.versions || []);
      setVersionDocId(docId);
    } catch (error) {
      console.error("Version history failed", error);
      setOperationNotice({ tone: "error", message: "Could not load version history." });
    }
  };

  const handleRestoreVersion = async (version: number) => {
    if (!companyId || !kb || !versionDocId) return;
    try {
      await knowledgeApi.restoreVersion(companyId, kb.id, versionDocId, version);
      setVersionDocId(null);
      await loadData();
      setOperationNotice({ tone: "success", message: `Version ${version} queued for restore and re-indexing.` });
    } catch (error) {
      console.error("Version restore failed", error);
      setOperationNotice({ tone: "error", message: "Could not restore this version." });
    }
  };

  const handleSaveAccess = async () => {
    if (!companyId || !kb) return;
    setIsAccessSaving(true);
    try {
      await knowledgeApi.updateAccess(companyId, kb.id, accessDraft);
      setAccessAgents((prev) => prev.map((agent) => ({ ...agent, allowed: accessDraft.length === 0 || accessDraft.includes(agent.id) })));
      setShowAccessEditor(false);
      setOperationNotice({ tone: "success", message: "Knowledge access policy saved." });
    } catch (error) {
      console.error("Access policy save failed", error);
      setOperationNotice({ tone: "error", message: "Could not save knowledge access policy." });
    } finally { setIsAccessSaving(false); }
  };

  const fileTypes = Array.from(new Set(documents.map((doc) => doc.content_type || "unknown")));
  const filteredDocuments = documents.filter((doc) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery = !query || doc.filename.toLowerCase().includes(query) || (doc.content_type || "").toLowerCase().includes(query) || (contentMatchIds !== null && contentMatchIds.has(doc.id));
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    const matchesType = typeFilter === "all" || (doc.content_type || "unknown") === typeFilter;
    return matchesQuery && matchesStatus && matchesType;
  });
  const allVisibleSelected = filteredDocuments.length > 0 && filteredDocuments.every((doc) => selectedIds.has(doc.id));
  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filteredDocuments.forEach((doc) => next.delete(doc.id));
      else filteredDocuments.forEach((doc) => next.add(doc.id));
      return next;
    });
  };

  if (isLoading || isCompanyLoading) {
    return <PageLoadingSkeleton cards={3} />;
  }

  if (!companyId) return null;

  return (
    <div className="space-y-7 animate-in fade-in duration-500">
      {operationNotice && (
        <Toast
          message={operationNotice.message}
          tone={operationNotice.tone}
          onClose={() => setOperationNotice(null)}
        />
      )}
      {loadError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}
      <div className="relative overflow-hidden rounded-[26px] border border-[#CBE0D1] bg-[#09281C] px-5 py-6 text-white shadow-[0_20px_55px_rgba(11,46,33,.14)] sm:px-7 sm:py-7">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[#6EE69C]/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#A7E6B8]">
              <Book className="h-4 w-4" /> Knowledge workspace
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Knowledge Base
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#C7DBCF]">
              Train your agents with trusted company data and keep every source
              ready for accurate answers.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            >
              <Database className="mr-2 h-4 w-4 text-slate-500" /> Settings
            </Button>

            <Button
              className="border-white/20 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setIsTextModalOpen(true)}
              disabled={isUploading || !kb}
            >
              <FileText className="mr-2 h-4 w-4 text-slate-500" /> Add Text
            </Button>

            <Button
              className="border-white/20 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setIsUrlModalOpen(true)}
              disabled={isUploading || !kb}
            >
              <ExternalLink className="mr-2 h-4 w-4 text-slate-500" /> Add URL
            </Button>

            <Button
              className="bg-[#08A66A] text-white shadow-sm hover:bg-[#07945E]"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || !kb}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {isUploading ? "Uploading..." : "Upload File"}
            </Button>
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              multiple
              accept=".txt,.pdf,.md,.docx"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>
        </div>
      </div>

      {isUploading && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold text-emerald-900">
            <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processing knowledge sources</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-emerald-600 transition-all duration-300" style={{ width: `${Math.max(uploadProgress, 8)}%` }} />
          </div>
          <p className="mt-2 text-xs text-emerald-700">Files will appear with live indexing status after upload.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[#DCE7DF] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Total Documents
            </CardTitle>
            <div className="rounded-md bg-emerald-50 p-2">
              <Book className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900">
              {documents.length}
            </div>
            <p className="mt-1 text-xs text-slate-500">Total indexed sources</p>
          </CardContent>
        </Card>
        <Card className="border-[#DCE7DF] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Ready to answer
            </CardTitle>
            <div className="rounded-md bg-emerald-50 p-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900">
              {documents.filter((doc) => doc.status === "ready").length}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Successfully processed
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#DCE7DF] shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Processing
            </CardTitle>
            <div className="rounded-md bg-amber-50 p-2">
              <Loader2 className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-slate-900">
              {
                documents.filter(
                  (doc) =>
                    doc.status === "processing" || doc.status === "pending",
                ).length
              }
            </div>
            <p className="mt-1 text-xs text-slate-500">Live indexing jobs</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><CloudCog className="h-4 w-4 text-emerald-600" /> Knowledge health</CardTitle>
            <CardDescription>Live index status for this knowledge base.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Index health</p><p className="mt-1 flex items-center gap-1.5 font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {documents.some((d) => d.status === "failed") ? "Review needed" : "Healthy"}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last activity</p><p className="mt-1 font-semibold text-slate-800">{documents[0]?.updated_at ? formatRelativeTime(documents[0].updated_at) : "No activity"}</p></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total chunks</p><p className="mt-1 font-semibold text-slate-800">{documents.reduce((total, doc) => total + (doc.chunk_count || 0), 0).toLocaleString()}</p></div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Access & activity</CardTitle><CardDescription>Workspace-level knowledge controls.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-500">Availability</span><StatusBadge tone="success">Company workspace</StatusBadge></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Allowed agents</span><span className="font-semibold text-slate-800">{accessAgents.length ? `${accessDraft.length || "All"} agents` : "All agents"}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Retrieval searches</span><span className="flex items-center gap-1 font-semibold text-slate-800"><BarChart3 className="h-3.5 w-3.5 text-emerald-600" /> {analytics?.total_searches ?? 0} / 30 days</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Answerable searches</span><span className="font-semibold text-emerald-700">{analytics?.successful_searches ?? 0}</span></div>
            <Button variant="outline" size="sm" className="mt-1 w-full" onClick={() => setShowAccessEditor((value) => !value)}><ShieldCheck className="mr-2 h-3.5 w-3.5" /> Manage agent access</Button>
            {showAccessEditor && (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Leave all unchecked to allow every active agent.</p>
                {accessAgents.filter((agent) => agent.is_active).map((agent) => (
                  <label key={agent.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white">
                    <input type="checkbox" checked={accessDraft.includes(agent.id)} onChange={() => setAccessDraft((prev) => prev.includes(agent.id) ? prev.filter((id) => id !== agent.id) : [...prev, agent.id])} className="accent-emerald-600" />
                    <span className="text-sm font-medium text-slate-700">{agent.name}</span>
                  </label>
                ))}
                <Button size="sm" className="w-full bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleSaveAccess} disabled={isAccessSaving}>{isAccessSaving ? "Saving..." : "Save access policy"}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg">
              {kb ? kb.name : "Document Library"}
            </CardTitle>
            <CardDescription className="mt-1">
              Manage files used for Retrieval-Augmented Generation (RAG).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full sm:w-[250px] rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-sage-500"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 border-slate-200"
              onClick={() => setShowFilters((value) => !value)}
              aria-label="Toggle document filters"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Filter</span>
            {(["all", "ready", "processing", "pending", "failed"] as const).map((status) => (
              <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${statusFilter === status ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}`}>
                {status === "all" ? "All statuses" : status[0].toUpperCase() + status.slice(1)}
              </button>
            ))}
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none">
              <option value="all">All source types</option>
              {fileTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
        )}
        {documents.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <button type="button" onClick={toggleSelectAll} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700">
              {allVisibleSelected ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4" />} Select visible documents
            </button>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">{selectedIds.size} selected</span>
                <Button variant="outline" size="sm" onClick={handleBulkRetry}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Re-process</Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleBulkDelete}><Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete</Button>
              </div>
            )}
          </div>
        )}
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div
              className={`relative overflow-hidden flex flex-col items-center justify-center py-20 text-center transition-colors border border-sage-200 bg-gradient-to-br from-[#E8F0EC] to-[#F4F7F6] rounded-b-lg ${isDragging ? "ring-2 ring-sage-500 bg-sage-50/50" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <SubtleGrid className="text-sage-700 opacity-[0.05]" />
              <div className="relative z-10 flex flex-col items-center">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm border border-sage-100 transition-colors ${isDragging ? "text-sage-600 scale-110" : "text-sage-500"}`}
                >
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-slate-900">
                  Upload your company documents
                </h3>
                <p className="mt-2 text-sm text-slate-500 max-w-sm">
                  ZeniaOne uses these documents to answer customer questions
                  automatically.
                </p>
                <div className="mt-8 flex items-center justify-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> PDF
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> DOCX
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" /> TXT
                  </span>
                </div>
                <Button
                  className="mt-8 bg-sage-600 hover:bg-sage-700 shadow-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!kb}
                >
                  Browse Files
                </Button>
              </div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Search className="h-10 w-10 text-slate-300" />
              <h3 className="mt-4 font-semibold text-slate-900">No matching documents</h3>
              <p className="mt-1 text-sm text-slate-500">Try another search term or clear the active filters.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all"); }}>Clear filters</Button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 border-t border-slate-100">
              {filteredDocuments.map((doc) => {
                const typeExt =
                  doc.filename.split(".").pop()?.toUpperCase() || "DOC";
                return (
                  <li
                    key={doc.id}
                    className="p-6 transition-colors hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-6 group"
                  >
                    <div className="flex min-w-0 items-start gap-4">
                      <button type="button" onClick={() => toggleSelected(doc.id)} className="mt-3 shrink-0 text-slate-400 hover:text-emerald-600" aria-label={`Select ${doc.filename}`}>
                        {selectedIds.has(doc.id) ? <CheckSquare className="h-5 w-5 text-emerald-600" /> : <Square className="h-5 w-5" />}
                      </button>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sage-50 text-sage-600 border border-sage-100/50 shadow-sm mt-0.5">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span
                          className="block max-w-full truncate font-semibold text-slate-900 text-base"
                          title={doc.filename}
                        >
                          {doc.filename}
                        </span>
                        <div className="text-sm text-slate-600 font-medium flex items-center flex-wrap gap-1.5">
                          <span>{typeExt}</span>
                          <span className="text-slate-300">&middot;</span>
                          <span>{formatBytes(doc.file_size_bytes || 0)}</span>
                          <span className="text-slate-300">&middot;</span>
                          <button
                            type="button"
                            onClick={() => handleViewChunks(doc.id)}
                            className="hover:text-sage-600 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 rounded"
                          >
                            {doc.chunk_count} chunks
                          </button>
                        </div>
                        <div className="text-xs text-slate-400">
                          Uploaded{" "}
                          {doc.created_at
                            ? formatSystemDateTime(doc.created_at)
                            : "Just now"}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Source: {doc.source_url ? "Website URL" : "Uploaded file"}</span>
                          {doc.source_url && <span className="max-w-[260px] truncate rounded-full bg-blue-50 px-2 py-0.5 text-blue-700" title={doc.source_url}>↗ {doc.source_url}</span>}
                          {doc.crawl_report && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700" title="Website crawl report">
                            {doc.crawl_report.pages_scraped} pages scraped · {doc.crawl_report.pages_skipped} skipped
                          </span>}
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">Updated {doc.updated_at ? formatRelativeTime(doc.updated_at) : "recently"}</span>
                        </div>
                        {doc.status === "failed" && doc.error_message && (
                          <div
                            className="text-xs text-red-500 mt-1"
                            title={doc.error_message}
                          >
                            {doc.error_message}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0">
                      <StatusBadge
                        tone={
                          doc.status === "ready"
                            ? "success"
                            : doc.status === "failed"
                              ? "error"
                              : "warning"
                        }
                      >
                        {doc.status === "processing"
                          ? "Processing"
                          : doc.status}
                      </StatusBadge>

                      <div className="flex items-center gap-2">
                        {(doc.status === "ready" ||
                          doc.status === "failed") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-9"
                            title="Re-process or Sync Latest Content"
                            onClick={() => handleRetry(doc.id)}
                          >
                            <RefreshCw className="h-4 w-4 sm:mr-2" />{" "}
                            <span className="hidden sm:inline">
                              Sync / Re-chunk
                            </span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-200 text-slate-700 hover:text-sage-700 hover:bg-sage-50 hover:border-sage-200 shadow-sm h-9"
                          onClick={() => handleOpen(doc.id, doc.filename)}
                        >
                          <ExternalLink className="h-4 w-4 sm:mr-2" />{" "}
                          <span className="hidden sm:inline">Open</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="Version history" onClick={() => handleViewVersions(doc.id)}>
                          <History className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">History</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-200 text-slate-700 hover:text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm h-9"
                          title="Delete"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 className="h-4 w-4 sm:mr-2" />{" "}
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {versionDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div><h3 className="flex items-center gap-2 font-semibold text-slate-900"><History className="h-5 w-5 text-emerald-600" /> Version history</h3><p className="mt-1 text-xs text-slate-500">Restore creates a new indexed version safely.</p></div>
              <Button variant="ghost" size="icon" onClick={() => setVersionDocId(null)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="space-y-2 overflow-y-auto p-5">
              {versions.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No previous versions yet.</p> : versions.map((item) => (
                <div key={item.version} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div><p className="text-sm font-semibold text-slate-800">Version {item.version}</p><p className="text-xs text-slate-500">{item.chunk_count} chunks · {item.file_size_bytes ? formatBytes(item.file_size_bytes) : "Unknown size"}</p><p className="text-[11px] text-slate-400">{item.snapshotted_at ? formatSystemDateTime(item.snapshotted_at) : "Historical snapshot"}</p></div>
                  <Button size="sm" variant="outline" onClick={() => handleRestoreVersion(item.version)}>Restore</Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chunk Viewer Modal */}
      {selectedDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Chunk Viewer
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Showing actual chunks extracted and indexed from this
                  document.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  disabled={docChunks.length === 0 || isChunksLoading}
                  className="h-8 text-slate-600 border-slate-200"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-4 w-4 mr-1.5 text-sage-600" /> Copied
                      ✓
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1.5" /> Copy All
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDocId(null)}
                  className="h-8 w-8 text-slate-500 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search inside chunks..."
                  value={chunkSearchQuery}
                  onChange={(e) => setChunkSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-sage-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {isChunksLoading ? (
                <div className="flex flex-col items-center justify-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-sage-600 mb-4" />
                  <p className="text-sm text-slate-500">
                    Fetching chunks from Pinecone...
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {docChunks
                    .filter(
                      (c) =>
                        !chunkSearchQuery ||
                        c.text
                          .toLowerCase()
                          .includes(chunkSearchQuery.toLowerCase()) ||
                        (c.section &&
                          c.section
                            .toLowerCase()
                            .includes(chunkSearchQuery.toLowerCase())),
                    )
                    .map((chunk, idx) => (
                      <div
                        key={chunk.chunk_id || idx}
                        className="rounded-lg border border-slate-200 overflow-hidden shadow-sm"
                      >
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold px-2 py-1 bg-white border border-slate-200 rounded text-slate-600 shadow-sm">
                              #{chunk.chunk_index + 1}
                            </span>
                            <span
                              className="text-xs font-mono text-slate-500 bg-slate-100/50 px-1.5 py-0.5 rounded truncate max-w-[150px] sm:max-w-[300px]"
                              title={chunk.chunk_id}
                            >
                              {chunk.chunk_id}
                            </span>
                          </div>
                          {chunk.section && chunk.section !== "General" && (
                            <span
                              className="text-xs font-medium text-sage-700 bg-sage-50 px-2 py-1 rounded border border-sage-100 truncate max-w-[120px] sm:max-w-xs"
                              title={chunk.section}
                            >
                              {chunk.section}
                            </span>
                          )}
                        </div>
                        <div className="p-4 bg-white">
                          <p className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                            {chunk.text}
                          </p>
                        </div>
                        <div className="bg-slate-50/50 px-4 py-2 border-t border-slate-100 text-xs text-slate-400 text-right">
                          {chunk.text.length} chars
                        </div>
                      </div>
                    ))}
                  {docChunks.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      No chunks found for this document.
                    </div>
                  )}
                  {docChunks.length > 0 &&
                    chunkSearchQuery &&
                    docChunks.filter(
                      (c) =>
                        c.text
                          .toLowerCase()
                          .includes(chunkSearchQuery.toLowerCase()) ||
                        (c.section &&
                          c.section
                            .toLowerCase()
                            .includes(chunkSearchQuery.toLowerCase())),
                    ).length === 0 && (
                      <div className="text-center py-12 text-slate-500">
                        No chunks match your search query.
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* URL Modal */}
      {isUrlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sage-100 rounded-lg text-sage-600">
                  <ExternalLink className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Scrape Website URL
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsUrlModalOpen(false)}
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Paste a public website link. The AI will automatically scrape
                the content, remove menus/footers, and learn from it.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 disabled:opacity-50"
                  placeholder="https://example.com/features"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isUploading}
                  autoFocus
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Crawl settings</p>
                    <p className="text-xs text-slate-500">Control how much of the website is indexed.</p>
                  </div>
                  <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-slate-600">
                    Page limit
                    <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" value={crawlOptions.max_pages} onChange={(e) => setCrawlOptions((v) => ({ ...v, max_pages: Number(e.target.value) }))} disabled={isUploading}>
                      {[20, 50, 100].map((value) => <option key={value} value={value}>{value} pages</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-600">
                    Link depth
                    <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm" value={crawlOptions.max_depth} onChange={(e) => setCrawlOptions((v) => ({ ...v, max_depth: Number(e.target.value) }))} disabled={isUploading}>
                      {[1, 2, 3, 5, 10].map((value) => <option key={value} value={value}>Depth {value}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 sm:grid-cols-2">
                  {[
                    ["include_subdomains", "Include subdomains"],
                    ["include_pdfs", "Include linked PDFs"],
                    ["follow_sitemap", "Follow sitemap.xml"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={crawlOptions[key as keyof typeof crawlOptions] as boolean} onChange={(e) => setCrawlOptions((v) => ({ ...v, [key]: e.target.checked }))} disabled={isUploading} />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" placeholder="Include paths: /products, /docs" value={crawlOptions.include_patterns} onChange={(e) => setCrawlOptions((v) => ({ ...v, include_patterns: e.target.value }))} disabled={isUploading} />
                  <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs" placeholder="Exclude paths: /login, /cart" value={crawlOptions.exclude_patterns} onChange={(e) => setCrawlOptions((v) => ({ ...v, exclude_patterns: e.target.value }))} disabled={isUploading} />
                </div>
                <p className="text-[11px] text-slate-500">Use comma-separated path words. Login-protected pages are never bypassed.</p>
              </div>

              {isUploading && (
                <div className="mt-4 p-4 rounded-lg border border-sage-100 bg-sage-50 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-sage-800 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-sage-600" />
                      {crawlText}
                    </span>
                    <span className="font-bold text-sage-700">In progress</span>
                  </div>
                  <div className="w-full rounded-full bg-sage-100 p-[2px]">
                    <div className="h-1.5 w-2/3 animate-pulse rounded-full bg-sage-600" />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    The document list will show the real indexing status when
                    the import finishes.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsUrlModalOpen(false)}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-sage-600 hover:bg-sage-700 text-white min-w-[120px] transition-all"
                  onClick={handleUploadUrl}
                  disabled={isUploading || !urlInput.trim()}
                >
                  {isUploading ? "Scraping..." : "Scrape & Add"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Text Modal */}
      {isTextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sage-100 rounded-lg text-sage-600">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Add Raw Text
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsTextModalOpen(false)}
              >
                <X className="h-5 w-5 text-slate-500" />
              </Button>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Directly paste your latest updates, features, or any text. It
                will be immediately converted into AI knowledge.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Title / Name
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                  placeholder="e.g. New Feature Release - Sept 2024"
                  value={textTitleInput}
                  onChange={(e) => setTextTitleInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Content
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm h-64 focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none font-mono"
                  placeholder="Paste your content here..."
                  value={textContentInput}
                  onChange={(e) => setTextContentInput(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsTextModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-sage-600 hover:bg-sage-700 text-white"
                  onClick={handleUploadText}
                  disabled={
                    isUploading ||
                    !textTitleInput.trim() ||
                    !textContentInput.trim()
                  }
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Save to Knowledge Base"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
