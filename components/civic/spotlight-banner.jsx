"use client";

import { motion } from "framer-motion";

export function SpotlightBanner({ title, subtitle }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white">
      <motion.div
        className="pointer-events-none absolute -top-24 -left-16 h-60 w-60 rounded-full bg-cyan-400/30 blur-3xl"
        animate={{ x: [0, 40, -20, 0], y: [0, 20, 30, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-violet-500/30 blur-3xl"
        animate={{ x: [0, -30, 15, 0], y: [0, -20, -35, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative z-10">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
          Aceternity-inspired Surface
        </p>
        <h1 className="mt-2 text-2xl font-semibold md:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300 md:text-base">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
