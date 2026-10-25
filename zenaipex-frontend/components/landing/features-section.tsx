"use client";

import React, { useEffect, useRef, useState } from "react";
import { Zap, Database, Globe, Shield, Cpu, BarChart3, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 3D Interactive Feature Card
 */
function FeatureCard({
  title,
  description,
  icon: Icon,
  className,
  delay = 0,
  children,
}: {
  title: string;
  description: string;
  icon: any;
  className?: string;
  delay?: number;
  children?: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [lightPos, setLightPos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate rotation (-2 to 2 degrees)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -2;
    const rotateY = ((x - centerX) / centerX) * 2;

    setRotation({ x: rotateX, y: rotateY });
    setLightPos({ x: (x / rect.width) * 100, y: (y / rect.height) * 100 });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotation({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative flex flex-col p-7 sm:p-8 rounded-3xl border border-[#EAE5DC] bg-white transition-all duration-300 feature-stagger",
        isHovered && !reducedMotion ? "shadow-xl shadow-[#191614]/[0.03] border-[#D1DFD9]" : "shadow-md shadow-[#191614]/[0.02]",
        className
      )}
      style={{
        transitionDelay: `${delay}ms`,
        transform: !reducedMotion && isHovered
          ? `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) translateY(-4px)`
          : `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)`,
        transformStyle: "preserve-3d",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Subtle Hover Light */}
      {!reducedMotion && isHovered && (
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none opacity-40"
          style={{
            background: `radial-gradient(400px circle at ${lightPos.x}% ${lightPos.y}%, rgba(232,240,236,0.5), transparent 50%)`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full" style={{ transform: isHovered && !reducedMotion ? "translateZ(10px)" : "none", transition: "transform 0.3s ease" }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF8F5] text-[#3E5448] border border-[#EAE5DC] group-hover:bg-[#E8F0EC] group-hover:border-[#B2C7BF] transition-colors">
            <Icon className="h-5 w-5" />
          </div>
          {children && <div className="hidden sm:block">{children}</div>}
        </div>
        <div className="mt-auto">
          <h3 className="text-[17px] font-bold text-[#191614] mb-2">{title}</h3>
          <p className="text-[#5E5A54] text-[14px] leading-relaxed">
            {description}
          </p>
        </div>
        {children && <div className="sm:hidden mt-6 flex justify-end">{children}</div>}
      </div>
    </div>
  );
}

/**
 * Micro Animations for Cards
 */
const MicroVoice = () => (
  <div className="flex items-center gap-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
    <span className="text-[10px] uppercase font-bold tracking-wider text-[#7A9184]">Listening</span>
    <div className="flex gap-[2px] h-3 items-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="w-[2px] bg-[#3E5448] rounded-full"
          style={{
            animation: `waveform-pulse 1s infinite ease-in-out ${i * 0.1}s`,
            height: i % 2 === 0 ? "8px" : "12px",
          }}
        />
      ))}
    </div>
  </div>
);

const MicroKnowledge = () => (
  <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
    <div className="flex gap-1">
      <div className="w-2.5 h-3 bg-[#D1DFD9] rounded-[2px]" style={{ animation: "node-float 3s infinite ease-in-out 0s" }} />
      <div className="w-2.5 h-3 bg-[#B2C7BF] rounded-[2px]" style={{ animation: "node-float 3s infinite ease-in-out 0.5s" }} />
      <div className="w-2.5 h-3 bg-[#7A9184] rounded-[2px]" style={{ animation: "node-float 3s infinite ease-in-out 1s" }} />
    </div>
    <div className="w-4 h-[1px] bg-[#D1DFD9]" />
    <Database className="h-3 w-3 text-[#3E5448]" />
  </div>
);

const MicroLang = () => (
  <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
    <Globe className="h-3.5 w-3.5 text-[#7A9184]" style={{ animation: "globe-spin 20s linear infinite" }} />
    <span className="text-[10px] uppercase font-bold tracking-wider text-[#3E5448]">EN • HI • GU</span>
  </div>
);

const MicroSecurity = () => (
  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-[#E8F0EC] opacity-80 group-hover:opacity-100 transition-opacity" style={{ animation: "shield-pulse 3s infinite ease-in-out" }}>
    <Shield className="h-3 w-3 text-[#3E5448]" />
  </div>
);

export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    const elements = document.querySelectorAll(".feature-stagger");
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <section 
      id="features" 
      ref={sectionRef} 
      className="relative w-full py-24 md:py-32 bg-[#FAF8F5] scroll-mt-20"
    >
      {/* Background Transition from Hero */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#F8F4EC] to-transparent z-10 pointer-events-none" />

      {/* Ambient Organic Background Layers */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top left sage */}
        <div 
          className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-sage-200/20 to-transparent blur-3xl"
          style={!reducedMotion ? { animation: "ambient-float 25s ease-in-out infinite alternate" } : {}}
        />
        {/* Right sage glow */}
        <div 
          className="absolute top-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-l from-sage-300/15 to-transparent blur-3xl"
          style={!reducedMotion ? { animation: "ambient-float 30s ease-in-out infinite alternate-reverse 2s" } : {}}
        />
        {/* Bottom coffee/taupe form */}
        <div 
          className="absolute -bottom-[20%] right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tl from-[#EAE3D7]/40 to-transparent blur-3xl"
          style={!reducedMotion ? { animation: "ambient-float 35s ease-in-out infinite alternate 1s" } : {}}
        />
        {/* Bottom left sage anchor */}
        <div 
          className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-gradient-to-tr from-sage-200/20 to-transparent blur-3xl"
          style={!reducedMotion ? { animation: "ambient-float 28s ease-in-out infinite alternate-reverse 3s" } : {}}
        />
      </div>

      <div className="container relative z-20 px-6 sm:px-10 lg:px-16 mx-auto max-w-6xl">
        {/* Section Intro */}
        <div className="text-left md:text-center max-w-2xl mx-auto mb-16 md:mb-24 feature-stagger">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#7A9184] mb-4 block">
            Built for Real Business
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-0.02em] text-[#191614] mb-6">
            Everything you need<br />to build with AI.
          </h2>
          <p className="text-[#5E5A54] text-base md:text-lg leading-relaxed max-w-xl mx-auto">
            Purpose-built infrastructure connecting telephony, text, and enterprise knowledge with zero awkward latency.
          </p>
        </div>

        {/* 2-Column Layout for Desktop: Features (Left/Top) & Flow (Right/Bottom) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
          
          {/* Left: Features Grid */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-6">
            <FeatureCard
              title="Conversational Voice AI"
              description="Ultra-low latency streaming for human-like turn-taking."
              icon={MessageSquareText}
              delay={0}
            >
              <MicroVoice />
            </FeatureCard>

            <FeatureCard
              title="Multilingual Intelligence"
              description="Native understanding across global and regional languages."
              icon={Globe}
              delay={100}
            >
              <MicroLang />
            </FeatureCard>

            <FeatureCard
              title="Enterprise Knowledge"
              description="Automatic indexing for grounded, accurate answers."
              icon={Database}
              delay={200}
            >
              <MicroKnowledge />
            </FeatureCard>

            <FeatureCard
              title="Secure Workspaces"
              description="Strict multi-tenant isolation protects your business data."
              icon={Shield}
              delay={300}
            >
              <MicroSecurity />
            </FeatureCard>

            <FeatureCard
              title="Reliable AI Routing"
              description="Automated fallback across foundation models for high availability."
              icon={Cpu}
              delay={400}
            />

            <FeatureCard
              title="Transcripts & Analytics"
              description="Turn-by-turn conversation audits and telemetry."
              icon={BarChart3}
              delay={500}
            />
          </div>

          {/* Right: Deployment Flow */}
          <div className="lg:col-span-4 flex flex-col gap-5 lg:pl-4 feature-stagger" style={{ transitionDelay: '600ms' }}>
            <h3 className="text-lg font-bold text-[#191614] mb-2">Deployment Flow</h3>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-[#EAE5DC] shadow-xs">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3E5448] text-white text-xs font-bold">01</div>
                <div>
                  <h4 className="text-sm font-bold text-[#191614]">Connect Your Business</h4>
                  <p className="text-xs text-[#5E5A54] mt-1">Set up your tenant and configure telephony or web widgets.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-[#EAE5DC] shadow-xs">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3E5448] text-white text-xs font-bold">02</div>
                <div>
                  <h4 className="text-sm font-bold text-[#191614]">Add Your Knowledge</h4>
                  <p className="text-xs text-[#5E5A54] mt-1">Upload documents to be automatically embedded and indexed.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-[#EAE5DC] shadow-xs">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3E5448] text-white text-xs font-bold">03</div>
                <div>
                  <h4 className="text-sm font-bold text-[#191614]">Configure Your Agent</h4>
                  <p className="text-xs text-[#5E5A54] mt-1">Define voice persona, languages, and webhook integrations.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-5 rounded-2xl bg-[#FAF8F5] border border-[#D1DFD9] shadow-xs">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E8F0EC] text-[#3E5448] text-xs font-bold border border-[#B2C7BF]">04</div>
                <div>
                  <h4 className="text-sm font-bold text-[#191614]">Deploy &amp; Automate</h4>
                  <p className="text-xs text-[#5E5A54] mt-1">Handle inquiries and bookings instantly with zero wait time.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
