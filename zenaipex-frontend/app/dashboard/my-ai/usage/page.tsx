"use client";

import UsagePage from "@/app/dashboard/usage/page";
import { useEffect, useState } from "react";
import { useCurrentCompany } from "@/hooks/use-company";
import { fetchApi } from "@/lib/api/client";

export default function MyUsagePage() {
  const { companyId } = useCurrentCompany();
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    if (companyId) {
      fetchApi(`/companies/${companyId}`).then((res: any) => {
        if (res && res.name) setCompanyName(res.name);
      }).catch(() => {});
    }
  }, [companyId]);

  return (
    <div className="pt-2">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Usage</h1>
        <p className="text-sm font-semibold text-sage-600 uppercase tracking-wide">
          {companyName || "Workspace"}
        </p>
      </div>
      <UsagePage />
    </div>
  );
}
