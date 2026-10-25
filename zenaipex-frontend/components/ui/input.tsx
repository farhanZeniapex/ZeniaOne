import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-[#D7E5DB] bg-white px-3.5 py-2 text-sm text-[#17372A] shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#91A69A] focus-visible:outline-none focus-visible:border-[#087F5B] focus-visible:ring-4 focus-visible:ring-[#CFECDD] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
