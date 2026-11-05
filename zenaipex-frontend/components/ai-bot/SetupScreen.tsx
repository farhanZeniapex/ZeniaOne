"use client";

import { useState } from "react";
import { Bot, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agentsApi, Agent } from "@/lib/api/agents";

interface SetupScreenProps {
  companyId: string;
  onCreated: (agent: Agent) => void;
  title?: string;
  subtitle?: string;
  defaultName?: string;
  defaultPrompt?: string;
}

export function SetupScreen({
  companyId,
  onCreated,
  title = "My AI isn't set up yet",
  subtitle = "Create your personal AI assistant for internal platform management.",
  defaultName = "Platform Assistant",
  defaultPrompt = "You are ZeniaOne's internal platform assistant. You help super admins with platform operations, configuration questions, internal documentation, and usage insights. Be concise, professional, and helpful.",
}: SetupScreenProps) {
  const [name, setName] = useState(defaultName);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      const agent = await agentsApi.create(companyId, {
        name,
        system_prompt: prompt,
        status: "active" as const,
        default_language: "en-IN",
        tts_voice: "anushka",
        llm_model: "sarvam-105b",
        greeting_messages: { "en-IN": "Hello! How can I help you today?" },
      });
      onCreated(agent);
    } catch {
      setError("Failed to create agent. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-14 w-14 bg-sage-100 text-sage-600 rounded-2xl flex items-center justify-center shrink-0">
            <Bot className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">Agent Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-slate-700">System Prompt / Role</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              disabled={creating || !name.trim()}
              className="bg-sage-600 hover:bg-sage-700 text-white px-6"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Create My AI Agent
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

