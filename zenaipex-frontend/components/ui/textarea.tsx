import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full rounded-xl border border-[#D7E5DB] bg-white px-3.5 py-3 text-sm text-[#17372A] shadow-sm transition-all placeholder:text-[#91A69A] focus-visible:outline-none focus-visible:border-[#087F5B] focus-visible:ring-4 focus-visible:ring-[#CFECDD] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
