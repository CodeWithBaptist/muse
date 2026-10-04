"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { transitions } from "@/lib/motion";

interface TrackArtworkProps {
  src?: string | null;
  alt: string;
  className: string;
}

export function TrackArtwork({ src, alt, className }: TrackArtworkProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <AnimatePresence initial={false} mode="sync">
        {src ? (
          <motion.img
            key={src}
            src={src}
            alt={alt}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              shouldReduceMotion ? { duration: 0 } : transitions.standard
            }
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
