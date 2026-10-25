"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api/client";

// Module level cache to prevent redundant fetches
let cachedBranding: { platform_name: string; has_logo: boolean } | null = null;
let fetchPromise: Promise<any> | null = null;

export function useBranding() {
  const [platformName, setPlatformName] = useState(cachedBranding?.platform_name || "ZeniaOne");
  const [hasLogo, setHasLogo] = useState(cachedBranding?.has_logo || false);
  const [timestamp, setTimestamp] = useState(0);

  const fetchBranding = () => {
    if (!fetchPromise) {
      fetchPromise = fetch(`${API_BASE_URL}/admin/settings/public`)
        .then(res => res.json())
        .then(data => {
          cachedBranding = {
            platform_name: data.platform_name || "ZeniaOne",
            has_logo: !!data.has_logo
          };
          return cachedBranding;
        })
        .catch(() => {
          fetchPromise = null;
          return { platform_name: "ZeniaOne", has_logo: false };
        });
    }

    fetchPromise.then(data => {
      setPlatformName(data.platform_name);
      setHasLogo(data.has_logo);
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

  return { platformName, hasLogo, timestamp };
}
