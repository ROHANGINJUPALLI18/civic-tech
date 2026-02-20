"use client";

import { useMemo } from "react";

export function ReactBitsChip() {
  const runtime = useMemo(() => {
    if (typeof window === "undefined") return "web";
    return window.navigator.userAgent.includes("Mobile") ? "mobile-web" : "web";
  }, []);

  return (
    <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 shadow-sm">
      React Bits surface: {runtime}
    </div>
  );
}
