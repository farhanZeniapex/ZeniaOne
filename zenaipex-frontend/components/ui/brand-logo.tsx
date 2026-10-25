"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api/client";
import { useBranding } from "@/hooks/use-branding";

interface BrandLogoProps {
  className?: string;
  /** Show only the icon mark, no text */
  iconOnly?: boolean;
  /** Override text size class (ignored, kept for compatibility) */
  textSize?: string;
  /** Override icon pixel height (display size). Default 32. */
  iconSize?: number;
}

/**
 * ZeniaAI brand logo using the final SVG assets.
 */
export function BrandLogo({
  className,
  iconOnly = false,
  iconSize = 32,
}: BrandLogoProps) {
  const { platformName, hasLogo, timestamp } = useBranding();
  const [remoteLogoFailed, setRemoteLogoFailed] = useState(false);

  useEffect(() => {
    setRemoteLogoFailed(false);
  }, [hasLogo, timestamp]);

  const brandDisplayName = platformName && platformName !== "ZeniaAI" ? platformName : "ZeniaOne";

  if (hasLogo && !remoteLogoFailed) {
    const src = `${API_BASE_URL}/admin/settings/logo?t=${timestamp}`;
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <img 
          src={src} 
          style={{ height: iconSize, width: iconOnly ? iconSize : 'auto' }} 
          alt={brandDisplayName} 
          className="object-contain" 
          onError={() => setRemoteLogoFailed(true)}
        />
        {!iconOnly && (
          <span className="font-bold tracking-tight text-[#191614] whitespace-nowrap" style={{ fontSize: iconSize * 0.58 }}>
            {brandDisplayName}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="relative shrink-0 flex items-center"
        style={{ height: iconSize, width: iconSize }}
      >
        <Image
          src="/ZeniaAI_Z_Logo.png"
          alt="ZeniaOne"
          width={iconSize}
          height={iconSize}
          className="object-contain"
          style={{ width: "auto", height: "100%" }}
          priority
          unoptimized
        />
      </div>
      {!iconOnly && (
        <span className="font-extrabold tracking-tight text-[#191614] text-lg sm:text-xl whitespace-nowrap">
          Zenia<span className="text-[#3E5448]">One</span>
        </span>
      )}
    </div>
  );
}
