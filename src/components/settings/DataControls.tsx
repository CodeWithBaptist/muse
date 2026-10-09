'use client';

import * as React from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function DataControls() {
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [exportMessage, setExportMessage] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmation, setConfirmation] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    setExportMessage(null);

    try {
      const response = await fetch('/api/me/export', { cache: 'no-store' });
      if (!response.ok) throw new Error('Export request failed');

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = 'muse-data-export.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setExportMessage('Your MUSE data export has been downloaded.');
    } catch {
      setExportError('Unable to export your data right now.');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch('/api/me/account', { method: 'DELETE' });
      if (!response.ok) throw new Error('Account deletion failed');
      window.location.assign('/');
    } catch {
      setDeleteError('Unable to delete the MUSE account right now.');
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 border-t border-border-subtle pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-text-primary">
            Export data
          </h3>
          <p className="text-xs text-text-secondary">
            Download the profile, saved preferences, memory, conversations,
            recommendations, playlists, and Spotify connection metadata stored
            by MUSE. OAuth tokens are not included.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={exporting}
          onClick={() => void handleExport()}
        >
          <Download size={13} className="mr-1.5" />
          {exporting ? 'Preparing export...' : 'Download data'}
        </Button>
      </div>

      {exportMessage && (
        <p role="status" className="text-xs text-accent">
          {exportMessage}
        </p>
      )}
      {exportError && (
        <p role="alert" className="text-xs text-danger">
          {exportError}
        </p>
      )}

      <div className="space-y-3 border-t border-border-subtle pt-5">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-text-primary">
            Delete MUSE account and stored data
          </h3>
          <p className="text-xs leading-relaxed text-text-secondary">
            This removes your MUSE profile, preferences, memory, conversations,
            recommendations, playlists, and saved Spotify tokens. It does not
            delete your Spotify account or automatically remove data already
            sent to OpenAI. Revoke MUSE access from your Spotify account
            separately. This action cannot be undone.
          </p>
        </div>

        {!confirmDelete ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDeleteError(null);
              setConfirmDelete(true);
            }}
          >
            <Trash2 size={13} className="mr-1.5" />
            Delete account and data
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border border-border-subtle bg-surface p-4">
            <label
              htmlFor="delete-account-confirmation"
              className="block text-xs text-text-secondary"
            >
              Type DELETE to confirm account deletion.
            </label>
            <input
              id="delete-account-confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full max-w-xs rounded-md border border-border-subtle bg-background px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={deleting || confirmation !== 'DELETE'}
                onClick={() => void handleDelete()}
              >
                {deleting ? 'Deleting account...' : 'Confirm deletion'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={deleting}
                onClick={() => {
                  setConfirmDelete(false);
                  setConfirmation('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {deleteError && (
          <p role="alert" className="text-xs text-danger">
            {deleteError}
          </p>
        )}
      </div>
    </div>
  );
}
