'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { Logo } from '@/components/ui/Logo';
import { fadeInUp, staggerContainer, transitions } from '@/lib/motion';
import { AuthNotice } from './AuthNotice';
import { SpotifyConnectLink } from './SpotifyConnectLink';
import { SPOTIFY_UNAVAILABLE_EXPLANATION } from './spotify-connect-copy';
import { TesterKeyForm } from './TesterKeyForm';
import { StartAction } from '@/components/landing/StartAction';

function StartWithoutAccount() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <StartAction size="md" />
      <p className="text-sm text-text-muted">Chat without an account.</p>
    </div>
  );
}

/**
 * What MUSE asks Spotify for, in the order it matters to the person
 * connecting. Each line describes a permission the auth route actually
 * requests (see the scopes in src/lib/spotify.ts) and nothing beyond it.
 */
export const SPOTIFY_ACCESS_ITEMS = [
  {
    title: 'What you listen to',
    detail:
      'Top artists, top tracks, recent plays, and your saved music, so recommendations start from your taste instead of a blank slate.',
  },
  {
    title: 'Playlists you ask for',
    detail:
      'MUSE can create playlists in your account and add tracks to them. It only does this when you ask, and they are yours to edit or delete.',
  },
  {
    title: 'Playback on your devices',
    detail:
      'Play, pause, and skip on a Spotify device you choose. Spotify only allows this on Premium accounts.',
  },
  {
    title: 'Your name and email',
    detail:
      'To tell your account apart from others and to show you who is signed in.',
  },
] as const;

/**
 * How this visitor may reach the Spotify sign-in. The sign-in is for testers
 * only: `visible` shows it, `key` asks for a tester key first, `hidden`
 * means no tester access is configured on this MUSE at all.
 */
export type TesterAccess = 'visible' | 'key' | 'hidden';

export interface LoginScreenProps {
  /** Whether the server has what it needs to complete a Spotify sign-in. */
  spotifyLoginAvailable: boolean;
  /** Error code from a sign-in that could not finish, if any. */
  authError?: string;
  /** Validated in-app path to return to after Spotify, if any. */
  next?: string | null;
  /** Defaults to visible so existing callers and tests keep their behaviour. */
  testerAccess?: TesterAccess;
}

export function LoginScreen({
  spotifyLoginAvailable,
  authError,
  next,
  testerAccess = 'visible',
}: LoginScreenProps) {
  const reducedMotion = useReducedMotion();
  const unavailableNoteId = React.useId();
  const item = reducedMotion
    ? { initial: false as const, animate: { opacity: 1 } }
    : { variants: fadeInUp, transition: transitions.standard };

  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col bg-background px-6 py-8 text-text-primary sm:py-12"
    >
      <motion.div
        className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10"
        initial={reducedMotion ? false : 'initial'}
        animate="animate"
        variants={reducedMotion ? undefined : staggerContainer(0.04)}
      >
        <motion.header {...item} className="space-y-6">
          <Link
            href="/"
            aria-label="MUSE home"
            className="inline-flex min-h-10 items-center rounded-sm focus-ring"
          >
            <Logo variant="wordmark" size={104} />
          </Link>
          <div className="space-y-3">
            <p className="type-section-label">Testers</p>
            <h1 className="type-page-title">Connect your Spotify.</h1>
            <p className="max-w-prose text-base leading-relaxed text-text-secondary">
              Spotify sign-in is only for people testing the Spotify features of
              MUSE. Everyone else can start a chat without an account and gets
              the same lists. Connecting takes you to Spotify, where you see
              exactly what is being asked and decide whether to allow it.
            </p>
          </div>
        </motion.header>

        {authError ? (
          <motion.div {...item}>
            <AuthNotice code={authError} className="mx-0 max-w-none" />
          </motion.div>
        ) : null}

        {testerAccess === 'key' ? (
          <motion.div {...item} className="space-y-4">
            <TesterKeyForm />
            <StartWithoutAccount />
          </motion.div>
        ) : null}

        {testerAccess === 'hidden' ? (
          <motion.div {...item} className="space-y-4">
            <p
              className="text-sm leading-relaxed text-text-secondary"
              data-testid="tester-access-hidden"
            >
              Tester access is not set up on this MUSE, so there is nothing to
              sign in to here.
            </p>
            <StartWithoutAccount />
          </motion.div>
        ) : null}

        {testerAccess === 'visible' ? (
          <motion.section
            {...item}
            aria-labelledby="spotify-access-heading"
            className="space-y-4"
          >
            <h2 id="spotify-access-heading" className="type-section-label">
              What MUSE will ask for
            </h2>
            <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface">
              {SPOTIFY_ACCESS_ITEMS.map((access) => (
                <li key={access.title} className="space-y-1 px-4 py-3">
                  <p className="text-sm font-semibold text-text-primary">
                    {access.title}
                  </p>
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {access.detail}
                  </p>
                </li>
              ))}
            </ul>
          </motion.section>
        ) : null}

        {testerAccess === 'visible' ? (
          <motion.div {...item} className="space-y-4">
            <SpotifyConnectLink
              available={spotifyLoginAvailable}
              next={next}
              unavailableDescriptionId={
                spotifyLoginAvailable ? undefined : unavailableNoteId
              }
              className="w-full"
            />
            {spotifyLoginAvailable ? null : (
              <p
                id={unavailableNoteId}
                className="text-sm leading-relaxed text-text-secondary"
                data-spotify-login-note
              >
                {SPOTIFY_UNAVAILABLE_EXPLANATION}
              </p>
            )}
            <p className="text-sm leading-relaxed text-text-muted">
              MUSE never sees your Spotify password. You can disconnect at any
              time from Settings in MUSE or from the apps page of your Spotify
              account.
            </p>
          </motion.div>
        ) : null}

        <motion.footer
          {...item}
          className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border-subtle pt-6 text-xs text-text-secondary"
        >
          <Link
            href="/privacy"
            className="inline-flex min-h-10 items-center rounded-sm transition-colors hover:text-text-primary focus-ring"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-10 items-center rounded-sm transition-colors hover:text-text-primary focus-ring"
          >
            Terms
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-sm transition-colors hover:text-text-primary focus-ring"
          >
            Back to MUSE
          </Link>
        </motion.footer>
      </motion.div>
    </main>
  );
}
