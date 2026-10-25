import React from 'react';
import { cn } from '@/lib/utils';

export function SubtleGrid({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-multiply", className)}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="premiumGridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#premiumGridPattern)" />
      </svg>
    </div>
  );
}

export function AIWavePattern({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 z-0 overflow-hidden opacity-[0.02] pointer-events-none", className)}>
      <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="w-full h-full text-current fill-current">
        <path d="M0,100 C150,20 200,180 350,100 C500,20 550,180 700,100 C850,20 900,120 1000,100 L1000,200 L0,200 Z" />
      </svg>
    </div>
  );
}

export function VoiceWaveDecoration({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 z-0 overflow-hidden opacity-[0.04] pointer-events-none flex items-center justify-center", className)}>
      <div className="flex gap-1 h-24 items-center">
        {[...Array(24)].map((_, i) => (
          <div 
            key={i} 
            className="w-1 rounded-full bg-current"
            style={{ 
              height: `${Math.max(10, Math.sin(i * 0.5) * 50 + 50)}%`,
              opacity: 1 - Math.abs(12 - i) * 0.05
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function SoftRadialHighlight({ className, color = "bg-sage-100" }: { className?: string, color?: string }) {
  return (
    <div className={cn(`absolute w-96 h-96 rounded-full blur-[100px] opacity-40 pointer-events-none z-0 ${color}`, className)} />
  );
}
