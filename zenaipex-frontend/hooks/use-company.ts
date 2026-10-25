"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api/client";

export function useCurrentCompany() {
  const router = useRouter();
  const pathname = usePathname();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        
        // Super Admin "View as Company" override for dashboard
        if (!isAdminWorkspaceRoute) {
          const viewAsCompanyId = sessionStorage.getItem("view_as_company_id");
          if (viewAsCompanyId) {
            setCompanyId(viewAsCompanyId);
            setIsLoading(false);
            return;
          }
        }

        // Decode JWT manually (naive approach for prototype)
        // NOTE: For admin workspace routes, we ALWAYS go to the API to get the
        // correct admin_workspace company ID — never use the JWT company_id,
        // which may belong to a customer company (RK Hospital, etc).
        if (!isAdminWorkspaceRoute) {
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

        // Fallback: Fetch companies list
        try {
          const res = await fetchApi("/companies");
          if (res.companies && res.companies.length > 0) {
            if (isAdminWorkspaceRoute) {
              const adminComp = res.companies.find((c: any) => c.slug === "admin_workspace");
              if (adminComp) {
                setCompanyId(adminComp.id);
              } else {
                setCompanyId(res.companies[0].id);
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
