"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api/client";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  isError?: boolean;
  suggestions?: string[];
  sources?: string[];
  action?: { type: string; label: string } | null;
}

interface WidgetConfig {
  agent_name?: string;
  greeting?: string;
  company_name?: string;
  primary_color?: string;
}

type StreamEvent = {
  type: "meta" | "delta" | "done" | "error";
  text?: string;
  message?: string;
  conversation_id?: string;
  suggestions?: string[];
  sources?: string[];
  action?: ChatMessage["action"];
};

function formatClientTime(): string {
  if (typeof window === "undefined") return "Just now";
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const INITIAL_GREETING: ChatMessage = {
  id: "msg-welcome-0",
  role: "assistant",
  content: "Hi, I'm **ZeniaOne**. Ask me about our AI agents, chat, voice, or calls.",
  timestamp: "Just now",
};

export function usePublicAIChat(identifier: string = "zeniaone") {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_GREETING]);
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [connectionState, setConnectionState] = useState<"checking" | "ready" | "unavailable">("checking");
  const [isSending, setIsSending] = useState(false);
  const [lastFailedUserMessage, setLastFailedUserMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Connecting to assistant...");
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesRef = useRef(messages);
  const conversationIdRef = useRef<string | null>(null);
  const isSendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    let cancelled = false;
    let restoredMessages: ChatMessage[] | null = null;
    try {
      const saved = window.sessionStorage.getItem(`zeniaone-public-chat:${identifier}`);
      if (saved) {
        const parsed = JSON.parse(saved) as { messages?: ChatMessage[]; conversationId?: string };
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          const safeMessages = parsed.messages.filter((message) =>
            message && typeof message.id === "string" &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string" && typeof message.timestamp === "string"
          ).slice(-30).map((message) => ({ ...message, isStreaming: false }));
          if (safeMessages.length) restoredMessages = safeMessages;
        }
        if (typeof parsed.conversationId === "string") conversationIdRef.current = parsed.conversationId;
      }
    } catch {
      // A corrupt browser session should never stop the chat from opening.
    }
    queueMicrotask(() => {
      if (cancelled) return;
      if (restoredMessages) setMessages(restoredMessages);
      setHistoryLoaded(true);
    });
    return () => { cancelled = true; };
  }, [identifier]);

  useEffect(() => {
    if (!historyLoaded) return;
    try {
      window.sessionStorage.setItem(`zeniaone-public-chat:${identifier}`, JSON.stringify({
        messages: messages.slice(-30),
        conversationId: conversationIdRef.current,
      }));
    } catch {
      // Storage can be disabled or full; live chat still works.
    }
  }, [historyLoaded, identifier, messages]);

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/widget/config?identifier=${encodeURIComponent(identifier)}`);
        if (!response.ok) throw new Error("Widget unavailable");
        const data = await response.json() as WidgetConfig;
        if (cancelled) return;
        setConfig(data);
        setConnectionState("ready");
        const greeting = data.greeting;
        if (greeting) setMessages((current) => current.length === 1
          ? [{ ...INITIAL_GREETING, content: greeting }]
          : current);
      } catch {
        if (!cancelled) setConnectionState("unavailable");
      }
    };
    void loadConfig();
    return () => { cancelled = true; };
  }, [identifier]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const sendMessage = useCallback(async (text: string, retry = false) => {
    const cleanText = text.trim();
    if (!cleanText || isSendingRef.current) return;

    const requestId = ++requestIdRef.current;
    isSendingRef.current = true;
    setIsSending(true);
    setStatusText("Finding the right answer...");
    setLastFailedUserMessage(null);

    const history = messagesRef.current.filter((message) => !message.isError && message.content);
    if (retry) {
      const lastUserIndex = history.map((message) => message.role).lastIndexOf("user");
      if (lastUserIndex !== -1) history.splice(lastUserIndex);
    }
    if (retry) {
      setMessages((current) => {
        const lastUserIndex = current.map((message) => message.role).lastIndexOf("user");
        return lastUserIndex === -1 ? current : current.slice(0, lastUserIndex + 1);
      });
    } else {
      setMessages((current) => [...current, {
        id: `user-${requestId}`,
        role: "user",
        content: cleanText,
        timestamp: formatClientTime(),
      }]);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => controller.abort(), 45000);
    const assistantId = `assistant-${requestId}`;
    let assistantStarted = false;
    let completed = false;
    let metadata: Pick<ChatMessage, "suggestions" | "sources" | "action"> = {};

    const handleEvent = (event: StreamEvent) => {
      if (requestId !== requestIdRef.current) return;
      if (event.type === "meta") {
        if (event.conversation_id) conversationIdRef.current = event.conversation_id;
        metadata = {
          suggestions: event.suggestions,
          sources: event.sources,
          action: event.action,
        };
      } else if (event.type === "delta" && event.text) {
        if (!assistantStarted) {
          assistantStarted = true;
          setMessages((current) => [...current, {
            id: assistantId,
            role: "assistant",
            content: event.text!,
            timestamp: formatClientTime(),
            isStreaming: true,
          }]);
        } else {
          setMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, content: message.content + event.text }
            : message));
        }
      } else if (event.type === "done") {
        completed = true;
        setMessages((current) => current.map((message) => message.id === assistantId
          ? { ...message, ...metadata, isStreaming: false }
          : message));
      } else if (event.type === "error") {
        throw new Error(event.message || "The assistant could not finish this reply.");
      }
    };

    try {
      const response = await fetch(`${API_BASE_URL}/widget/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          message: cleanText,
          history: history.slice(-10).map(({ role, content }) => ({ role, content })),
          conversation_id: conversationIdRef.current,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error("The assistant is temporarily unavailable.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            handleEvent(JSON.parse(line.slice(6)) as StreamEvent);
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
      if (!completed || !assistantStarted) throw new Error("The response stopped early. Please try again.");
      setConnectionState("ready");
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      const message = error instanceof Error && error.name !== "AbortError"
        ? error.message
        : "The request timed out. Please try again.";
      setMessages((current) => [
        ...current.filter((item) => item.id !== assistantId),
        { id: `error-${requestId}`, role: "assistant", content: message, timestamp: formatClientTime(), isError: true },
      ]);
      setLastFailedUserMessage(cleanText);
      setConnectionState("unavailable");
    } finally {
      window.clearTimeout(timeoutId);
      if (requestId === requestIdRef.current) {
        abortRef.current = null;
        isSendingRef.current = false;
        setIsSending(false);
      }
    }
  }, [identifier]);

  const retryLastMessage = useCallback(() => {
    const lastUser = [...messagesRef.current].reverse().find((message) => message.role === "user");
    const text = lastFailedUserMessage || lastUser?.content;
    if (text) void sendMessage(text, true);
  }, [lastFailedUserMessage, sendMessage]);

  const clearChat = useCallback(() => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    isSendingRef.current = false;
    setIsSending(false);
    setLastFailedUserMessage(null);
    conversationIdRef.current = null;
    setMessages([{ ...INITIAL_GREETING, content: config?.greeting || INITIAL_GREETING.content }]);
  }, [config]);

  return {
    messages,
    isSending,
    statusText,
    sendMessage,
    retryLastMessage,
    clearChat,
    config,
    connectionState,
  };
}
