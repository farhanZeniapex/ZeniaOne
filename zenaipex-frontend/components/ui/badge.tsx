import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors focus:outline-none focus:ring-4 focus:ring-[#CFECDD] focus:ring-offset-1",
        {
          "border-transparent bg-[#EAF6ED] text-[#17613C] hover:bg-[#DDF1E2]":
            variant === "default",
          "border-transparent bg-[#F1F5F2] text-[#526A5D] hover:bg-[#E5EEE8]":
            variant === "secondary",
          "border-transparent bg-[#FDE8E7] text-[#B42318] hover:bg-[#FBD3D0]":
            variant === "destructive",
          "border-[#D7E5DB] bg-white text-[#315342]": variant === "outline",
        },
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
