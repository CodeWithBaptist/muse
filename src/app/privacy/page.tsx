import type { Metadata } from 'next';
import {
  LEGAL_DRAFT_DATE,
  LegalDocument,
  LegalLink,
  LegalList,
  LegalParagraph,
  Placeholder,
} from '@/components/legal/LegalDocument';
import { LEGAL_CONTACT_EMAIL, LEGAL_OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy | MUSE',
  description:
    'What MUSE keeps in your browser, what it sends to the AI provider and the music catalogues, what the server stores, and how to remove all of it.',
};

/**
 * Every statement below is tied to a code path:
 * no-account chat: src/app/api/chat/open-chat.ts, src/lib/guest-chat-store.ts
 * AI requests: src/lib/ai/playlist-engine.ts, taste-insights.ts, taste-context.ts (10 artists, 10 tracks)
 * catalogue checks: src/lib/catalogue (Deezer, then the Apple iTunes Search API)
 * Last.fm and the export upload: src/app/api/taste/lastfm/route.ts, src/lib/taste/read-export.ts (browser only)
 * counters: src/lib/security/rate-limit.ts (hashed IP), src/lib/ai/budget.ts (global, Lagos day)
 * cookies: src/lib/session.ts, src/lib/security/turnstile.ts, src/lib/testers.ts, src/app/api/auth/spotify/route.ts
 * browser storage: src/lib/guest-chat-store.ts, chat-preferences-store.ts, ui-prefs-store.ts, taste/store.ts
 * tester scopes and stored fields: src/lib/spotify.ts, src/db/schema.ts
 * tester controls: src/app/api/me/export, src/app/api/me/spotify, src/app/api/me/account, src/app/api/memory
 */
