"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api/client";

// Module level cache to prevent redundant fetches
let cachedBranding: { platform_name: string; has_logo: boolean; accent_color?: string } | null = null;
let fetchPromise: Promise<any> | null = null;

export function useBranding() {
  const [platformName, setPlatformName] = useState(cachedBranding?.platform_name || "ZeniaOne");
  const [hasLogo, setHasLogo] = useState(cachedBranding?.has_logo || false);
  const [accentColor, setAccentColor] = useState(cachedBranding?.accent_color || "#0C4A31");
  const [timestamp, setTimestamp] = useState(0);

  const applyAccentTheme = (color: string) => {
    if (typeof document !== "undefined" && color) {
      document.documentElement.style.setProperty("--primary-accent", color);
      document.documentElement.setAttribute("data-theme-accent", color);
    }
  };

  const fetchBranding = () => {
    if (!fetchPromise) {
      fetchPromise = fetch(`${API_BASE_URL}/admin/settings/public`)
        .then(res => res.json())
        .then(data => {
          const color = data.accent_color || "#0C4A31";
          cachedBranding = {
            platform_name: data.platform_name || "ZeniaOne",
            has_logo: !!data.has_logo,
            accent_color: color,
          };
          applyAccentTheme(color);
          return cachedBranding;
        })
        .catch(() => {
          fetchPromise = null;
          return { platform_name: "ZeniaOne", has_logo: false, accent_color: "#0C4A31" };
        });
    }

    fetchPromise.then(data => {
      setPlatformName(data.platform_name);
      setHasLogo(data.has_logo);
      if (data.accent_color) {
        setAccentColor(data.accent_color);
        applyAccentTheme(data.accent_color);
      }
    });
  };

  useEffect(() => {
    fetchBranding();

    const handleBrandingUpdate = () => {
      setTimestamp(Date.now());
      fetchPromise = null; // force refetch
      fetchBranding();
    };
    window.addEventListener("branding_updated", handleBrandingUpdate);
    return () => window.removeEventListener("branding_updated", handleBrandingUpdate);
  }, []);

  return { platformName, hasLogo, timestamp, accentColor };
}
