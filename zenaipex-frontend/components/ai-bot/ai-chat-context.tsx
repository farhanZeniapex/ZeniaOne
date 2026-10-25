"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { usePublicAIChat } from "@/hooks/use-public-ai-chat";

// Combine the hook's return type with the modal expansion state
type ChatHookType = ReturnType<typeof usePublicAIChat>;
interface AIChatContextType extends ChatHookType {
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

const AIChatContext = createContext<AIChatContextType | null>(null);

export function AIChatProvider({ children }: { children: ReactNode }) {
  const chatState = usePublicAIChat(process.env.NEXT_PUBLIC_HOME_CHAT_IDENTIFIER || "zeniaone_public_chat");
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <AIChatContext.Provider value={{ ...chatState, isExpanded, setIsExpanded }}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useSharedAIChat() {
  const context = useContext(AIChatContext);
  if (!context) {
    throw new Error("useSharedAIChat must be used within an AIChatProvider");
  }
  return context;
}
