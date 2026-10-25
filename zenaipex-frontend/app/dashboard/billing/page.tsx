"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentCompany } from "@/hooks/use-company";
import { fetchApi } from "@/lib/api/client";
import { CreditCard } from "lucide-react";
import { PageLoadingSkeleton } from "@/components/ui/page-loading-skeleton";

export default function BillingPage() {
  const { companyId, isLoading: isCompanyLoading } = useCurrentCompany();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    
    setIsLoading(true);
    fetchApi<any>(`/companies/${companyId}/subscription`)
      .then(res => setData(res))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [companyId]);

  if (isCompanyLoading || isLoading) {
    return <PageLoadingSkeleton cards={2} />;
  }

  const sub = data?.subscription || {};
  const planName = (sub.plan || "free_trial").replace("_", " ");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Billing & Invoices</h2>
        <p className="mt-1 text-slate-500">Manage your payment methods and view past invoices.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg">Current Subscription</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <span className="text-slate-500">Plan</span>
              <span className="font-medium text-slate-900 capitalize">{planName}</span>
            </div>
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <span className="text-slate-500">Status</span>
              <span className="font-medium text-slate-900 capitalize">{sub.status || "Trial"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Billing Cycle</span>
              <span className="font-medium text-slate-900 capitalize">{sub.billing_cycle || "Monthly"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-400" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg">
              <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <CreditCard className="h-6 w-6 text-slate-400" />
              </div>
              <h3 className="font-medium text-slate-900">Billing integration coming soon.</h3>
              <p className="text-sm text-slate-500 mt-1">Payment processing is not yet enabled for this environment.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
