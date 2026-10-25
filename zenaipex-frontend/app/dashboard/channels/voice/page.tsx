"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentCompany } from '@/hooks/use-company';
import { channelsApi, Channel, CreateChannelData, UpdateChannelData } from '@/lib/api/channels';
import { agentsApi, Agent } from '@/lib/api/agents';
import { companiesApi } from '@/lib/api/companies';
import { Button } from '@/components/ui/button';
import { Phone, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api/client';
import { PageLoadingSkeleton } from '@/components/ui/page-loading-skeleton';
import { SmartSelect } from '@/components/ui/smart-select';

export default function VoiceChannelPage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton cards={2} />}>
      <VoiceChannelContent />
    </Suspense>
  );
}

function VoiceChannelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channelId = searchParams.get('id');
  
  const { companyId } = useCurrentCompany();
  const currentCompany = companyId ? { id: companyId } : null;
  
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [companySlug, setCompanySlug] = useState('');
  
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, channelId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [agentsRes, company] = await Promise.all([
        agentsApi.list(currentCompany!.id),
        companiesApi.get(currentCompany!.id),
      ]);
      setAgents(agentsRes.agents);
      setCompanySlug(company.slug);
      
      if (channelId) {
        const c = await channelsApi.get(currentCompany!.id, channelId);
        setChannel(c);
        setName(c.name);
        setAgentId(c.agent_id);
        setPhoneNumber(c.phone_number || '');
      } else {
        setName('Main Support Line');
        if (agentsRes.agents.length > 0) {
          setAgentId(agentsRes.agents[0].id);
        }
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: 'We could not load this channel. Refresh the page and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!agentId) {
      setNotice({ type: 'error', message: 'Select an AI agent before saving this channel.' });
      return;
    }
    
    try {
      setIsSaving(true);
      if (channelId) {
        const data: UpdateChannelData = { name, agent_id: agentId, phone_number: phoneNumber };
        const updated = await channelsApi.update(currentCompany!.id, channelId, data);
        setChannel(updated);
        setNotice({ type: 'success', message: 'Phone channel saved successfully.' });
      } else {
        const data: CreateChannelData = { name, type: 'twilio_voice', agent_id: agentId, phone_number: phoneNumber };
        const created = await channelsApi.create(currentCompany!.id, data);
        router.push(`/dashboard/channels/voice?id=${created.id}`);
      }
    } catch (err: unknown) {
      setNotice({ type: 'error', message: err instanceof Error ? err.message : 'Failed to save channel.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoadingSkeleton cards={2} />;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/channels" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-gray-500" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Phone className="text-primary" size={28} />
            {channelId ? 'Configure Phone Number' : 'New Phone Channel'}
          </h1>
          <p className="text-gray-500 mt-1">Connect an AI agent to an inbound phone number.</p>
        </div>
      </div>

      {notice && (
        <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-medium ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {notice.message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Line Name</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Line"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Twilio Phone Number</label>
            <input
              required
              type="text"
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
            />
            <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +1 for US/Canada, +91 for India)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned AI Agent</label>
            <SmartSelect value={agentId} onChange={setAgentId} placeholder="Select an agent…" searchPlaceholder="Search agents…" options={agents.map(a => ({value:a.id,label:a.name}))} />
          </div>

          <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5 text-yellow-600" size={18} />
            <div className="text-sm space-y-1">
              <p className="font-semibold">Webhook Setup Required</p>
              <p>For inbound calls to work, point your Twilio phone number's <strong>Webhook URL</strong> to:</p>
              <code className="bg-white px-2 py-1 rounded border border-yellow-200 text-yellow-900 block mt-2">
                {apiOrigin}/api/v1/webhook/twilio/{companySlug || '<company-slug>'}/voice
              </code>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <Button type="submit" disabled={isSaving || agents.length === 0}>
              {isSaving ? 'Saving...' : (channelId ? 'Save Changes' : 'Create Channel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
