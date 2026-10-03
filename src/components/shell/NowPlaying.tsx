'use client';

import * as React from 'react';
import { motion } from 'motion/react';
import { Volume2 } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import { Logo } from '@/components/ui/Logo';

export function NowPlaying() {
  return (
    <aside className="w-[280px] border-l border-border-subtle bg-background flex flex-col hidden xl:flex">
      <div className="p-6 flex-1 flex flex-col justify-center items-center text-center space-y-6">
        <Surface variant="raised" className="w-full aspect-square flex items-center justify-center border-border-strong bg-surface/50 overflow-hidden">
          <Logo variant="mark" size={48} className="opacity-10" />
        </Surface>
        
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-text-muted">No track playing</h3>
          <p className="text-xs font-medium text-text-muted/60">Select a song to start listening</p>
        </div>
      </div>

      <div className="p-6 border-t border-border-subtle space-y-6">
        <div className="space-y-2 font-ui">
          <div className="h-1 bg-border-subtle rounded-full w-full" />
          <div className="flex justify-between text-[10px] font-medium text-text-muted tabular-nums">
            <span>0:00</span>
            <span>0:00</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <div className="w-4 h-4 text-text-muted/20" />
          <div className="w-8 h-8 rounded-full bg-border-subtle flex items-center justify-center">
             <div className="w-3 h-3 bg-text-muted/20 rounded-sm" />
          </div>
          <div className="w-4 h-4 text-text-muted/20" />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Volume2 className="w-4 h-4 text-text-muted/40" />
          <div className="h-1 bg-border-subtle rounded-full flex-1" />
        </div>
      </div>
    </aside>
  );
}
