'use client';

import * as React from 'react';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ListedTrack } from '@/lib/catalogue/types';
import {
  playlistAsCsv,
  playlistAsShareText,
  playlistAsText,
  playlistFileStem,
  whatsAppShareUrl,
} from '@/lib/playlist-text';

/**
 * Copy, download, and share for a list. Nothing here needs an account or a
 * key: the clipboard, a Blob download, and the Web Share API, with a
 * WhatsApp link when sharing is not available in this browser. Every
 * outcome is reported next to the button, including failures.
 */

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const subscribeToNothing = () => () => {};

function downloadBlob(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-3 text-xs font-semibold text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary focus-ring disabled:opacity-50';

export interface PlaylistActionsProps {
  title: string;
  tracks: ListedTrack[];
  className?: string;
}

export function PlaylistActions({
  title,
  tracks,
  className,
}: PlaylistActionsProps) {
  const [notice, setNotice] = React.useState<Notice>(null);
  const [copied, setCopied] = React.useState(false);
  // Feature detection waits for the browser; the server renders the WhatsApp link.
  const canShare = React.useSyncExternalStore(
    subscribeToNothing,
    () =>
      typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    () => false,
  );
  const noticeTimer = React.useRef<number | null>(null);

  React.useEffect(
    () => () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    },
    [],
  );

  const announce = React.useCallback((next: Notice) => {
    setNotice(next);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    if (next)
      noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const document_ = React.useMemo(
    () => ({
      title,
      tracks,
      link:
        typeof window === 'undefined'
          ? undefined
          : `${window.location.origin}/chat`,
    }),
    [title, tracks],
  );

  const copyList = async () => {
    const text = playlistAsText(document_);
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error('Clipboard not available');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      announce({ tone: 'ok', text: 'List copied.' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      announce({
        tone: 'error',
        text: 'Copy is not available in this browser. Download the text instead.',
      });
    }
  };

  const downloadText = () => {
    try {
      downloadBlob(
        `${playlistFileStem(title)}.txt`,
        'text/plain;charset=utf-8',
        playlistAsText(document_),
      );
      announce({ tone: 'ok', text: 'Text file downloaded.' });
    } catch {
      announce({
        tone: 'error',
        text: 'The download did not start. Try Copy list instead.',
      });
    }
  };

  const downloadCsv = () => {
    try {
      downloadBlob(
        `${playlistFileStem(title)}.csv`,
        'text/csv;charset=utf-8',
        playlistAsCsv(document_),
      );
      announce({ tone: 'ok', text: 'CSV downloaded.' });
    } catch {
      announce({
        tone: 'error',
        text: 'The download did not start. Try Copy list instead.',
      });
    }
  };

  const share = async () => {
    const text = playlistAsShareText(document_);
    try {
      await navigator.share({ title, text });
    } catch (error) {
      // Closing the share sheet is not a failure worth reporting.
      if (error instanceof Error && error.name === 'AbortError') return;
      announce({
        tone: 'error',
        text: 'Sharing did not work here. Use the WhatsApp link or Copy list.',
      });
    }
  };

  const whatsApp = whatsAppShareUrl(playlistAsShareText(document_));

  return (
    <div className={cn('space-y-2', className)} data-testid="playlist-actions">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copyList}
          className={BUTTON}
          aria-label="Copy list"
        >
          {copied ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          <span>Copy list</span>
        </button>
        <button
          type="button"
          onClick={downloadText}
          className={BUTTON}
          aria-label="Download as text"
        >
          <Download size={14} aria-hidden="true" />
          <span>Text</span>
        </button>
        <button
          type="button"
          onClick={downloadCsv}
          className={BUTTON}
          aria-label="Download as CSV"
        >
          <Download size={14} aria-hidden="true" />
          <span>CSV</span>
        </button>
        {canShare ? (
          <button
            type="button"
            onClick={share}
            className={BUTTON}
            aria-label="Share list"
          >
            <Share2 size={14} aria-hidden="true" />
            <span>Share</span>
          </button>
        ) : (
          <a
            href={whatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className={BUTTON}
            data-testid="share-whatsapp"
          >
            <Share2 size={14} aria-hidden="true" />
            <span>Share on WhatsApp</span>
          </a>
        )}
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn(
          'min-h-4 text-xs',
          notice?.tone === 'error' ? 'text-danger' : 'text-text-muted',
        )}
      >
        {notice?.text ?? ''}
      </p>
    </div>
  );
}
