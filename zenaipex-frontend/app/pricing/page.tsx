import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Pricing — ZeniaOne",
  description:
    "Flexible pricing plans for teams of every size. Start free, scale with your business.",
};

const plans = [
  {
    name: "Starter",
    tagline: "Perfect for pilots and small teams",
    price: "$0",
    period: "/ month",
    highlight: false,
    cta: "Get Started Free",
    ctaHref: "/signup",
    badge: null,
    features: [
      "1 AI voice agent",
      "500 conversation minutes / month",
      "1 knowledge base (up to 50 MB)",
      "Web chat widget embed",
      "English language support",
      "Community support",
    ],
  },
  {
    name: "Growth",
    tagline: "For growing teams automating customer workflows",
    price: "$149",
    period: "/ month",
    highlight: true,
    badge: "Most Popular",
    cta: "Start Free Trial",
    ctaHref: "/signup",
    features: [
      "Up to 5 AI voice agents",
      "5,000 conversation minutes / month",
      "5 knowledge bases (up to 500 MB each)",
      "Telephony via Twilio / SIP",
      "10+ Indian & global languages",
      "Analytics dashboard & transcripts",
      "Webhook integrations",
      "Email support (24 h SLA)",
    ],
  },
  {
    name: "Enterprise",
    tagline: "Custom deployment for large-scale operations",
    price: "Custom",
    period: "",
    highlight: false,
    badge: null,
    cta: "Contact Sales",
    ctaHref: "mailto:sales@zeniaone.ai",
    features: [
      "Unlimited agents",
      "Unlimited conversation minutes",
      "Dedicated tenant infrastructure",
      "On-premise or private cloud deploy",
      "SSO / SAML & custom auth",
      "Custom voice personas & TTS",
      "Priority support & SLA guarantee",
      "Custom integrations & professional services",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F6F3] text-[#1C2421] font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[#E7E4DC] bg-[#FDFCF9]/90 px-4 sm:px-6 md:px-8 backdrop-blur-md">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogo iconSize={36} textSize="text-xl" />
        </Link>
        <nav className="ml-8 hidden md:flex items-center gap-6 text-sm font-medium text-[#4A544E]">
          <Link href="/#features" className="hover:text-[#1C2421] transition-colors">Features</Link>
          <Link href="/#architecture" className="hover:text-[#1C2421] transition-colors">Architecture</Link>
          <Link href="/#capabilities" className="hover:text-[#1C2421] transition-colors">Capabilities</Link>
          <Link href="/pricing" className="text-[#1C2421] font-semibold">Pricing</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-sm font-medium text-[#3E4E47] hover:bg-[#EFECE5] hover:text-[#1C2421]">
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-sage-600 hover:bg-sage-700 text-white shadow-xs font-medium rounded-xl">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="w-full py-16 md:py-24 text-center">
          <div className="container px-4 sm:px-6 md:px-8 mx-auto max-w-3xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-[#1C2421]">
              Simple, Transparent Pricing
            </h1>
            <p className="mt-4 text-[#5A635E] text-sm sm:text-base leading-relaxed max-w-xl mx-auto">
              Start free and scale as your business grows. No hidden fees, no per-seat surprises.
            </p>
          </div>
        </section>

        {/* Plans */}
        <section className="w-full pb-24">
          <div className="container px-4 sm:px-6 md:px-8 mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border p-8 ${
                    plan.highlight
                      ? "border-sage-500 bg-white shadow-xl ring-2 ring-sage-400/30"
                      : "border-[#E7E4DC] bg-[#FAF9F6]"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-sage-600 px-4 py-1 text-xs font-bold text-white shadow-md">
                      {plan.badge}
                    </div>
                  )}
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-[#1C2421]">{plan.name}</h2>
                    <p className="mt-1 text-sm text-[#68706C]">{plan.tagline}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-[#1C2421]">{plan.price}</span>
                      {plan.period && (
                        <span className="text-sm text-[#68706C]">{plan.period}</span>
                      )}
                    </div>
                  </div>

                  <ul className="flex-1 space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-[#4A544E]">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-sage-600 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link href={plan.ctaHref}>
                    <Button
                      className={`w-full rounded-xl font-medium ${
                        plan.highlight
                          ? "bg-sage-600 hover:bg-sage-700 text-white shadow-md"
                          : "border border-[#D6D2C4] bg-white hover:bg-[#F2EFE9] text-[#3E4E47]"
                      }`}
                      variant={plan.highlight ? "default" : "outline"}
                    >
                      {plan.cta}{plan.highlight && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            {/* Note */}
            <div className="mt-16 text-center">
              <p className="text-sm text-[#68706C]">
                All plans include 99.9% uptime SLA, HTTPS encryption, and GDPR-compliant data handling.{" "}
                <Link href="/signup" className="font-medium text-sage-700 hover:underline">
                  Start your free trial →
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#E7E4DC] bg-[#FFFFFF] py-8">
        <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:px-8 md:flex-row">
          <div className="flex items-center">
            <BrandLogo iconSize={28} textSize="text-lg" />
          </div>
          <p className="text-center text-xs sm:text-sm text-[#737C76]">
            &copy; 2026 ZeniaOne. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs sm:text-sm text-[#737C76]">
            <Link href="/terms" className="hover:text-[#1C2421] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[#1C2421] transition-colors">Privacy</Link>
            <Link href="/security" className="hover:text-[#1C2421] transition-colors">Security</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
