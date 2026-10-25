import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    const combinedClassName = cn(
      "inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#CFECDD] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
      {
        "bg-[#0C4A31] text-white shadow-sm hover:bg-[#083A27]":
          variant === "default",
        "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90":
          variant === "destructive",
        "border border-[#D7E5DB] bg-white text-[#315342] shadow-sm hover:border-[#86B99A] hover:bg-[#F1F8F3]":
          variant === "outline",
        "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80":
          variant === "secondary",
        "hover:bg-[#F1F8F3] hover:text-[#087F5B]": variant === "ghost",
        "text-[#087F5B] underline-offset-4 hover:underline": variant === "link",
        "h-11 px-4 py-2": size === "default",
        "h-10 rounded-lg px-3 text-xs": size === "sm",
        "h-12 rounded-xl px-8 text-base": size === "lg",
        "h-10 w-10 shrink-0": size === "icon",
      },
      className,
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: cn(combinedClassName, (children.props as any).className),
        ref,
        ...props,
      });
    }

    return (
      <button className={combinedClassName} ref={ref} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
