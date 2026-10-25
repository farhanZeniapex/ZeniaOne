"use client";

import { useEffect, useState } from "react";
import { fetchApi } from "@/lib/api/client";
import { Loader2, Database, FileText, ArrowRight, Layers, Building2, ChevronRight, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

export default function AdminCompanyKnowledgePage() {
  const params = useParams();
  const companyId = params.id as string;
  
  const [company, setCompany] = useState<any>(null);
  const [kbs, setKbs] = useState<any[]>([]);
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
        
        // Filter platform data by the specific company ID
        const companyKbs = (kbsRes.knowledge_bases || []).filter(kb => kb.company_id === companyId);
        const companyDocs = (docsRes.documents || []).filter(doc => doc.company_id === companyId);
        
        // Map KBs to include their document stats based on the filtered documents
        const enrichedKbs = companyKbs.map(kb => {
          const kbDocs = companyDocs.filter(doc => doc.knowledge_base_id === kb.id);
          return {
            ...kb,
            total_documents: kbDocs.length,
            total_chunks: kbDocs.reduce((acc, doc) => acc + (doc.chunk_count || 0), 0)
          };
        });
        
        setKbs(enrichedKbs);
      } catch (error) {
        console.error("Failed to load company knowledge data", error);
        setLoadError("Company knowledge could not be loaded. Check platform access and try again.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [companyId]);

  if (isLoading) return <PageLoadingSkeleton cards={3} showTable />;

  if (loadError) return (
    <div className="flex h-64 flex-col items-center justify-center gap-4 text-center"><AlertCircle className="h-12 w-12 text-red-400" /><p className="text-sm text-slate-600">{loadError}</p><Button variant="outline" onClick={() => window.location.reload()}>Retry</Button></div>
  );

  if (!company) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <Building2 className="h-12 w-12 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700">Company Not Found</h2>
        <Link href="/admin/knowledge">
          <Button variant="outline">Back to Platform Knowledge</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 font-medium">
        <Link href="/admin/knowledge" className="hover:text-slate-900 transition-colors">Platform Knowledge</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-slate-900 font-semibold">{company.name}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            {company.name}
            {company.slug === "admin_workspace" && (
              <span className="text-[10px] font-bold bg-sage-100 text-sage-700 border border-sage-200 px-2 py-0.5 rounded-full uppercase tracking-wide">INTERNAL</span>
            )}
          </h1>
          <p className="text-slate-500 mt-1">Tenant ID: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">{company.id}</code></p>
        </div>
        <Badge variant={company.status === "active" ? "default" : "secondary"} className="capitalize">
          {company.status}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Knowledge Bases</CardTitle>
            <Database className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{kbs.length}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{kbs.reduce((acc, kb) => acc + (kb.total_documents || 0), 0)}</div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Indexed Vectors</CardTitle>
            <Layers className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{kbs.reduce((acc, kb) => acc + (kb.total_chunks || 0), 0)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Knowledge Bases</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Knowledge Base</th>
                <th className="px-6 py-4 font-semibold">Documents</th>
                <th className="px-6 py-4 font-semibold">Vectors</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {kbs.map(kb => (
                <tr key={kb.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <Database className="h-4 w-4 text-sage-500" /> {kb.name}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{kb.id}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">{kb.total_documents}</td>
                  <td className="px-6 py-4 font-medium text-slate-700">{kb.total_chunks}</td>
                  <td className="px-6 py-4 text-slate-500">{formatRelativeTime(kb.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/knowledge/companies/${companyId}/kbs/${kb.id}`}>
                      <Button size="sm" variant="secondary" className="font-medium shadow-none group-hover:bg-sage-100 group-hover:text-sage-700 transition-colors">
                        View Documents <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {kbs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Database className="h-8 w-8 text-slate-300" />
                      <p className="text-slate-500 font-medium">No knowledge bases found for this company.</p>
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
