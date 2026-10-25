"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Send, User, Bot, Loader2, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function WidgetPage() {
  const { identifier } = useParams() as { identifier: string };
  const [config, setConfig] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/widget/config?identifier=${encodeURIComponent(identifier)}`);
      if (!res.ok) throw new Error('Widget not found');
      const data = await res.json();
      setConfig(data);
      
      if (data.greeting) {
        setMessages([{ role: 'assistant', content: data.greeting }]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (identifier) loadConfig();
  }, [identifier]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const userMessage = input.trim();
    setInput('');
    const newHistory = [...messages, { role: 'user', content: userMessage } as ChatMessage];
    setMessages(newHistory);
    setIsSending(true);

    try {
      const payload: any = {
        identifier,
        message: userMessage,
        history: messages,
      };
      
      const currentConvId = conversationIdRef.current;
      if (currentConvId) {
        payload.conversation_id = currentConvId;
      }

      const res = await fetch(`${API_BASE_URL}/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();
      
      if (data.conversation_id && !currentConvId) {
        setConversationId(data.conversation_id);
        conversationIdRef.current = data.conversation_id;
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. Please try again." }]);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-transparent"><Loader2 className="animate-spin text-gray-400" /></div>;
  }

  if (error || !config) {
    return (
      <div className="flex h-screen items-center justify-center bg-white p-5 text-center text-gray-500 rounded-2xl shadow-xl border border-gray-100">
        <div className="max-w-xs">
          <Bot className="mx-auto mb-3 h-8 w-8 text-gray-400" />
          <p className="font-semibold text-gray-800">Chat is temporarily unavailable</p>
          <p className="mt-1 text-sm">Please refresh the assistant and try again.</p>
          <button type="button" onClick={loadConfig} className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-white sm:rounded-2xl sm:shadow-xl sm:border sm:border-gray-100 overflow-hidden font-sans">
      {/* Header */}
      <div 
        className="p-4 text-white flex items-center gap-3 shrink-0 shadow-sm z-10"
        style={{ backgroundColor: config.primary_color }}
      >
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm">{config.agent_name}</h3>
          <p className="text-xs text-white/80">Powered by ZeniaOne</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-gray-800 text-white rounded-br-sm' 
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] p-3 rounded-2xl text-sm bg-white text-gray-500 border border-gray-100 rounded-bl-sm shadow-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 focus-within:border-gray-400 transition-colors">
          <input 
            type="text"
            className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
            placeholder="Type your message..."
            maxLength={1000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isSending}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-800 text-white disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={14} className={isSending ? "opacity-50" : ""} />
          </button>
        </div>
      </form>
    </div>
  );
}
