"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { LoaderCircle, Pause, Play } from "lucide-react";
import { transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface PlaybackButtonProps {
  playing: boolean;
  busy: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export function PlaybackButton({
  playing,
  busy,
  label,
  onClick,
  className,
  disabled = false,
}: PlaybackButtonProps) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled || busy}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-accent text-background transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={busy ? "busy" : playing ? "pause" : "play"}
          initial={{ opacity: 0, scale: 0.78 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.78 }}
          transition={
            shouldReduceMotion ? { duration: 0 } : transitions.standard
          }
          className="inline-flex items-center justify-center"
          aria-hidden="true"
        >
          {busy ? (
            <LoaderCircle size={17} />
          ) : playing ? (
            <Pause size={17} fill="currentColor" />
          ) : (
            <Play size={17} fill="currentColor" />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
