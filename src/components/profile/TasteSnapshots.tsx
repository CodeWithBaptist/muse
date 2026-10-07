'use client';

import { History } from 'lucide-react';
import { Surface } from '@/components/ui/Surface';
import type { TasteChangeData } from '@/lib/validation/api-schemas';

/**
 * Section 41. How taste is changing over time.
 *
 * The copy here is computed server side from two stored Spotify readings, so
 * this component only decides how to lay it out. It never phrases a claim of its
 * own, because a claim that is not in the data is exactly what the section
 * forbids.
 *
 * When there is not enough history that is said plainly, along with when a
 * comparison first becomes possible. An empty panel with no explanation would
 * read as a broken feature rather than as an honest one.
 */

function NameList({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <p className="text-sm leading-relaxed text-text-secondary">
        {names.join(', ')}
      </p>
    </div>
  );
}

export function TasteSnapshots({ change }: { change?: TasteChangeData }) {
  if (!change) return null;

  return (
    <Surface
      variant="raised"
      className="space-y-6 rounded-2xl p-8"
      data-testid="taste-snapshots"
    >
      <div className="flex items-center gap-3">
        <History size={20} className="text-accent" />
        <h2 className="type-section-label !text-text-primary">
          How your taste is changing
        </h2>
      </div>

      {change.available ? (
        <div className="space-y-6">
          <p className="max-w-2xl text-sm leading-relaxed text-text-primary">
            {change.summary}
          </p>

          <p className="text-[11px] text-text-muted">
            Compared {change.from} with {change.to}, {change.daysApart} days
            apart. Both readings came from your Spotify top artists.
          </p>

          <div className="grid grid-cols-1 gap-6 border-t border-border-subtle pt-6 md:grid-cols-3">
            <NameList label="New in your rotation" names={change.newArtists} />
            <NameList label="Still here" names={change.retainedArtists} />
            <NameList label="Dropped out" names={change.droppedArtists} />
          </div>

          {change.newGenres.length > 0 && (
            <div className="border-t border-border-subtle pt-6">
              <NameList label="More of these genres" names={change.newGenres} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
            {change.reason}
          </p>
          <p className="text-[11px] text-text-muted">
            {change.snapshotsHeld === 0
              ? 'A reading is taken when you open this page, at most once a week.'
              : 'Readings are taken at most once a week, and two need to be at least a fortnight apart before MUSE will describe a change.'}
          </p>
        </div>
      )}
    </Surface>
  );
}
