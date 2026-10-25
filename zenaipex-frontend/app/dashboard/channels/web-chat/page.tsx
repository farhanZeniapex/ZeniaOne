"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentCompany } from '@/hooks/use-company';
import { channelsApi, CreateChannelData } from '@/lib/api/channels';
import { agentsApi, Agent } from '@/lib/api/agents';
import { Button } from '@/components/ui/button';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton';
import { SmartSelect } from '@/components/ui/smart-select';

export default function WebChatCreatePage() {
  const router = useRouter();
  const { companyId } = useCurrentCompany();
  const currentCompany = companyId ? { id: companyId } : null;
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('Website Chat Widget');
  const [agentId, setAgentId] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const agentsRes = await agentsApi.list(currentCompany!.id);
      setAgents(agentsRes.agents);
      
      if (agentsRes.agents.length > 0) {
        setAgentId(agentsRes.agents[0].id);
      }
    } catch (err) {
      console.error(err);
      setNotice('We could not load your AI agents. Refresh the page and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!agentId) {
      setNotice('Select an AI agent before creating the widget.');
      return;
    }
    
    try {
      setIsSaving(true);
      const data: CreateChannelData = { name, type: 'web_chat', agent_id: agentId };
      const created = await channelsApi.create(currentCompany!.id, data);
      router.push(`/dashboard/channels/web-chat/${created.id}/settings`);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Failed to create the widget.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoadingSkeleton cards={2} />;

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/channels" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-500" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <MessageSquare className="text-primary" size={28} />
            New Website Chat
          </h1>
          <p className="text-gray-500 mt-1">Connect an AI agent to your website.</p>
        </div>
      </div>

      {notice && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {notice}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Widget Name</label>
          <input
            required
            type="text"
            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Website Chat"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assigned AI Agent</label>
          <SmartSelect value={agentId} onChange={setAgentId} placeholder="Select an agent…" searchPlaceholder="Search agents…" options={agents.map(a => ({value:a.id,label:a.name}))} />
          {agents.length === 0 && (
            <p className="text-xs text-red-500 mt-1">You must create an AI Agent first.</p>
          )}
        </div>

        <Button type="submit" disabled={isSaving || agents.length === 0} className="w-full">
          {isSaving ? 'Saving...' : 'Create Widget'}
        </Button>
      </form>
    </div>
  );
}
