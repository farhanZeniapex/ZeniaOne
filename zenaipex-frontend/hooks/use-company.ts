"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api/client";

export function useCurrentCompany() {
  const router = useRouter();
  const pathname = usePathname();
  const [companyId, setCompanyId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const isAdm = window.location.pathname?.startsWith("/admin/my-ai") || window.location.pathname?.startsWith("/admin/ai-playground");
    if (isAdm) {
      return sessionStorage.getItem("admin_workspace_company_id");
    }
    const viewAs = sessionStorage.getItem("view_as_company_id");
    if (viewAs) return viewAs;
    const token = localStorage.getItem("zenaipex_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.company_id || null;
      } catch {}
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const isAdm = window.location.pathname?.startsWith("/admin/my-ai") || window.location.pathname?.startsWith("/admin/ai-playground");
    if (isAdm) {
      return !sessionStorage.getItem("admin_workspace_company_id");
    }
    const viewAs = sessionStorage.getItem("view_as_company_id");
    if (viewAs) return false;
    const token = localStorage.getItem("zenaipex_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.company_id) return false;
      } catch {}
    }
    return true;
  });

  useEffect(() => {
    async function initCompany() {
      try {
        const token = localStorage.getItem("zenaipex_token");
        if (!token) {
          setIsLoading(false);
          router.replace("/login");
          return;
        }

        const isAdminWorkspaceRoute = pathname?.startsWith("/admin/my-ai") || pathname?.startsWith("/admin/ai-playground");
        
        // Fast-path: Check cached admin company ID
        if (isAdminWorkspaceRoute) {
          const cachedAdminCompId = sessionStorage.getItem("admin_workspace_company_id");
          if (cachedAdminCompId) {
            setCompanyId(cachedAdminCompId);
            setIsLoading(false);
          }
        } else {
          // Super Admin "View as Company" override for dashboard
          const viewAsCompanyId = sessionStorage.getItem("view_as_company_id");
          if (viewAsCompanyId) {
            setCompanyId(viewAsCompanyId);
            setIsLoading(false);
            return;
          }

          // Decode JWT manually (naive approach for prototype)
          try {
            const payload = JSON.parse(atob(token.split(".")[1]));
            if (payload.company_id) {
              setCompanyId(payload.company_id);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.error("Failed to decode token", e);
          }
        }

        // Fetch companies list (verifies or seeds cache)
        try {
          const res = await fetchApi("/companies");
          if (res.companies && res.companies.length > 0) {
            if (isAdminWorkspaceRoute) {
              const adminComp = res.companies.find((c: any) => c.slug === "admin_workspace");
              const targetId = adminComp ? adminComp.id : res.companies[0].id;
              if (targetId) {
                sessionStorage.setItem("admin_workspace_company_id", targetId);
                setCompanyId(targetId);
              }
            } else {
              // Ensure we don't accidentally load admin_workspace for regular dashboard pages if there's another company
              const customerComp = res.companies.find((c: any) => c.slug !== "admin_workspace") || res.companies[0];
              setCompanyId(customerComp.id);
            }
          }
        } catch (fetchErr: any) {
          if (fetchErr.status === 401) {
            localStorage.removeItem("zenaipex_token");
            router.push("/login");
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load company", err);
      } finally {
        setIsLoading(false);
      }
    }

    initCompany();
  }, [router, pathname]);

  return { companyId, isLoading };
}
