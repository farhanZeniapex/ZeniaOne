import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Shield, Lock, Server, Eye } from "lucide-react";

export const metadata = {
  title: "Security — ZeniaOne",
  description: "ZeniaOne security architecture — data isolation, encryption, and compliance.",
};

const pillars = [
  {
    icon: Lock,
    title: "Encryption at Rest & in Transit",
    body: "All data stored in ZeniaOne databases is encrypted using AES-256. All communication between clients, our API gateway, and backend services is enforced over TLS 1.3.",
  },
  {
    icon: Shield,
    title: "Cryptographic Tenant Isolation",
    body: "Each organization's knowledge bases, conversation history, and agent configurations are stored in isolated namespaces with cryptographic access controls enforced at the API and database layers.",
  },
  {
    icon: Server,
    title: "Infrastructure Security",
    body: "ZeniaOne infrastructure is hosted on SOC 2-compliant cloud providers. We perform regular penetration tests, dependency audits, and vulnerability scans on all production systems.",
  },
  {
    icon: Eye,
    title: "Audit Logging",
    body: "Every API call, configuration change, and data access event is logged with a tamper-resistant audit trail. Logs are retained for a minimum of 12 months and are available to enterprise customers.",
  },
];

export default function SecurityPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F6F3] text-[#1C2421] font-sans">
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[#E7E4DC] bg-[#FDFCF9]/90 px-4 sm:px-6 md:px-8 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo iconSize={36} textSize="text-xl" />
        </Link>
      </header>
      <main className="flex-1 container mx-auto max-w-4xl px-4 sm:px-6 md:px-8 py-16 md:py-24">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1C2421]">
            Security at ZeniaOne
          </h1>
          <p className="mt-4 text-[#5A635E] text-sm sm:text-base leading-relaxed">
            Security and data privacy are foundational to how we build the platform — not an afterthought.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col p-6 rounded-2xl border border-[#E7E4DC] bg-[#FAF9F6] hover:border-sage-400 hover:shadow-md transition-all duration-200"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-100 text-sage-700 mb-4 border border-sage-200/80">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold text-[#1C2421] mb-2">{title}</h2>
              <p className="text-[#5A635E] text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-sage-200 bg-sage-50/60 p-8 text-center">
          <h2 className="text-xl font-bold text-[#1C2421] mb-2">Report a Security Issue</h2>
          <p className="text-sm text-[#5A635E] mb-4">
            If you discover a security vulnerability, please disclose it responsibly. We commit to acknowledging reports within 24 hours.
          </p>
          <a
            href="mailto:security@zeniaone.ai"
            className="inline-block text-sm font-medium text-sage-700 hover:underline"
          >
            security@zeniaone.ai
          </a>
        </div>
      </main>
      <footer className="w-full border-t border-[#E7E4DC] bg-white py-6 text-center">
        <p className="text-xs text-[#737C76]">&copy; 2026 ZeniaOne. All rights reserved.</p>
      </footer>
    </div>
  );
}
