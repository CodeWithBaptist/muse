'use client';

import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { Surface } from '@/components/ui/Surface';
import { fadeInUp, staggerContainer } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';

const TRACKS = [
  { title: 'Selfish', artist: 'Brent Faiyaz', duration: '3:45' },
  { title: 'Trust', artist: 'Brent Faiyaz', duration: '3:12' },
  { title: 'Dead Man Walking', artist: 'Brent Faiyaz', duration: '3:07' },
];

export function ProductPreview() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    let active = true;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const sequence = async () => {
      while (active) {
        setStep(0);
        await wait(1500);
        if (!active) break;
        setStep(1);
        await wait(2000);
        if (!active) break;
        setStep(2);
        await wait(1500);
        if (!active) break;
        setStep(3);
        await wait(3000);
        if (!active) break;
        setStep(4);
        await wait(2000);
        if (!active) break;
        setStep(5);
        await wait(5000);
      }
    };
    sequence();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="px-6 py-20 max-w-5xl mx-auto">
      <motion.div
        whileInView={{ scale: [0.98, 1], opacity: [0, 1] }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <Surface
          variant="raised"
          className="overflow-hidden border-border-strong aspect-video flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-border-strong" />
              <div className="w-2.5 h-2.5 rounded-full bg-border-strong" />
              <div className="w-2.5 h-2.5 rounded-full bg-border-strong" />
            </div>
            <div className="text-[10px] uppercase tracking-widest text-text-muted font-medium">
              Preview
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6 space-y-8 overflow-y-auto custom-scrollbar">
            {/* Prompt */}
            <div className="max-w-md ml-auto">
              <Surface
                variant="flat"
                className="p-4 rounded-2xl rounded-tr-none bg-accent/10 border-accent/20"
              >
                <p className="text-sm">
                  {step >= 1
                    ? 'I want something like Brent Faiyaz but less sad.'
                    : ''}
                  {step === 0 && <span className="animate-pulse">|</span>}
                </p>
              </Surface>
            </div>

            {/* MUSE Response */}
            {step >= 2 && (
              <div className="max-w-md space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-sm bg-surface border border-border-subtle flex items-center justify-center overflow-hidden shrink-0">
                    <Logo variant="mark" size={20} />
                  </div>
                  {step === 2 && (
                    <div className="flex items-end gap-1 h-4">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          style={{ transformOrigin: 'bottom' }}
                          animate={{ scaleY: [0.35, 1, 0.35] }}
                          transition={{
                            repeat: Infinity,
                            duration: 0.8,
                            delay: i * 0.1,
                          }}
                          className="w-1 h-3.5 bg-accent rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {step >= 3 && (
                  <motion.div
                    variants={fadeInUp}
                    initial="initial"
                    animate="animate"
                    className="space-y-6"
                  >
                    <p className="text-sm text-text-secondary leading-relaxed">
                      Understood. Focus on that smooth, late-night R&amp;B
                      texture with a bit more warmth. Here&apos;s what I found:
                    </p>

                    <motion.div
                      variants={staggerContainer(0.05)}
                      className="space-y-1"
                    >
                      {TRACKS.map((track, i) => (
                        <motion.div
                          key={i}
                          variants={fadeInUp}
                          className="flex items-center gap-4 p-2 rounded hover:bg-surface transition-colors group"
                        >
                          <div className="w-10 h-10 bg-border-strong rounded shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {track.title}
                            </div>
                            <div className="text-xs text-text-muted truncate">
                              {track.artist}
                            </div>
                          </div>
                          <div className="text-[10px] text-text-muted tabular-nums">
                            {track.duration}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>

                    {step >= 4 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-4 rounded-lg bg-surface border border-border-strong flex items-center justify-between"
                      >
                        <div className="text-sm font-medium">
                          Create &quot;Late Night Vibe&quot; playlist?
                        </div>
                        <motion.button
                          disabled={step === 5}
                          className={cn(
                            'px-4 py-2 rounded text-xs font-bold transition-all',
                            step === 5
                              ? 'bg-accent text-background'
                              : 'bg-accent/20 text-accent'
                          )}
                        >
                          {step === 5 ? 'Created in Spotify' : 'Create'}
                        </motion.button>
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </Surface>
      </motion.div>
    </section>
  );
}
