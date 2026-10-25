import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";

export const metadata = {
  title: "Terms of Service — ZeniaOne",
  description: "ZeniaOne Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F6F3] text-[#1C2421] font-sans">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[#E7E4DC] bg-[#FDFCF9]/90 px-4 sm:px-6 md:px-8 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo iconSize={36} textSize="text-xl" />
        </Link>
      </header>
      <main className="flex-1 container mx-auto max-w-3xl px-4 sm:px-6 md:px-8 py-16 md:py-24">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#1C2421] mb-6">Terms of Service</h1>
        <p className="text-sm text-[#68706C] mb-8">Last updated: September 2026</p>
        <div className="prose prose-sm text-[#4A544E] space-y-6">
          <section>
            <h2 className="text-lg font-bold text-[#1C2421] mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using the ZeniaOne platform, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, you may not use the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#1C2421] mb-2">2. Description of Service</h2>
            <p>ZeniaOne provides enterprise-grade AI voice and conversational agent infrastructure, including knowledge base RAG retrieval, telephony integration, and analytics tooling. We reserve the right to modify, suspend, or discontinue any part of the service at any time.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#1C2421] mb-2">3. Acceptable Use</h2>
            <p>You agree not to use ZeniaOne for unlawful purposes, to transmit harmful content, or to attempt unauthorized access to our systems. Accounts found in violation may be suspended without notice.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#1C2421] mb-2">4. Intellectual Property</h2>
            <p>All content, trademarks, and software comprising the ZeniaOne platform are owned by ZeniaOne or its licensors. You retain ownership of data you upload to the platform.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#1C2421] mb-2">5. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, ZeniaOne shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the service.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[#1C2421] mb-2">6. Contact</h2>
            <p>For questions about these terms, contact <a href="mailto:legal@zeniaone.ai" className="text-sage-700 hover:underline">legal@zeniaone.ai</a>.</p>
          </section>
        </div>
      </main>
      <footer className="w-full border-t border-[#E7E4DC] bg-white py-6 text-center">
        <p className="text-xs text-[#737C76]">&copy; 2026 ZeniaOne. All rights reserved.</p>
      </footer>
    </div>
  );
}
