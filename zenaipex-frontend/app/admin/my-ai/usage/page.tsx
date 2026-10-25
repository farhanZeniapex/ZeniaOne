"use client";

import UsagePage from "@/app/dashboard/usage/page";

export default function MyUsagePage() {
  return (
    <div className="pt-2">
      <UsagePage isInternalWorkspace={true} />
    </div>
  );
}
