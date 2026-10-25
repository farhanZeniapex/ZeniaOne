import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

export function Toast({
  message,
  tone = "success",
  onClose,
}: {
  message: string;
  tone?: ToastTone;
  onClose?: () => void;
}) {
  const Icon =
    tone === "success" ? CheckCircle2 : tone === "error" ? AlertTriangle : Info;
  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-6 right-6 z-[300] flex max-w-[min(92vw,420px)] items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold shadow-[0_18px_40px_rgba(27,59,48,0.18)] animate-in fade-in slide-in-from-bottom-3",
        tone === "success" && "border-[#BFE5C9] bg-[#F1FBF4] text-[#17613C]",
        tone === "error" && "border-[#F2B8B5] bg-[#FFF4F3] text-[#B42318]",
        tone === "info" && "border-[#B9D8F2] bg-[#F2F8FF] text-[#175A8A]",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className="rounded-lg p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
