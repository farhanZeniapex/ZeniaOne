"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api/client";
import { Loader2, Database, FileText, ArrowRight, Layers, Building2, ChevronRight, Download, AlertCircle } from "lucide-react";
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

export default function AdminKbDocumentsPage() {
  const params = useParams();
  const companyId = params.id as string;
  const kbId = params.kb_id as string;
  
  const [company, setCompany] = useState<any>(null);
  const [kb, setKb] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
        const currentKb = (kbsRes.knowledge_bases || []).find(k => k.id === kbId && k.company_id === companyId);
        setKb(currentKb);
        const kbDocs = (docsRes.documents || []).filter(d => d.knowledge_base_id === kbId && d.company_id === companyId);
        setDocs(kbDocs);
      } catch (error) {
        console.error("Failed to load KB documents data", error);
        setLoadError("Knowledge base documents could not be loaded. Check platform access and try again.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [companyId, kbId]);

  if (isLoading) return <PageLoadingSkeleton cards={3} showTable />;

  if (loadError) return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 text-center"><AlertCircle className="h-12 w-12 text-red-400" /><p className="text-sm text-slate-600">{loadError}</p><Button variant="outline" onClick={() => window.location.reload()}>Retry</Button></div>
  );

  if (!company || !kb) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Database className="h-12 w-12 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700">Knowledge Base Not Found</h2>
        <Link href={`/admin/knowledge/companies/${companyId}`}>
          <Button variant="outline">Back to Company KBs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 font-medium flex-wrap">
        <Link href="/admin/knowledge" className="hover:text-slate-900 transition-colors">Platform Knowledge</Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/admin/knowledge/companies/${companyId}`} className="hover:text-slate-900 transition-colors">{company.name}</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900 font-semibold">{kb.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Database className="h-6 w-6 text-sage-500" /> {kb.name}
          </h1>
          <p className="text-slate-500 mt-1">Knowledge Base ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{kb.id}</code></p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Document</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Size</th>
                <th className="px-6 py-4 font-semibold">Chunks</th>
                <th className="px-6 py-4 font-semibold">Uploaded</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.map(doc => (
                <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900 flex items-center gap-2 truncate max-w-[300px]" title={doc.filename}>
                      <FileText className="h-4 w-4 text-slate-400 shrink-0" /> {doc.filename}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-wider">{doc.content_type}</div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={doc.status === "ready" ? "default" : doc.status === "failed" ? "destructive" : "outline"} className="capitalize">
                      {doc.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{formatBytes(doc.file_size_bytes)}</td>
                  <td className="px-6 py-4 font-medium text-slate-700">{doc.chunk_count}</td>
                  <td className="px-6 py-4 text-slate-500">{formatRelativeTime(doc.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/knowledge/companies/${companyId}/kbs/${kbId}/documents/${doc.id}`}>
                      <Button size="sm" variant="secondary" className="font-medium shadow-none group-hover:bg-sage-100 group-hover:text-sage-700 transition-colors">
                        View Details <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-8 w-8 text-slate-300" />
                      <p className="text-slate-500 font-medium">No documents in this knowledge base.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
