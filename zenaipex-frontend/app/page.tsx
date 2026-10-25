"use client";

import { AIChatProvider } from "@/components/ai-bot/ai-chat-context";
import { ExpandedAIBotModal } from "@/components/ai-bot/expanded-ai-bot";
import { FloatingAIBot } from "@/components/ai-bot/floating-ai-bot";
import { HomeSections } from "@/components/landing/home-sections";
import { LeadForm } from "@/components/landing/lead-form";
import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";
import { VoiceCoreHero } from "@/components/landing/voice-core-hero";
import { BackToTopButton } from "@/components/ui/back-to-top";

export default function LandingPage() {
  return (
    <AIChatProvider>
      <div className="flex min-h-screen flex-col font-sans selection:bg-[#b5eec1]">
        <SiteHeader />
        <main className="flex-1">
          <VoiceCoreHero />
          <HomeSections />
          <LeadForm />
        </main>
        <FloatingAIBot />
        <BackToTopButton />
        <SiteFooter />
        <ExpandedAIBotModal />
      </div>
    </AIChatProvider>
  );
}
