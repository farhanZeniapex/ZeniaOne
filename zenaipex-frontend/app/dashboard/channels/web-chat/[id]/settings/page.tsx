"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCurrentCompany } from '@/hooks/use-company';
import { channelsApi, Channel, CreateChannelData, UpdateChannelData } from '@/lib/api/channels';
import { agentsApi, Agent } from '@/lib/api/agents';
import { fetchApi } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { MessageSquare, ArrowLeft, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton';
import { SmartSelect } from '@/components/ui/smart-select';

export default function WebChatConfigPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton cards={2} />}>
      <WebChatChannelContent />
    </Suspense>
  );
}

function WebChatChannelContent() {
  const router = useRouter();
  const params = useParams();
  const channelId = params.id as string;
  
  const { companyId } = useCurrentCompany();
  const currentCompany = companyId ? { id: companyId } : null;
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, channelId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const agentsRes = await agentsApi.list(currentCompany!.id);
      setAgents(agentsRes.agents);
      
      if (channelId) {
        const c = await channelsApi.get(currentCompany!.id, channelId);
        setChannel(c);
        setName(c.name);
        setAgentId(c.agent_id);
      } else {
        let defaultName = 'Website Chat';
        try {
          const comp = await fetchApi(`/companies/${currentCompany!.id}`);
          if (comp && comp.name) {
            defaultName = `${comp.name} Website Chat`;
          }
        } catch (e) {
          console.error('Could not fetch company name for default widget name');
        }
        
        setName(defaultName);
        if (agentsRes.agents.length > 0) {
          setAgentId(agentsRes.agents[0].id);
        }
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: 'We could not load this widget. Refresh the page and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!agentId) {
      setNotice({ type: 'error', message: 'Select an AI agent before saving this widget.' });
      return;
    }
    
    try {
      setIsSaving(true);
      if (channelId) {
        const data: UpdateChannelData = { name, agent_id: agentId };
        const updated = await channelsApi.update(currentCompany!.id, channelId, data);
        setChannel(updated);
        setNotice({ type: 'success', message: 'Website chat settings saved successfully.' });
      } else {
        const data: CreateChannelData = { name, type: 'web_chat', agent_id: agentId };
        const created = await channelsApi.create(currentCompany!.id, data);
        router.push(`/dashboard/channels/web-chat/${created.id}/settings`);
      }
    } catch (err: unknown) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save website chat settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const getEmbedCode = () => {
    if (!channel?.public_identifier) return '';
    const host = window.location.origin;
    return `<iframe src="${host}/widget/${channel.public_identifier}" width="400" height="600" frameborder="0" style="position: fixed; bottom: 20px; right: 20px; z-index: 9999; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); background: transparent;"></iframe>`;
  };

  const copyCode = () => {
    navigator.clipboard.writeText(getEmbedCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <PageLoadingSkeleton cards={2} />;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/channels" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-500" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <MessageSquare className="text-primary" size={28} />
            {channelId ? 'Configure Website Chat' : 'New Website Chat'}
          </h1>
          <p className="text-gray-500 mt-1">Connect an AI agent to your website.</p>
        </div>
      </div>

      {notice && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-medium ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {notice.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
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
              {isSaving ? 'Saving...' : (channelId ? 'Save Changes' : 'Create Widget')}
            </Button>
          </form>

          {channel && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Embed Code</h3>
              <p className="text-sm text-gray-600 mb-4">Paste this code into the &lt;body&gt; of your website to display the chat widget.</p>
              <div className="relative group">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {getEmbedCode()}
                </pre>
                <button 
                  onClick={copyCode}
                  className="absolute top-2 right-2 p-2 bg-gray-700/80 hover:bg-gray-600 text-white rounded-lg transition-colors backdrop-blur-sm"
                  aria-label="Copy embed code"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="sticky top-6">
          {/* Preview Panel */}
          <div className="bg-gray-50/80 rounded-3xl border border-gray-200 shadow-inner p-4 sm:p-8 flex items-center justify-center h-full min-h-[500px]">
            {channel ? (
              <div className="relative w-full max-w-[380px] h-[600px] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col">
                <div className="bg-primary p-4 text-primary-foreground flex flex-col gap-1 z-10 shadow-sm">
                  <h4 className="font-bold text-lg leading-tight tracking-tight">
                    {agents.find(a => a.id === agentId)?.name || 'AI Assistant'}
                  </h4>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-400"></span>
                    <p className="text-xs font-medium text-primary-foreground/90">Online</p>
                  </div>
                </div>
                
                <div className="flex-1 bg-gray-50/50 p-4 flex flex-col gap-4 overflow-y-auto">
                  <div className="bg-white border border-gray-200 text-gray-900 p-3.5 rounded-2xl rounded-tl-sm text-[15px] leading-relaxed shadow-sm max-w-[85%] self-start">
                    Hello! How can I help you today?
                  </div>
                  <div className="bg-primary text-primary-foreground p-3.5 rounded-2xl rounded-tr-sm text-[15px] leading-relaxed shadow-sm max-w-[85%] self-end font-medium">
                    I need help with my booking.
                  </div>
                </div>
                
                <div className="p-4 bg-white border-t border-gray-100 z-10">
                  <div className="bg-gray-100 border border-transparent rounded-full px-4 py-3 text-sm text-gray-500 cursor-not-allowed">
                    Type a message...
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                <p>Save the channel to preview your widget.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
