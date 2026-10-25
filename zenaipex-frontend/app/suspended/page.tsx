"use client";

import { AlertOctagon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SuspendedPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50/50 dark:bg-gray-950/50 px-4">
      <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 mb-8">
          <AlertOctagon className="h-10 w-10 text-red-600 dark:text-red-500" />
        </div>
        
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-4">
          Account Suspended
        </h1>
        
        <p className="text-base text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
          Your account has been suspended. Please contact the administrator for assistance and more information regarding your account status.
        </p>

        <div className="flex flex-col gap-3 w-full sm:flex-row sm:justify-center">
          <Button asChild className="w-full sm:w-auto">
            <Link href="mailto:support@zeniaone.com">
              Contact Support
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/login" onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("zenaipex_token");
              }
            }}>
              Return to Login
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
