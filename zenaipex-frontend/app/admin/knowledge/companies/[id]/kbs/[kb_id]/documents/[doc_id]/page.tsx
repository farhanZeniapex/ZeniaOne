"use client";

import { useEffect, useState } from "react";
import { fetchApi, API_BASE_URL } from "@/lib/api/client";
import { Loader2, Database, FileText, ChevronRight, Layers, File, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function AdminDocumentDetailsPage() {
  const params = useParams();
  const companyId = params.id as string;
  const kbId = params.kb_id as string;
  const docId = params.doc_id as string;
  
  const [company, setCompany] = useState<any>(null);
  const [kb, setKb] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChunksLoading, setIsChunksLoading] = useState(false);
  const [showChunks, setShowChunks] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [compRes, kbsRes, docsRes] = await Promise.all([
          fetchApi<any>(`/admin/companies/${companyId}`),
          fetchApi<{ knowledge_bases: any[] }>(`/admin/knowledge-bases`),
          fetchApi<{ documents: any[] }>(`/admin/documents`)
        ]);
        setCompany(compRes);
        setKb((kbsRes.knowledge_bases || []).find(k => k.id === kbId && k.company_id === companyId));
        const foundDoc = (docsRes.documents || []).find(d => d.id === docId && d.knowledge_base_id === kbId && d.company_id === companyId);
        setDoc(foundDoc);

        if (foundDoc && foundDoc.chunk_count > 0) {
           setIsChunksLoading(true);
           try {
             const res = await fetchApi<{ chunks: any[] }>(`/admin/documents/${docId}/chunks`);
             setChunks(res.chunks || []);
           } catch (error) {
             console.error("Failed to load chunks", error);
           } finally {
             setIsChunksLoading(false);
           }
        }
      } catch (error) {
        console.error("Failed to load document details", error);
        setLoadError("Document details could not be loaded. Check platform access and try again.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [companyId, kbId, docId]);

  if (isLoading) return <PageLoadingSkeleton cards={3} showTable />;

  if (loadError) return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 text-center"><AlertCircle className="h-12 w-12 text-red-400" /><p className="text-sm text-slate-600">{loadError}</p><Button variant="outline" onClick={() => window.location.reload()}>Retry</Button></div>
  );

  if (!doc) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <FileText className="h-12 w-12 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700">Document Not Found</h2>
        <Link href={`/admin/knowledge/companies/${companyId}/kbs/${kbId}`}>
          <Button variant="outline">Back to Knowledge Base</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 font-medium flex-wrap">
        <Link href="/admin/knowledge" className="hover:text-slate-900 transition-colors">Platform Knowledge</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/admin/knowledge/companies/${companyId}`} className="hover:text-slate-900 transition-colors">{company?.name}</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/admin/knowledge/companies/${companyId}/kbs/${kbId}`} className="hover:text-slate-900 transition-colors">{kb?.name}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900 font-semibold truncate max-w-[200px]" title={doc.filename}>{doc.filename}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <FileText className="h-6 w-6 text-sage-500" /> 
            <span className="truncate max-w-[400px]" title={doc.filename}>{doc.filename}</span>
            <Button variant="outline" size="sm" className="ml-2 h-7 px-3 text-xs" onClick={() => window.open(`${API_BASE_URL}/companies/${companyId}/knowledge-bases/${kbId}/documents/${docId}/download`, '_blank')}>
              Open Document
            </Button>
          </h1>
          <p className="text-slate-500 mt-1">Document ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{doc.id}</code></p>
        </div>
        <Badge variant={doc.status === "ready" ? "default" : doc.status === "failed" ? "destructive" : "outline"} className="capitalize text-sm px-3 py-1">
          {doc.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">File Size</CardTitle>
            <File className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatBytes(doc.file_size_bytes)}</div>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{doc.content_type}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Chunks</CardTitle>
            <Layers className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{doc.chunk_count}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Uploaded</CardTitle>
            <Clock className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-slate-900">{formatRelativeTime(doc.created_at)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</CardTitle>
            {doc.status === "ready" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-amber-500" />}
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-slate-900 capitalize">{doc.status}</div>
          </CardContent>
        </Card>
      </div>

      {doc.error_message && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Processing Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{doc.error_message}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Extracted Chunks</h2>
            <p className="text-sm text-slate-500">View the actual text chunks extracted and indexed in the vector database.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
            <input 
              type="text" 
              placeholder="Search inside chunks..." 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {isChunksLoading ? (
              <div className="flex items-center justify-center p-12 border border-slate-200 rounded-xl bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-sage-600" />
              </div>
            ) : (
              <div className="space-y-4">
                {chunks
                  .filter(c => !searchQuery || c.text?.toLowerCase().includes(searchQuery.toLowerCase()) || c.section?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((chunk, idx) => (
                    <div key={chunk.id || idx} className="rounded-lg border border-slate-200 overflow-hidden shadow-sm bg-white">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            #{chunk.chunk_index !== undefined ? chunk.chunk_index + 1 : idx + 1}
                          </span>
                          <span className="text-xs font-mono text-slate-500 bg-slate-100/50 px-1.5 py-0.5 rounded truncate max-w-[200px]" title={chunk.chunk_id}>
                            {chunk.chunk_id}
                          </span>
                        </div>
                        {chunk.section && chunk.section !== "General" && (
                          <span className="text-xs font-medium text-sage-700 bg-sage-50 px-2 py-1 rounded border border-sage-100 truncate max-w-[200px]" title={chunk.section}>
                            {chunk.section}
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap font-serif leading-relaxed">
                          {chunk.text}
                        </p>
                      </div>
                      <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex justify-end">
                        <span className="text-xs text-slate-400">
                          {chunk.text?.length || 0} chars {chunk.token_count ? `• ~${chunk.token_count} tokens` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                {chunks.length === 0 && (
                  <div className="p-8 text-center text-slate-500 border border-slate-200 rounded-xl bg-slate-50">
                    No chunks found for this document.
                  </div>
                )}
                
                {chunks.length > 0 && searchQuery && chunks.filter(c => c.text?.toLowerCase().includes(searchQuery.toLowerCase()) || c.section?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <div className="p-8 text-center text-slate-500 border border-slate-200 rounded-xl bg-slate-50">
                    No chunks match your search query.
                  </div>
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
