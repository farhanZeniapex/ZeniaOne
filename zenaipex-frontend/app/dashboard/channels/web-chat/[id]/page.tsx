"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCurrentCompany } from "@/hooks/use-company";
import { channelsApi, Channel } from "@/lib/api/channels";
import { conversationsApi, Conversation, Message } from "@/lib/api/conversations";
import { agentsApi, Agent } from "@/lib/api/agents";
import { Button } from "@/components/ui/button";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";
import { 
  ArrowLeft, MessageSquare, Settings, Plus, Search, 
  Clock, Hash, User, Activity, CheckCircle, Send, MoreVertical, Loader2
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export default function ChatWorkspacePage() {
  return (
    <Suspense fallback={<PageLoadingSkeleton cards={2} />}>
      <ChatWorkspaceContent />
    </Suspense>
  );
}

function ChatWorkspaceContent() {
  const router = useRouter();
  const params = useParams();
  const channelId = params.id as string;
  const { companyId } = useCurrentCompany();

  // State
  const [channel, setChannel] = useState<Channel | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [liveActivity, setLiveActivity] = useState<{time: string, text: string}[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (companyId && channelId) {
      loadInitialData();
    }
  }, [companyId, channelId]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    } else {
      setMessages([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addActivity = (text: string) => {
    setLiveActivity(prev => [{ time: new Date().toLocaleTimeString(), text }, ...prev].slice(0, 10));
  };

  const loadInitialData = async () => {
    try {
      const c = await channelsApi.get(companyId!, channelId);
      setChannel(c);
      if (c.agent_id) {
        const agRes = await agentsApi.get(companyId!, c.agent_id);
        setAgent(agRes);
      }
      
      const convsRes = await conversationsApi.list(companyId!, { agentId: c.agent_id });
      // Only keep conversations from this channel, but API doesn't filter by channel directly.
      // We will assume the agent ID is tightly bound, or filter by direction if needed.
      setConversations(convsRes.conversations);
      
      if (convsRes.conversations.length > 0) {
        setActiveConvId(convsRes.conversations[0].id);
      }
      
      addActivity(`Workspace loaded. ${convsRes.conversations.length} conversations found.`);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      setIsLoadingHistory(true);
      const msgs = await conversationsApi.getMessages(companyId!, convId);
      setMessages(msgs.messages);
      addActivity(`Loaded conversation ${convId.slice(-6)}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleNewChat = async () => {
    try {
      const conv = await conversationsApi.createForChannel(companyId!, channelId);
      setConversations(prev => [conv, ...prev]);
      setActiveConvId(conv.id);
      addActivity(`New conversation started`);
    } catch (err) {
      console.error(err);
      alert("Failed to create new chat");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeConvId) return;

    const userText = inputValue;
    setInputValue("");
    setIsSending(true);

    const tempMsg: Message = {
      id: "temp-" + Date.now(),
      conversation_id: activeConvId,
      role: "user",
      text: userText,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);
    addActivity(`User sent message`);

    try {
      const res = await conversationsApi.chat(companyId!, activeConvId, userText);
      addActivity(`Agent responded. Extracted ${res.sources?.length || 0} sources.`);
      
      // Reload messages to get the real DB IDs and AI response
      await loadMessages(activeConvId);
    } catch (err) {
      console.error(err);
      addActivity(`Error sending message`);
    } finally {
      setIsSending(false);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const totalMessages = conversations.reduce((acc, c) => acc + c.turn_count, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/channels" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="text-primary" size={24} />
              {channel?.name || "Workspace"}
            </h1>
          </div>
        </div>
        <Link href={`/dashboard/channels/web-chat/${channelId}/settings`}>
          <Button variant="outline" className="gap-2">
            <Settings size={16} /> Widget Settings
          </Button>
        </Link>
      </div>

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm">
        
        {/* Left Sidebar: History */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/50">
          <div className="p-4 border-b border-gray-200 space-y-4">
            <Button onClick={handleNewChat} className="w-full gap-2 font-semibold">
              <Plus size={16} /> New Chat
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search conversations..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {conversations.map(conv => (
              <div 
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={`p-3 rounded-xl cursor-pointer transition-all border ${
                  activeConvId === conv.id 
                    ? "bg-primary/10 border-primary/20 shadow-sm" 
                    : "bg-white border-transparent hover:border-gray-200 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-500">
                    {formatDistanceToNow(new Date(conv.started_at || Date.now()), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {conv.title || "Visitor Chat"}
                </p>
                <p className="text-xs text-gray-500 truncate mt-1">
                  {conv.last_message || `Session ${conv.id.slice(-6)}`}
                </p>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="text-center text-gray-400 p-8 text-sm">
                No conversations yet.
              </div>
            )}
          </div>
        </div>

        {/* Center: Active Chat */}
        <div className="flex-1 flex flex-col bg-white relative">
          {/* Chat Header */}
          {activeConv && (
            <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white/50 backdrop-blur-sm z-10 absolute top-0 w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                  V
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Website Visitor</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle size={12} className="text-green-500" /> Active Session
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-gray-400">
                <MoreVertical size={18} />
              </Button>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 pt-24 pb-6 space-y-6">
            {!activeConv ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                <MessageSquare size={48} className="opacity-20" />
                <p>Select a conversation or start a new chat</p>
              </div>
            ) : isLoadingHistory ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" size={24} />
              </div>
            ) : (
              messages.map(msg => {
                const isUser = msg.role === "user";
                return (
                  <div key={msg.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <div className="flex items-end gap-2 max-w-[80%]">
                      {!isUser && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-primary-dark flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          AI
                        </div>
                      )}
                      <div className={`p-4 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                        isUser 
                          ? "bg-primary text-white rounded-br-sm" 
                          : "bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-sm"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 mt-1 px-10">
                      {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm a') : 'Now'}
                    </span>
                  </div>
                );
              })
            )}
            {isSending && (
              <div className="flex items-end gap-2 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-primary-dark flex-shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  AI
                </div>
                <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {activeConv && (
            <div className="p-4 bg-white border-t border-gray-100">
              <form onSubmit={handleSend} className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Type a message to the AI..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-full pl-6 pr-14 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner text-sm"
                />
                <button 
                  type="submit"
                  disabled={!inputValue.trim() || isSending}
                  className="absolute right-2 p-2 bg-primary text-white rounded-full hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  <Send size={16} className="ml-0.5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Sidebar: Details & Analytics */}
        <div className="w-72 border-l border-gray-200 bg-gray-50/30 flex flex-col">
          <div className="p-5 border-b border-gray-200">
            <h3 className="font-bold text-gray-900">Session Details</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {activeConv ? (
              <div className="p-5 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><User size={14}/> Visitor</span>
                    <span className="font-medium text-gray-900">Anonymous</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Hash size={14}/> Session ID</span>
                    <span className="font-medium text-gray-900 font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{activeConv.id.slice(-8)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2"><Clock size={14}/> Started</span>
                    <span className="font-medium text-gray-900">
                      {activeConv.started_at ? format(new Date(activeConv.started_at), 'MMM d, h:mm a') : 'Now'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live Activity</h4>
                  <div className="space-y-3">
                    {liveActivity.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No recent activity.</p>
                    ) : (
                      liveActivity.map((act, i) => (
                        <div key={i} className="flex gap-2">
                          <div className="mt-0.5"><Activity size={12} className="text-primary/60" /></div>
                          <div>
                            <p className="text-xs text-gray-800">{act.text}</p>
                            <p className="text-[10px] text-gray-400">{act.time}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 text-center text-sm text-gray-400">
                Select a session to view details.
              </div>
            )}
            
            <div className="border-t border-gray-200 p-5 mt-auto bg-gray-50">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Channel Overview</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                  <p className="text-2xl font-bold text-gray-900">{conversations.length}</p>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Sessions</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                  <p className="text-2xl font-bold text-gray-900">{totalMessages}</p>
                  <p className="text-[10px] font-medium text-gray-500 uppercase">Messages</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
