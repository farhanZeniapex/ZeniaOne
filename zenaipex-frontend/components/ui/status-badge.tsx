import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const statusConfig: Record<
  StatusTone,
  { icon: typeof CheckCircle2; className: string }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-[#BFE5C9] bg-[#EAF6ED] text-[#17613C]",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-[#F1D99B] bg-[#FFF8E6] text-[#8A5A00]",
  },
  error: {
    icon: XCircle,
    className: "border-[#F2B8B5] bg-[#FDE8E7] text-[#B42318]",
  },
  info: {
    icon: Info,
    className: "border-[#B9D8F2] bg-[#EEF7FF] text-[#175A8A]",
  },
  neutral: {
    icon: Clock3,
    className: "border-[#D7E5DB] bg-[#F1F5F2] text-[#526A5D]",
  },
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  const config = statusConfig[tone];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        config.className,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
