"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SmartSelectOption = {
  value: string;
  label: string;
  group?: string;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

type SmartSelectProps = {
  value?: string;
  defaultValue?: string;
  options: SmartSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  menuClassName?: string;
  menuWidth?: number;
  showSelectedDescription?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  id?: string;
  name?: string;
  "aria-label"?: string;
};

export function SmartSelect({
  value,
  defaultValue = "",
  options,
  onChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search options…",
  emptyMessage = "No matching options",
  className,
  menuClassName,
  menuWidth,
  showSelectedDescription = false,
  disabled = false,
  searchable = true,
  id,
  name,
  "aria-label": ariaLabel,
}: SmartSelectProps) {
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [query, setQuery] = useState("");
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [menuReady, setMenuReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedValue = value ?? internalValue;
  const selected = options.find((option) => option.value === selectedValue);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      [option.label, option.description, option.group, option.badge]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(needle)),
    );
  }, [options, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (
        !rootRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuReady(false);
      setQuery("");
      return;
    }
    if (open && searchable)
      window.setTimeout(() => searchRef.current?.focus(), 0);
    if (!open) setQuery("");
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!rect) return;

      const menuRect = menu?.getBoundingClientRect();
      const gap = 8;
      const menuHeight =
        menuRect?.height || Math.min(360, window.innerHeight - 24);
      const shouldOpenUp =
        rect.bottom + menuHeight + gap > window.innerHeight &&
        rect.top - menuHeight - gap >= 8;
      const width = Math.min(
        menuWidth || menuRect?.width || rect.width,
        window.innerWidth - 20,
      );
      const left = Math.min(
        Math.max(
          10,
          rect.right + width > window.innerWidth - 12
            ? rect.right - width
            : rect.left,
        ),
        window.innerWidth - width - 10,
      );
      const top = shouldOpenUp
        ? Math.max(8, rect.top - menuHeight - gap)
        : Math.min(rect.bottom + gap, window.innerHeight - menuHeight - 8);

      setMenuPosition({ top, left });
      setMenuReady(true);
    };
    const frame = window.requestAnimationFrame(positionMenu);
    const retry = window.setTimeout(positionMenu, 40);
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, menuWidth]);

  const grouped = filtered.reduce<Record<string, SmartSelectOption[]>>(
    (result, option) => {
      const group = option.group || "";
      (result[group] ||= []).push(option);
      return result;
    },
    {},
  );

  const choose = (option: SmartSelectOption) => {
    if (option.disabled) return;
    setInternalValue(option.value);
    onChange(option.value);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((current) => !current)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-3 rounded-xl border bg-white px-3.5 text-left text-sm font-semibold leading-tight text-[#17372A] shadow-sm outline-none transition-all duration-200",
          disabled && "cursor-not-allowed opacity-50",
          !disabled && "hover:border-[#86B99A] hover:shadow-md",
          open ? "border-[#087F5B] ring-4 ring-[#CFECDD]" : "border-[#D7E5DB]",
        )}
      >
        <span
          className={cn(
            "flex min-w-0 items-center gap-2.5",
            showSelectedDescription &&
              selected?.description &&
              "items-start py-0.5",
          )}
        >
          {selected?.icon && (
            <span className="shrink-0 text-[#087F5B]">{selected.icon}</span>
          )}
          <span
            className={cn(
              "min-w-0 flex-1",
              showSelectedDescription && selected?.description && "flex-1",
            )}
          >
            <span className="block truncate leading-tight">
              {selected?.label || placeholder}
            </span>
            {showSelectedDescription && selected?.description && (
              <span className="mt-0.5 block truncate text-[11px] font-medium leading-tight text-[#789487]">
                {selected.description}
              </span>
            )}
          </span>
          {selected?.badge && (
            <span className="shrink-0 rounded-full bg-[#EEF8F0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#28704B]">
              {selected.badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[#6C8B7B] transition-transform duration-200",
            open && "rotate-180 text-[#087F5B]",
          )}
        />
      </button>

      {open &&
        !disabled &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuWidth
                ? `min(${menuWidth}px, calc(100vw - 20px))`
                : undefined,
              visibility: menuReady ? "visible" : "hidden",
            }}
            className={cn(
              "fixed z-[200] w-max min-w-[min(100%,230px)] max-w-[calc(100vw-20px)] overflow-hidden rounded-2xl border border-[#D7E5DB] bg-white p-1 shadow-[0_20px_45px_rgba(27,64,46,0.18)]",
              menuClassName,
            )}
          >
            {searchable && (
              <div className="m-1 flex items-center gap-1.5 rounded-xl border border-[#E4EEE7] bg-[#F8FBF9] px-2.5">
                <Search className="h-3.5 w-3.5 shrink-0 text-[#789487]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 min-w-0 flex-1 bg-transparent text-[11px] text-[#17372A] outline-none placeholder:text-[#91A69A]"
                />
              </div>
            )}
            <div
              role="listbox"
              className="max-h-[min(18rem,calc(100vh-9rem))] overflow-y-auto p-0.5"
            >
              {filtered.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-[#789487]">
                  {emptyMessage}
                </div>
              ) : (
                Object.entries(grouped).map(([group, groupOptions]) => (
                  <div key={group || "ungrouped"}>
                    {group && (
                      <div className="px-2.5 pb-0.5 pt-1.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#6C8B7B]">
                        {group}
                      </div>
                    )}
                    {groupOptions.map((option) => {
                      const isSelected = option.value === selectedValue;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          disabled={option.disabled}
                          onClick={() => choose(option)}
                          className={cn(
                            "flex min-h-8 w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors duration-150",
                            option.disabled
                              ? "cursor-not-allowed opacity-45"
                              : "hover:bg-[#F0F8F2]",
                            isSelected && "bg-[#EAF6ED] text-[#0C5B3A]",
                          )}
                        >
                          {option.icon ? (
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F1F8F3] text-[#087F5B]">
                              {option.icon}
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-semibold leading-tight">
                              {option.label}
                            </span>
                            {option.description && (
                              <span className="block truncate text-[9px] leading-tight text-[#789487]">
                                {option.description}
                              </span>
                            )}
                          </span>
                          {option.badge && (
                            <span className="shrink-0 rounded-full border border-[#D7E5DB] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#6C8B7B]">
                              {option.badge}
                            </span>
                          )}
                          {isSelected && (
                            <Check className="h-4 w-4 shrink-0 text-[#087F5B]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
