import type { Metadata } from 'next';
import {
  LEGAL_DRAFT_DATE,
  LegalDocument,
  LegalLink,
  LegalList,
  LegalParagraph,
  Placeholder,
} from '@/components/legal/LegalDocument';

export const metadata: Metadata = {
  title: 'Privacy Policy | MUSE',
  description:
    'What MUSE receives from Spotify, what it stores, what it sends to the AI provider, and how to remove it.',
};

/**
 * Every statement below is tied to a code path:
 * scopes: src/lib/spotify.ts
 * stored fields: src/db/schema.ts and src/app/api/auth/spotify/callback/route.ts
 * AI requests: src/lib/ai/recommendation-engine.ts, discover-engine.ts, profile-engine.ts
 * cookies: src/lib/session.ts and src/app/api/auth/spotify/route.ts
 * controls: src/app/api/me/export, src/app/api/me/spotify, src/app/api/me/account, src/app/api/memory
 */
export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      summary="MUSE connects to your Spotify account and uses an AI model to recommend music, create playlists, and describe your taste. This page lists what MUSE receives, what it keeps, what it sends to other services, and how you remove all of it."
      draftDate={LEGAL_DRAFT_DATE}
      sections={[
        {
          id: 'who',
          title: 'Who is responsible',
          body: (
            <LegalParagraph>
              <Placeholder>Operator name</Placeholder> operates MUSE and is
              responsible for the personal data described on this page. For
              questions or requests about your data, write to{' '}
              <Placeholder>contact email</Placeholder>.
            </LegalParagraph>
          ),
        },
        {
          id: 'spotify',
          title: 'What MUSE receives from Spotify',
          body: (
            <>
              <LegalParagraph>
                You connect MUSE through Spotify&apos;s own sign-in page. MUSE
                never sees your Spotify password. During sign-in, Spotify asks
                you to grant MUSE these permissions:
              </LegalParagraph>
              <LegalList
                items={[
                  <>
                    <strong className="font-semibold text-text-primary">
                      Your profile
                    </strong>{' '}
                    (user-read-private, user-read-email): your Spotify user ID,
                    display name, email address, and profile image. MUSE stores
                    these four fields.
                  </>,
                  <>
                    <strong className="font-semibold text-text-primary">
                      Your listening
                    </strong>{' '}
                    (user-top-read, user-read-recently-played,
                    user-library-read): your top artists, top tracks, recently
                    played tracks, and saved tracks and albums. MUSE reads these
                    from Spotify when it needs them for a request.
                  </>,
                  <>
                    <strong className="font-semibold text-text-primary">
                      Playlists
                    </strong>{' '}
                    (playlist-modify-private, playlist-modify-public): to create
                    playlists in your account and add tracks to them. Playlists
                    MUSE creates are private unless you change that in Spotify.
                  </>,
                  <>
                    <strong className="font-semibold text-text-primary">
                      Playback
                    </strong>{' '}
                    (user-read-playback-state, user-modify-playback-state): to
                    see your available Spotify devices and what is playing, and
                    to start, pause, or skip playback on a device you choose.
                    Spotify requires Premium for this.
                  </>,
                ]}
              />
              <LegalParagraph>
                Spotify gives MUSE an access token and a refresh token so it can
                call the Spotify Web API on your behalf. MUSE stores both tokens
                encrypted (AES-256-GCM) together with their scope and expiry
                time, and uses them for nothing else.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'stored',
          title: 'What MUSE stores about your use',
          body: (
            <>
              <LegalList
                items={[
                  'Your conversations with MUSE: every message you send and every reply.',
                  'The recommendations MUSE showed you, with the one-line reason for each.',
                  'Playlists you created through MUSE: the name, the Spotify playlist ID, and the track list.',
                  'Your taste profile: a short list of your top artists and genres, plus the moods and energy MUSE inferred from them.',
                  'Preferences you set in the app.',
                  'Memory notes you write in Settings. MUSE only remembers what you type there; it does not write memories on its own.',
                  'Short-lived rate-limit counters keyed by your user ID or, before sign-in, by your IP address. They reset after each window, which is one minute for most requests.',
                ]}
              />
              <LegalParagraph>
                MUSE does not keep a separate copy of your listening history. It
                reads it from Spotify each time, and only what ends up in a
                recommendation, a playlist, or your taste profile is stored.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'ai',
          title: 'What is sent to the AI provider',
          body: (
            <>
              <LegalParagraph>
                MUSE uses the OpenAI API (the gpt-4o-mini model at the time of
                this draft) to understand requests, write replies, and describe
                your taste. Depending on the feature, a request contains:
              </LegalParagraph>
              <LegalList
                items={[
                  'Chat: your message, earlier messages in the same conversation, the names of up to five of your top artists and top tracks, and your Memory notes.',
                  'Discover: the names of up to ten of your top artists and top tracks, and your Memory notes.',
                  'Your taste profile: the names of up to ten long-term top artists and top tracks, your ten most recently played tracks, and your Memory notes.',
                ]}
              />
              <LegalParagraph>
                MUSE does not send your email address, Spotify user ID, tokens,
                or IP address to OpenAI. The model only proposes search queries
                and words; every track MUSE shows comes from a Spotify catalogue
                search, never from the model&apos;s memory. OpenAI processes API
                requests under its own API terms and data usage policy (linked
                below). MUSE does not use your data to train models.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'cookies',
          title: 'Cookies',
          body: (
            <>
              <LegalList
                items={[
                  <>
                    <code className="text-text-primary">muse_session</code>:
                    keeps you signed in. It is HttpOnly, SameSite=Lax, Secure in
                    production, and expires 30 days after you sign in.
                  </>,
                  <>
                    <code className="text-text-primary">
                      spotify_auth_state
                    </code>{' '}
                    and{' '}
                    <code className="text-text-primary">
                      spotify_code_verifier
                    </code>
                    : protect the sign-in handshake with Spotify and expire
                    after ten minutes.
                  </>,
                ]}
              />
              <LegalParagraph>
                MUSE sets no analytics, advertising, or third-party cookies and
                loads no tracking scripts.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'retention',
          title: 'How long MUSE keeps data',
          body: (
            <LegalList
              items={[
                'Account data, conversations, recommendations, playlists, your taste profile, preferences, and Memory notes are kept until you delete them or your account.',
                'Disconnecting Spotify deletes your tokens, conversations, recommendations, taste profile, and playlist records right away. Your account, preferences, and Memory notes stay until you delete the account.',
                'A session expires 30 days after sign-in. Signing out ends it immediately.',
                'Rate-limit counters are reused and reset after each window.',
              ]}
            />
          ),
        },
        {
          id: 'controls',
          title: 'Your controls',
          body: (
            <>
              <LegalParagraph>In Settings you can, at any time:</LegalParagraph>
              <LegalList
                items={[
                  'Export your data. MUSE returns everything it holds about you as a JSON file. Tokens are never included.',
                  'Disconnect Spotify, which deletes the data listed in the section above.',
                  'Delete your account, which removes everything MUSE stores about you.',
                  'Add, edit, delete, or clear your Memory notes.',
                ]}
              />
              <LegalParagraph>
                You can also withdraw MUSE&apos;s access from your Spotify
                account page under Apps. Deleting data in MUSE does not delete
                playlists that were already created in your Spotify account; you
                manage those in Spotify.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'sharing',
          title: 'Who else receives data',
          body: (
            <>
              <LegalList
                items={[
                  'Spotify AB, which provides your account and the music catalogue under its own privacy policy.',
                  'OpenAI, which processes the AI requests described above.',
                  <>
                    <Placeholder>Hosting and database provider</Placeholder>,
                    which runs MUSE and stores its database.
                  </>,
                ]}
              />
              <LegalParagraph>
                MUSE does not sell personal data, does not show advertising, and
                shares data with no one else unless the law requires it.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'security',
          title: 'Security',
          body: (
            <LegalParagraph>
              Spotify tokens are encrypted at rest, session cookies cannot be
              read by scripts, requests are rate limited, and every request that
              touches your data checks your session first. No system is
              perfectly secure; if you believe your data has been exposed, write
              to <Placeholder>contact email</Placeholder>.
            </LegalParagraph>
          ),
        },
        {
          id: 'children',
          title: 'Children',
          body: (
            <LegalParagraph>
              MUSE is not directed at children under 13, or under the minimum
              age Spotify requires in your country if that is higher.
            </LegalParagraph>
          ),
        },
        {
          id: 'rights',
          title: 'Your rights',
          body: (
            <LegalParagraph>
              Depending on where you live, including under the Nigeria Data
              Protection Act 2023 where it applies, you can ask to access,
              correct, delete, or receive a copy of your personal data, object
              to its processing, and complain to your data protection authority.
              The export and delete controls in Settings cover most of this
              without asking; for anything else, write to{' '}
              <Placeholder>contact email</Placeholder>.
            </LegalParagraph>
          ),
        },
        {
          id: 'changes',
          title: 'Changes to this page',
          body: (
            <LegalParagraph>
              When MUSE starts collecting something new or sending data
              somewhere new, this page and the date at the top change first.
              Check the <LegalLink href="/terms">Terms of Service</LegalLink>{' '}
              and the{' '}
              <LegalLink href="/spotify-attribution">
                Spotify attribution
              </LegalLink>{' '}
              page as well.
            </LegalParagraph>
          ),
        },
      ]}
      reviewNotes={[
        'Fill in the operator name, the contact email, and the hosting and database provider.',
        'Confirm the governing law and the competent data protection authority.',
        'Check the OpenAI API data usage wording against the current policy before publishing.',
        'Re-check the permissions list whenever src/lib/spotify.ts changes its scopes.',
        'Verify every external link opens the intended page.',
      ]}
      references={[
        {
          label: 'Spotify Privacy Policy',
          href: 'https://www.spotify.com/legal/privacy-policy/',
        },
        {
          label: 'Manage apps connected to your Spotify account',
          href: 'https://www.spotify.com/account/apps/',
        },
        {
          label: 'OpenAI API data usage policies',
          href: 'https://openai.com/policies/api-data-usage-policies',
        },
      ]}
    />
  );
}
