import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
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

export interface ComboboxOption {
  label: string;
  value: string;
  flag?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
  id,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [maxListHeight, setMaxListHeight] = useState(240);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  useOnClickOutside(containerRef, () => setIsOpen(false));

  const valueExistsInOptions = options.some(opt => opt.value === value);
  const selectedOption = valueExistsInOptions 
    ? options.find((opt) => opt.value === value) 
    : (value ? { label: value, value: value } : undefined);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Preserve existing unmapped values in the dropdown if they match the search query
  if (value && !valueExistsInOptions && value.toLowerCase().includes(searchQuery.toLowerCase().trim())) {
    filteredOptions.push({ label: value, value: value });
  }

  useEffect(() => {
    if (isOpen && containerRef.current) {
      setSearchQuery("");
      setHighlightedIndex(filteredOptions.findIndex(o => o.value === value) > -1 ? filteredOptions.findIndex(o => o.value === value) : 0);
      // focus input
      setTimeout(() => inputRef.current?.focus(), 10);
      
      // Calculate available space below for dynamic max-height
      const rect = containerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      
      // Leave space for padding (24px) + search input (57px) -> ~80px overhead
      const availableListHeight = spaceBelow - 85;
      
      // Clamp between a minimum usable height (100px) and a generous max (320px)
      setMaxListHeight(Math.max(100, Math.min(320, availableListHeight)));
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Scroll to highlighted item
  useEffect(() => {
    if (isOpen && listboxRef.current && highlightedIndex >= 0) {
      const listboxNode = listboxRef.current;
      const highlightedNode = listboxNode.children[highlightedIndex] as HTMLElement;
      if (highlightedNode) {
        if (
          highlightedNode.offsetTop < listboxNode.scrollTop ||
          highlightedNode.offsetTop + highlightedNode.offsetHeight > listboxNode.scrollTop + listboxNode.clientHeight
        ) {
          highlightedNode.scrollIntoView({ block: "nearest" });
        }
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
        }
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
      onKeyDown={handleKeyDown}
    >
      <div
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        tabIndex={0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm transition-shadow outline-none",
          disabled ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" : "cursor-pointer",
          isOpen ? "border-sage-500 ring-2 ring-sage-500/20" : "border-slate-200 hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-sage-500/50"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption ? (
            <>
              {selectedOption.flag && <span className="text-base leading-none">{selectedOption.flag}</span>}
              <span className="text-slate-900 truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "ml-2 h-4 w-4 shrink-0 transition-transform duration-200",
            isOpen ? "rotate-180 text-sage-500" : "text-slate-400"
          )}
        />
      </div>

      {isOpen && !disabled && (
        <div 
          className="absolute z-50 w-full rounded-lg border border-slate-200 bg-white shadow-lg animate-in fade-in zoom-in-95 duration-150 overflow-hidden top-full mt-2 origin-top"
        >
          <div className="flex items-center border-b border-slate-100 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <ul
            id={`${id}-listbox`}
            role="listbox"
            ref={listboxRef}
            className="overflow-auto p-1"
            style={{ maxHeight: maxListHeight }}
          >
            {filteredOptions.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">{emptyMessage}</li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    onClick={(e) => {
                      if (option.disabled) {
                        e.preventDefault();
                        return;
                      }
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => {
                      if (!option.disabled) setHighlightedIndex(index);
                    }}
                    className={cn(
                      "relative flex items-center rounded-md py-2 pl-3 pr-9 text-sm outline-none transition-colors",
                      option.disabled ? "cursor-not-allowed opacity-50 text-slate-400" : "cursor-pointer select-none",
                      !option.disabled && isHighlighted ? "bg-sage-50 text-sage-900" : "",
                      !option.disabled && !isHighlighted ? "text-slate-700" : "",
                      isSelected && !option.disabled ? "font-medium" : ""
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {option.flag && <span className="text-base leading-none shrink-0">{option.flag}</span>}
                      <span className="truncate">{option.label}</span>
                      {option.disabled && <span className="ml-auto text-[10px] uppercase tracking-wider text-slate-400 font-medium">Unavailable</span>}
                    </div>

                    {isSelected && !option.disabled && (
                      <span className="absolute right-3 flex h-4 w-4 items-center justify-center text-sage-600">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
