'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  MemoryListResponseSchema,
  MemoryMutationResponseSchema,
  type MemoryRecordData,
} from '@/lib/validation/api-schemas';

interface MemoryFormProps {
  idPrefix: string;
  initialKey?: string;
  initialValue?: string;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (key: string, value: string) => Promise<void>;
}

function MemoryForm({
  idPrefix,
  initialKey = '',
  initialValue = '',
  submitLabel,
  onCancel,
  onSubmit,
}: MemoryFormProps) {
  const [key, setKey] = React.useState(initialKey);
  const [value, setValue] = React.useState(initialValue);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit(key, value);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to save this memory.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-md border border-border-subtle bg-background p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label
            htmlFor={`memory-${idPrefix}-key`}
            className="block text-xs font-semibold text-text-secondary"
          >
            Preference
          </label>
          <input
            id={`memory-${idPrefix}-key`}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            maxLength={80}
            required
            className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            placeholder="Preferred genres"
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor={`memory-${idPrefix}-value`}
            className="block text-xs font-semibold text-text-secondary"
          >
            Value
          </label>
          <input
            id={`memory-${idPrefix}-value`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={500}
            required
            className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            placeholder="Neo-soul and UK jazz"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

async function readError(response: Response) {
  const payload: unknown = await response.json().catch(() => null);
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
  ) {
    return payload.error;
  }
  return 'Unable to save this memory.';
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function MemoryItem({
  memory,
  onSaved,
  onDeleted,
}: {
  memory: MemoryRecordData;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleSave = async (key: string, value: string) => {
    const response = await fetch(`/api/memory/${memory.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const payload: unknown = await response.json();
    MemoryMutationResponseSchema.parse(payload);
    setEditing(false);
    await onSaved();
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/memory/${memory.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(await readError(response));
      await onDeleted();
    } catch {
      setDeleteError('Unable to delete this memory right now.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li className="space-y-3 border-b border-border-subtle py-4 last:border-b-0">
      {editing ? (
        <MemoryForm
          idPrefix={memory.id}
          initialKey={memory.key}
          initialValue={memory.value}
          submitLabel="Save memory"
          onCancel={() => setEditing(false)}
          onSubmit={handleSave}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-semibold text-text-primary">
                {memory.key}
              </h3>
              <p className="break-words text-sm text-text-secondary">
                {memory.value}
              </p>
              <p className="text-[11px] text-text-muted">
                Source: {memory.source}. Confidence: {memory.confidence}{' '}
                percent. Updated {formatUpdatedAt(memory.updatedAt)}.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Edit ${memory.key}`}
                onClick={() => setEditing(true)}
              >
                <Pencil size={13} className="mr-1.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Delete ${memory.key}`}
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                <Trash2 size={13} className="mr-1.5" />
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
          {deleteError && (
            <p role="alert" className="text-xs text-red-400">
              {deleteError}
            </p>
          )}
        </>
      )}
    </li>
  );
}

export function MemoryManager() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = React.useState(false);
  const [confirmClear, setConfirmClear] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [clearError, setClearError] = React.useState<string | null>(null);
  const [clearMessage, setClearMessage] = React.useState<string | null>(null);

  const memoryQuery = useQuery({
    queryKey: ['user-memories'],
    queryFn: async () => {
      const response = await fetch('/api/memory', { cache: 'no-store' });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error('Unable to load saved memory');
      return MemoryListResponseSchema.parse(payload).memories;
    },
    retry: false,
  });

  const refreshMemory = async () => {
    await queryClient.invalidateQueries({ queryKey: ['user-memories'] });
    await queryClient.invalidateQueries({ queryKey: ['profile-insights'] });
  };

  const handleCreate = async (key: string, value: string) => {
    const response = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const payload: unknown = await response.json();
    MemoryMutationResponseSchema.parse(payload);
    setAdding(false);
    await refreshMemory();
  };

  const handleClear = async () => {
    setClearing(true);
    setClearError(null);
    setClearMessage(null);
    try {
      const response = await fetch('/api/memory', { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to clear saved memory');
      setConfirmClear(false);
      setClearMessage('All saved memory was cleared.');
      await refreshMemory();
    } catch {
      setClearError('Unable to clear saved memory right now.');
    } finally {
      setClearing(false);
    }
  };

  const memories = memoryQuery.data ?? [];

  return (
    <section className="space-y-4" aria-labelledby="memory-heading">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2
            id="memory-heading"
            className="type-section-label !text-text-primary"
          >
            AI Memory
          </h2>
          <p className="text-xs leading-relaxed text-text-secondary">
            Saved memory is stored as structured preferences with a source,
            confidence, and update time. Raw conversation text is not copied
            into this memory list. Preferences you add may be sent to Anthropic (Claude)
            when you use MUSE AI features.
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={13} className="mr-1.5" />
            Add memory
          </Button>
        )}
      </div>

      {adding && (
        <MemoryForm
          idPrefix="new"
          submitLabel="Add memory"
          onCancel={() => setAdding(false)}
          onSubmit={handleCreate}
        />
      )}

      <div className="rounded-lg border border-border-subtle bg-surface/30 px-4">
        {memoryQuery.isLoading ? (
          <p className="py-4 text-xs text-text-muted">
            Loading saved memory...
          </p>
        ) : memoryQuery.isError ? (
          <p role="alert" className="py-4 text-xs text-red-400">
            Unable to load saved memory right now.
          </p>
        ) : memories.length === 0 ? (
          <p className="py-4 text-xs text-text-muted">
            No structured preferences are saved yet.
          </p>
        ) : (
          <ul aria-label="Saved AI memory">
            {memories.map((memory) => (
              <MemoryItem
                key={memory.id}
                memory={memory}
                onSaved={refreshMemory}
                onDeleted={refreshMemory}
              />
            ))}
          </ul>
        )}
      </div>

      {clearMessage && (
        <p role="status" className="text-xs text-accent">
          {clearMessage}
        </p>
      )}
      {clearError && (
        <p role="alert" className="text-xs text-red-400">
          {clearError}
        </p>
      )}

      {memories.length > 0 && !confirmClear && (
        <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
          <Trash2 size={13} className="mr-1.5" />
          Clear all memory
        </Button>
      )}

      {confirmClear && (
        <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-secondary">
            Clear every saved memory item? Recommendation preferences remain
            unchanged.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={clearing}
              onClick={() => setConfirmClear(false)}
            >
              <X size={13} className="mr-1.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={clearing}
              onClick={() => void handleClear()}
            >
              {clearing ? 'Clearing...' : 'Confirm clear all'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
