"use client";

import React, { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 500) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    const isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: 0,
      behavior: isReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      className={`fixed bottom-6 right-[5.5rem] sm:bottom-8 sm:right-[6.5rem] z-[45] flex h-11 w-11 items-center justify-center rounded-full bg-[#FAF8F5] text-[#3E5448] border border-[#EAE5DC] shadow-sm hover:shadow-md hover:bg-white hover:border-[#B2C7BF] transition-all duration-200 group focus:outline-hidden focus:ring-2 focus:ring-[#3E5448] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <ArrowUp className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
    </button>
  );
}
