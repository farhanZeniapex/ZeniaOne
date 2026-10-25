"use client";

import { useEffect, useState, useRef } from "react";
import { fetchApi } from "@/lib/api/client";
import { agentsApi, Agent } from "@/lib/api/agents";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, Send, Bot, User, Trash2, Database } from "lucide-react";
import { useCurrentCompany } from "@/hooks/use-company";
import { SubtleGrid } from "@/components/ui/decorative-backgrounds";
import { FilterSelect } from "@/components/ui/filter-select";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { filename?: string; label?: string; score: number }[];
}

export default function AiPlaygroundPage() {
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [kbName, setKbName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!companyId) {
      if (!isCompanyLoading) setIsLoading(false);
      return;
    }
    agentsApi.list(companyId).then(res => {
      setAgents(res.agents || []);
      if (res.agents && res.agents.length > 0) {
        setSelectedAgent(res.agents[0]);
      }
    }).finally(() => {
      setIsLoading(false);
    });
  }, [companyId, isCompanyLoading]);

  useEffect(() => {
    if (!companyId || !selectedAgent) return;
    
    setIsChatLoading(true);
    fetchApi(`/companies/${companyId}/conversations?agent_id=${selectedAgent.id}&limit=5`)
      .then((res: any) => {
        const convs = res.conversations || [];
        const testConvs = convs.filter((c: any) => c.direction === 'test-chat');
        if (testConvs.length > 0) {
          const conv = testConvs[0];
          setConversationId(conv.id);
          return fetchApi(`/companies/${companyId}/conversations/${conv.id}/messages`);
        }
        setConversationId(undefined);
        setMessages([]);
        return null;
      })
      .then((res: any) => {
        if (res && res.messages) {
          setMessages(res.messages.map((m: any) => ({
            role: m.role,
            content: m.text,
          })));
        }
      })
      .catch(console.error)
      .finally(() => setIsChatLoading(false));
  }, [selectedAgent, companyId]);

  useEffect(() => {
    setKbName(null);
    if (!selectedAgent?.knowledge_base_id || !companyId) return;
    fetchApi<{ knowledge_bases: { id: string; name: string }[] }>(`/companies/${companyId}/knowledge-bases`)
      .then(d => {
        const kb = (d.knowledge_bases || []).find(k => k.id === selectedAgent.knowledge_base_id);
        setKbName(kb?.name || null);
      })
      .catch(() => setKbName(null));
  }, [selectedAgent?.id, selectedAgent?.knowledge_base_id, companyId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  const handleSend = async () => {
    if (!input.trim() || !selectedAgent || !companyId) return;
    
    const userMsg: Message = { role: "user", content: input.trim() };
    const history = messages.map(m => ({ role: m.role, content: m.content }));
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsChatLoading(true);

    try {
      const res = await agentsApi.testChat(companyId, selectedAgent.id, userMsg.content, history, conversationId);
      setMessages(prev => [...prev, { role: "assistant", content: res.answer, sources: res.sources }]);
      if (res.conversation_id) setConversationId(res.conversation_id);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ API error: Unable to get a response. Please try again." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setConversationId(undefined);
  };

  if (isLoading || isCompanyLoading) {
    return <PageLoadingSkeleton cards={2} showTable={false} />;
  }

  if (!companyId) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Zap className="h-6 w-6 text-sage-600" /> AI Playground
          </h1>
          <p className="text-slate-500 mt-1">Test your AI agent before going live using your real company knowledge.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <FilterSelect
            label="Agent"
            value={selectedAgent?.id || ""}
            onChange={value => {
              const ag = agents.find(a => a.id === value) || null;
              setSelectedAgent(ag);
              setMessages([]);
            }}
            icon={<Bot className="h-3.5 w-3.5" />}
            disabled={agents.length === 0}
            options={[
              { label: "— Select AI Agent —", value: "" },
              ...agents.map(a => ({ label: a.name, value: a.id }))
            ]}
          />
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClear} className="text-slate-500 border-slate-300 hover:text-sage-600 hover:bg-sage-50">
              <Zap className="h-4 w-4 mr-1.5" /> New Chat
            </Button>
          )}
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="flex-1 bg-white rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-center p-12">
          <div>
            <Bot className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900">No AI agents configured yet.</h3>
            <p className="text-slate-500 mt-1">Create an agent in the Agents tab to start testing.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative">
          <SubtleGrid className="text-sage-700 opacity-[0.03] absolute inset-0 pointer-events-none" />
          
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-medium text-slate-500 shrink-0 relative z-10">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-sage-600" />
              <span>Testing: {selectedAgent?.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedAgent?.knowledge_base_id ? (
                <span className="flex items-center gap-1 text-emerald-600"><Database className="h-3 w-3" /> {kbName || "Knowledge Base"}</span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">No knowledge base connected.</span>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative z-10">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="h-16 w-16 bg-sage-50 rounded-full flex items-center justify-center mb-4">
                  <Zap className="h-8 w-8 text-sage-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">Ask your AI agent</h3>
                <p className="text-slate-500 mt-1 max-w-sm">
                  Test its responses to customer questions. It will use the provided system prompt and company knowledge.
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "ml-auto" : "mr-auto"}`}>
                  {m.role === "assistant" && (
                    <div className="h-8 w-8 shrink-0 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 mt-1">
                      <Bot className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <div className={`rounded-2xl px-5 py-3 ${
                      m.role === "user" 
                        ? "bg-sage-600 text-white rounded-tr-sm" 
                        : "bg-slate-100 text-slate-800 rounded-tl-sm border border-slate-200"
                    }`}>
                      <div className="prose prose-sm prose-slate max-w-none text-[14px] leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mt-1 [&>ol]:mt-1 [&>ul]:mb-2 [&>ol]:mb-2 [&>li]:my-0.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {m.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                  </div>
                </div>
              ))
            )}
            
            {isChatLoading && (
              <div className="flex gap-3 max-w-[85%] mr-auto">
                <div className="h-8 w-8 shrink-0 rounded-full bg-sage-100 flex items-center justify-center text-sage-600 mt-1">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="rounded-2xl px-5 py-3 bg-slate-100 text-slate-800 rounded-tl-sm border border-slate-200 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-sage-500" />
                  <span className="text-sm text-slate-500">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-slate-200 p-4 bg-white relative z-10 shrink-0">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={agents.length > 0 ? "Type a message to test..." : "Create an agent to test"}
                className="w-full border border-slate-300 rounded-full pl-5 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent disabled:opacity-50"
                disabled={isChatLoading || agents.length === 0}
              />
              <Button 
                onClick={handleSend} 
                disabled={!input.trim() || isChatLoading || agents.length === 0} 
                size="icon" 
                className="absolute right-1.5 h-9 w-9 rounded-full bg-sage-600 hover:bg-sage-700 disabled:bg-slate-200"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