export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      summary="MUSE recommends music from a few words. You do not need an account, and by default MUSE keeps your conversation in your own browser rather than on a server. This page lists what stays on your device, what is sent to the AI provider and the music catalogues, what the server stores, what changes if you use the optional features, and how to remove all of it."
      draftDate={LEGAL_DRAFT_DATE}
      sections={[
        {
          id: 'who',
          title: 'Who is responsible',
          body: (
            <LegalParagraph>
              {LEGAL_OPERATOR}, is the data controller for the personal data
              described on this page. For questions or requests about your data,
              write to{' '}
              <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
                {LEGAL_CONTACT_EMAIL}
              </LegalLink>
              .
            </LegalParagraph>
          ),
        },
        {
          id: 'no-account',
          title: 'Using MUSE without an account',
          body: (
            <>
              <LegalParagraph>
                The chat works for everyone with no sign-in. In that mode MUSE
                keeps these things in your browser&apos;s local storage, on your
                device only, and never uploads them as a record:
              </LegalParagraph>
              <LegalList
                items={[
                  'The last 40 messages of your conversation (key muse.chat.local.v1).',
                  'Your chat settings: the Nigeria or Global scope and the English, Pidgin, or mix language choice (key muse.chat.prefs.v1).',
                  'Your display settings: dark or light, Lite mode, and whether sounds are on (key muse.ui.prefs.v1).',
                  'Your taste snapshot, if you add one on the Profile page (key muse.taste.v1). See the optional features below.',
                ]}
              />
              <LegalParagraph>
                The server keeps no account, no conversation, and no profile for
                a visitor without an account. It keeps only the short-lived
                counters described under &quot;What the server stores&quot;.
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
                this draft) to read your request, choose songs, and write the
                one-line reasons and the words about your taste. Depending on
                the feature, a request contains:
              </LegalParagraph>
              <LegalList
                items={[
                  'Chat: your message (up to 500 characters), up to ten earlier messages in the same conversation, your scope and language choice, and, when you have added a taste snapshot, the names of up to ten artists and ten songs from it with the name of its source (Last.fm or a Spotify export).',
                  'Your taste in words: the same ten artists and ten songs from the snapshot, with any date range and play count the source provided.',
                  'For testers who sign in with Spotify: the Chat, Discover, and Profile requests also include the names of up to ten top artists and tracks read from Spotify, and the Memory notes written in Settings.',
                ]}
              />
              <LegalParagraph>
                MUSE does not send your email address, IP address, Last.fm
                username, Spotify user ID, or any token to OpenAI. OpenAI
                processes API requests under its own API terms and data usage
                policy (linked below); under those terms API data is not used to
                train its models. MUSE caps the model&apos;s output and the
                shared daily budget; when the budget is reached MUSE says it is
                resting instead of answering.
              </LegalParagraph>
              <LegalParagraph>
                The model proposes songs; it does not confirm them. MUSE checks
                every suggestion against public music catalogues (next section)
                and labels what it could not confirm as unverified. AI output
                can still be wrong, which the{' '}
                <LegalLink href="/terms">Terms of Service</LegalLink> explain.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'catalogues',
          title: 'Music catalogues and open-in links',
          body: (
            <>
              <LegalParagraph>
                To check that a song is real, the MUSE server sends its title
                and artist name to the Deezer API and, when Deezer finds
                nothing, to the Apple iTunes Search API. These requests carry
                song names only; they do not include your message, your IP
                address, or anything about you. Results are cached briefly on
                the server by song name.
              </LegalParagraph>
              <LegalParagraph>
                Cover art is loaded by your browser directly from Deezer&apos;s
                or Apple&apos;s image servers, which therefore see your IP
                address and browser details in the same way as any image on the
                web. Lite mode and the unverified state show no artwork.
              </LegalParagraph>
              <LegalParagraph>
                &quot;Open in&quot; links take you to a search for the song on
                Audiomack, Boomplay, Spotify, Apple Music, YouTube Music, or
                Deezer. Nothing is sent to those services until you tap a link;
                after that their own privacy policies apply. The Share action
                uses your device&apos;s share sheet or opens WhatsApp with the
                list as text; MUSE does not see where you send it.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'optional',
          title: 'Optional features: Last.fm and a Spotify data export',
          body: (
            <>
              <LegalList
                items={[
                  <>
                    <strong className="font-semibold text-text-primary">
                      Last.fm
                    </strong>
                    : if you type a Last.fm username on the Profile page, the
                    MUSE server asks the Last.fm API for that account&apos;s
                    public top artists and recent tracks, and returns a snapshot
                    to your browser. The server does not store the username or
                    the result. The snapshot label (for example &quot;Last.fm:
                    ada&quot;) stays in your browser. Only public Last.fm data
                    is read; MUSE cannot read a private profile.
                  </>,
                  <>
                    <strong className="font-semibold text-text-primary">
                      Spotify data export
                    </strong>
                    : the file you get from Spotify&apos;s &quot;Download your
                    data&quot; is read inside your browser. The raw file is
                    never uploaded and the server never receives it. Your
                    browser keeps only the summary: up to 50 artist names and 50
                    song names, the date range, and the play count.
                  </>,
                ]}
              />
              <LegalParagraph>
                Both are things you choose to add. &quot;Remove from this
                device&quot; on the Profile page deletes the snapshot at once.
                When you ask for &quot;Your taste in words&quot;, the ten
                artists and ten songs described above go to the AI provider.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'server',
          title: 'What the server stores',
          body: (
            <>
              <LegalParagraph>For every visitor:</LegalParagraph>
              <LegalList
                items={[
                  'Rate-limit counters, keyed by a one-way hash of your IP address (never the address itself) and reset after each window, which is one minute for most requests and one hour at most. They live in a managed Redis store or in the MUSE database.',
                  'A shared daily usage total for the whole service, with no per-visitor detail.',
                  'Ordinary server logs kept by the hosting provider for a limited time, which can include IP addresses and request paths but never message text, keys, or tokens.',
                ]}
              />
              <LegalParagraph>
                For testers who sign in with Spotify, the server also stores an
                account record, conversations, recommendations, playlists
                created through MUSE, a taste profile, preferences, and Memory
                notes, as described under &quot;Testers who sign in with
                Spotify&quot;.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'cookies',
          title: 'Cookies',
          body: (
            <>
              <LegalParagraph>
                A visitor without an account normally has no MUSE cookie at all.
                These are the only cookies MUSE can set:
              </LegalParagraph>
              <LegalList
                items={[
                  <>
                    <code className="text-text-primary">muse_human</code>: set
                    for two hours after you pass a Cloudflare Turnstile check,
                    and only when the operator has turned the check on. It holds
                    a signed timestamp, not an identifier. Cloudflare processes
                    your IP address and browser details to run the check under
                    its own privacy policy.
                  </>,
                  <>
                    <code className="text-text-primary">muse_tester</code>: set
                    for 30 days after a tester enters the tester key. It holds a
                    signed pass, not an identifier.
                  </>,
                  <>
                    <code className="text-text-primary">muse_session</code>:
                    keeps a signed-in tester signed in. It is HttpOnly,
                    SameSite=Lax, Secure in production, and expires 30 days
                    after sign-in.
                  </>,
                  <>
                    <code className="text-text-primary">
                      spotify_auth_state
                    </code>{' '}
                    and{' '}
                    <code className="text-text-primary">
                      spotify_code_verifier
                    </code>
                    : protect the sign-in handshake with Spotify for testers and
                    expire after ten minutes.
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
          id: 'testers',
          title: 'Testers who sign in with Spotify',
          body: (
            <>
              <LegalParagraph>
                Spotify sign-in is not offered to the public. It is available
                only to testers the operator has allow-listed or who hold the
                tester key, so that the &quot;Create in Spotify&quot; feature
                can be tested. If you are not a tester, nothing in this section
                applies to you and MUSE receives nothing from Spotify about you.
              </LegalParagraph>
              <LegalParagraph>
                A tester connects through Spotify&apos;s own sign-in page; MUSE
                never sees the Spotify password. Spotify asks the tester to
                grant these permissions:
              </LegalParagraph>
              <LegalList
                items={[
                  <>
                    <strong className="font-semibold text-text-primary">
                      Profile
                    </strong>{' '}
                    (user-read-private, user-read-email): Spotify user ID,
                    display name, email address, and profile image. MUSE stores
                    these four fields.
                  </>,
                  <>
                    <strong className="font-semibold text-text-primary">
                      Listening
                    </strong>{' '}
                    (user-top-read, user-read-recently-played,
                    user-library-read): top artists, top tracks, recently played
                    tracks, and saved tracks and albums, read from Spotify when
                    a request needs them and not kept as a separate copy.
                  </>,
                  <>
                    <strong className="font-semibold text-text-primary">
                      Playlists
                    </strong>{' '}
                    (playlist-modify-private, playlist-modify-public): to create
                    playlists in the tester&apos;s account. Playlists MUSE
                    creates are private unless changed in Spotify.
                  </>,
                  <>
                    <strong className="font-semibold text-text-primary">
                      Playback
                    </strong>{' '}
                    (user-read-playback-state, user-modify-playback-state): to
                    see available devices and what is playing, and to start,
                    pause, or skip on a chosen device. Spotify requires Premium
                    for this.
                  </>,
                ]}
              />
              <LegalParagraph>
                Spotify gives MUSE an access token and a refresh token. MUSE
                stores both encrypted (AES-256-GCM) with their scope and expiry,
                and uses them for nothing else. For a signed-in tester the
                server stores conversations, the recommendations shown,
                playlists created through MUSE (name, Spotify playlist ID, track
                list), a short taste profile, preferences, and Memory notes
                written in Settings. Nothing a tester does is ever required of
                an ordinary visitor: no feature for the public depends on a
                Spotify account or token.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'retention',
          title: 'How long data is kept',
          body: (
            <LegalList
              items={[
                'Browser storage stays on your device until you clear it, start a new chat, or remove the taste snapshot.',
                'Rate-limit counters expire with their window, at most one hour after the last request. The shared daily total resets every day (West Africa Time).',
                'The Turnstile pass lasts two hours; the tester pass and a tester session last 30 days; the Spotify handshake cookies last ten minutes.',
                'Catalogue lookups are cached on the server by song name for a short time and contain no personal data.',
                'Tester account data is kept until the tester deletes it. Disconnecting Spotify deletes tokens, conversations, recommendations, taste profile, and playlist records right away; the account, preferences, and Memory notes stay until the account is deleted.',
              ]}
            />
          ),
        },
        {
          id: 'controls',
          title: 'Deleting your data',
          body: (
            <>
              <LegalParagraph>Without an account:</LegalParagraph>
              <LegalList
                items={[
                  '"New chat" in the chat header deletes the stored conversation from your browser.',
                  '"Remove from this device" on the Profile page deletes the taste snapshot.',
                  "Clearing this site's data in your browser settings removes everything else, including your display and chat settings.",
                  'There is nothing to delete on the server for you: the counters hold no address and expire on their own.',
                ]}
              />
              <LegalParagraph>
                Testers signed in with Spotify can, in Settings:
              </LegalParagraph>
              <LegalList
                items={[
                  'Export their data as a JSON file. Tokens are never included.',
                  'Disconnect Spotify, which deletes the data listed under retention.',
                  'Delete the account, which removes everything MUSE stores about them.',
                  'Add, edit, delete, or clear Memory notes.',
                ]}
              />
              <LegalParagraph>
                A tester can also withdraw MUSE&apos;s access from the Spotify
                account page under Apps. Deleting data in MUSE does not delete
                playlists already created in a Spotify account. For anything
                these controls do not cover, write to{' '}
                <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
                  {LEGAL_CONTACT_EMAIL}
                </LegalLink>{' '}
                and it will be handled within 30 days.
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
                  'OpenAI (United States), which processes the AI requests described above.',
                  'Deezer and Apple, whose catalogue APIs receive song names from the server and whose image servers deliver cover art to your browser.',
                  'Last.fm, which receives the username you type, only when you use that feature.',
                  'Cloudflare, which runs the Turnstile check when the operator has turned it on.',
                  <>
                    Vercel, which hosts MUSE in its US East region, and{' '}
                    <Placeholder>database provider</Placeholder>, which hosts
                    the MUSE database in the same region. The rate-limit store
                    is Upstash Redis when it is configured.
                  </>,
                  'Audiomack, Boomplay, Spotify, Apple Music, YouTube Music, Deezer, and WhatsApp receive data only when you tap a link or share to them.',
                  'Spotify AB, for testers who sign in, under its own privacy policy.',
                ]}
              />
              <LegalParagraph>
                MUSE does not sell personal data, does not show advertising, and
                shares data with no one else unless the law requires it.
                Payments are not open; when a paid plan opens, Paystack will
                process payments and this page will change first.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'transfers',
          title: 'Where data is processed',
          body: (
            <LegalParagraph>
              MUSE is operated from Nigeria and hosted in the United States, and
              the AI provider processes requests there. Where the Nigeria Data
              Protection Act 2023 applies, MUSE relies on your consent to the
              optional features, on the necessity of the processing to provide
              the service you asked for, and on its legitimate interest in
              keeping the service secure for the counters. The transfers rest on
              the processors&apos; contractual data protection commitments.
            </LegalParagraph>
          ),
        },
        {
          id: 'security',
          title: 'Security',
          body: (
            <LegalParagraph>
              API keys live only on the server, visitor IP addresses are stored
              only as one-way hashes, Spotify tokens are encrypted at rest,
              cookies cannot be read by scripts, requests are rate limited, and
              every request that touches tester data checks the session first.
              No system is perfectly secure; if you believe your data has been
              exposed, write to{' '}
              <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
                {LEGAL_CONTACT_EMAIL}
              </LegalLink>
              .
            </LegalParagraph>
          ),
        },
        {
          id: 'children',
          title: 'Children',
          body: (
            <LegalParagraph>
              MUSE is not directed at children. Under the Nigeria Data
              Protection Act 2023 a child is anyone under 18; if you are under
              18, use the optional features that involve personal data (the
              Last.fm import, the data export upload, and tester sign-in) only
              with a parent or guardian&apos;s consent. Tester sign-in also
              requires the minimum age Spotify sets in your country.
            </LegalParagraph>
          ),
        },
        {
          id: 'rights',
          title: 'Your rights',
          body: (
            <LegalParagraph>
              Under the Nigeria Data Protection Act 2023, and similar laws where
              you live, you can ask to access, correct, delete, or receive a
              copy of your personal data, withdraw consent, object to
              processing, and complain to the Nigeria Data Protection Commission
              or your own data protection authority. For a visitor without an
              account, MUSE holds nothing it could return, so the controls above
              are the whole answer; for anything else, write to{' '}
              <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
                {LEGAL_CONTACT_EMAIL}
              </LegalLink>
              .
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
        'Fill in the database provider and confirm the hosting region.',
        'Confirm the lawful bases and the cross-border transfer wording against the NDPA 2023 and the NDPC General Application and Implementation Directive, and check whether MUSE must register with the NDPC as a data controller of major importance.',
        'Confirm the children wording (the NDPA treats anyone under 18 as a child and requires verifiable parental consent).',
        'Check the OpenAI API data usage wording against the current policy before publishing.',
        'Re-check the tester permissions list whenever src/lib/spotify.ts changes its scopes, and the storage keys whenever a store changes.',
        'Add a payments section (Paystack as processor, what is stored, refunds) before PAYMENTS_ENABLED is turned on.',
        'Verify every external link opens the intended page.',
      ]}
      references={[
        {
          label: 'Nigeria Data Protection Commission',
          href: 'https://ndpc.gov.ng/',
        },
        {
          label: 'OpenAI API data usage policies',
          href: 'https://openai.com/policies/api-data-usage-policies',
        },
        {
          label: 'Deezer privacy policy',
          href: 'https://www.deezer.com/legal/personal-datas',
        },
        {
          label: 'Apple privacy policy',
          href: 'https://www.apple.com/legal/privacy/',
        },
        {
          label: 'Last.fm privacy policy',
          href: 'https://www.last.fm/legal/privacy',
        },
        {
          label: 'Cloudflare privacy policy',
          href: 'https://www.cloudflare.com/privacypolicy/',
        },
        {
          label: 'Spotify Privacy Policy (testers)',
          href: 'https://www.spotify.com/legal/privacy-policy/',
        },
        {
          label: 'Manage apps connected to a Spotify account (testers)',
          href: 'https://www.spotify.com/account/apps/',
        },
      ]}
    />
  );
}
