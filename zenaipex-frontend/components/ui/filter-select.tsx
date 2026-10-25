import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Hook to handle clicks outside the component
function useOnClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handler();
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterSelectProps {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function FilterSelect({
  label,
  value,
  options,
  onChange,
  icon,
  className,
  disabled = false,
}: FilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useOnClickOutside(containerRef, () => setIsOpen(false));

  const selectedOption = options.find((opt) => opt.value === value) || options[0];
  
  // If the selected value is not the first option, we consider it "active"
  const isActive = options.length > 0 && value !== options[0].value;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown" && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    } else if (isOpen) {
      const currentIndex = options.findIndex((opt) => opt.value === value);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % options.length;
        onChange(options[nextIndex].value);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + options.length) % options.length;
        onChange(options[prevIndex].value);
      }
    }
  };

  return (
    <div 
      className={cn("relative inline-block text-left", className)} 
      ref={containerRef}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex items-center gap-2 h-9 px-3 rounded-md border text-[13px] font-medium transition-all duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-sage-500/20 focus-visible:border-sage-500",
          disabled ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400" : "cursor-pointer",
          isActive && !disabled
            ? "border-sage-300 bg-sage-50/50 text-sage-900 hover:bg-sage-50 hover:border-sage-400"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
          isOpen && !disabled && (isActive ? "ring-2 ring-sage-500/20 border-sage-500" : "ring-2 ring-slate-200 border-slate-300")
        )}
      >
        {icon && (
          <span className={cn("flex-shrink-0 flex items-center justify-center h-4 w-4", isActive ? "text-sage-600" : "text-slate-400")}>
            {icon}
          </span>
        )}
        
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className={cn("font-medium", isActive ? "text-sage-700" : "text-slate-500")}>{label}:</span>
          <span className={cn("font-semibold", isActive ? "text-sage-900" : "text-slate-900")}>{selectedOption?.label}</span>
        </span>

        <ChevronDown 
          className={cn(
            "ml-1 h-3.5 w-3.5 transition-transform duration-200 ease-out",
            isOpen ? "rotate-180 text-sage-500" : (isActive ? "text-sage-500" : "text-slate-400")
          )} 
        />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1.5 w-max min-w-full rounded-lg border border-slate-100 bg-white p-1 shadow-lg animate-in fade-in zoom-in-95 duration-150 origin-top-left">
          <ul className="max-h-60 overflow-auto py-1 outline-none">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-[13px] font-medium outline-none transition-colors duration-150",
                    isSelected
                      ? "bg-sage-50 text-sage-900"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <span className="flex h-4 w-4 items-center justify-center flex-shrink-0">
                    {isSelected && <Check className="h-3.5 w-3.5 text-sage-600" />}
                  </span>
                  <span className={cn("truncate", isSelected ? "font-semibold" : "")}>
                    {option.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
