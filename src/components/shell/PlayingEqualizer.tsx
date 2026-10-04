"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { durations } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function PlayingEqualizer({ className }: { className?: string }) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <span
      role="img"
      aria-label="Currently playing"
      className={cn("inline-flex h-4 items-end gap-0.5", className)}
    >
      {[0, 1, 2].map((bar) => (
        <motion.span
          key={bar}
          aria-hidden="true"
          className="w-0.5 origin-bottom rounded-full bg-accent"
          animate={
            shouldReduceMotion ? { scaleY: 1 } : { scaleY: [0.3, 1, 0.45] }
          }
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  duration: durations.slow,
                  repeat: Infinity,
                  delay: bar * 0.08,
                  ease: "easeInOut",
                }
          }
          style={{ height: shouldReduceMotion ? [6, 10, 7][bar] : 10 }}
        />
      ))}
    </span>
  );
}
