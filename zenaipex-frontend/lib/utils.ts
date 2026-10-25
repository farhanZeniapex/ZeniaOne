import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge tailwind classes with conditional application
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number as currency
 */
export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value)
}

/**
 * Format a date nicely
 */
export function formatDate(date: string | Date) {
  let parsedDate: Date;
  if (typeof date === 'string' && !date.endsWith('Z') && !date.match(/(\+|-)\d{2}:?\d{2}$/)) {
    parsedDate = new Date(date + 'Z');
  } else {
    parsedDate = new Date(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate)
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: string | Date) {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  let parsedDate: Date;
  if (typeof date === 'string' && !date.endsWith('Z') && !date.match(/(\+|-)\d{2}:?\d{2}$/)) {
    parsedDate = new Date(date + 'Z');
  } else {
    parsedDate = new Date(date);
  }
  const daysDifference = Math.round(
    (parsedDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  )
  return rtf.format(daysDifference, 'day')
}

/**
 * Format bytes to human readable sizes
 */
export function formatBytes(bytes: number, decimals = 1) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

/**
 * Format a date exactly to system UI spec: DD/MM/YYYY, HH:MM:SS (24-hour)
 * Uses the local timezone of the browser.
 */
export function formatSystemDateTime(date: string | Date | undefined | null) {
  if (!date) return "—";
  let parsedDate: Date;
  if (typeof date === 'string' && !date.endsWith('Z') && !date.match(/(\+|-)\d{2}:?\d{2}$/)) {
    // Legacy naive backend timestamps assumed UTC
    parsedDate = new Date(date + 'Z');
  } else {
    parsedDate = new Date(date);
  }
  if (isNaN(parsedDate.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsedDate)
}

/**
 * Format a string to enforce the canonical customer-facing product identity.
 * Replaces "ZeniaAI" with "ZeniaOne".
 */
export function canonicalizeCustomerFacingName(name: string | undefined | null): string {
  if (!name) return "";
  return name.replace(/Zenia\s*AI/ig, "ZeniaOne");
}

