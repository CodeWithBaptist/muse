import type { Metadata } from 'next';
import {
  LEGAL_DRAFT_DATE,
  LegalDocument,
  LegalLink,
  LegalList,
  LegalParagraph,
} from '@/components/legal/LegalDocument';
import { LEGAL_CONTACT_EMAIL, LEGAL_OPERATOR } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Spotify Attribution | MUSE',
  description:
    'Where Spotify still appears in MUSE, how the Spotify brand is used, and which other services MUSE names.',
};

/**
 * Spotify is no longer where the music comes from: the public product reads
 * Deezer and the Apple iTunes Search API and links out to six services.
 * This page is kept for the Spotify features that remain (tester sign-in,
 * Create in Spotify, the open-in link) and now also names the other
 * services, so one page states every third-party mark MUSE uses.
 */
export default function SpotifyAttributionPage() {
  return (
    <LegalDocument
      title="Spotify Attribution"
      summary="MUSE is an independent product. It is not affiliated with, endorsed by, or sponsored by Spotify or any other music service it names. This page states where Spotify still appears in MUSE, how the Spotify brand is used, and which other services MUSE names and why."
      draftDate={LEGAL_DRAFT_DATE}
      sections={[
        {
          id: 'where',
          title: 'Where Spotify appears in MUSE',
          body: (
            <>
              <LegalParagraph>
                Songs in MUSE are suggested by an AI model and checked against
                the Deezer catalogue and the Apple iTunes Search API. Spotify is
                not the source of those suggestions and is not needed to use
                MUSE. Spotify appears in exactly three places:
              </LegalParagraph>
              <LegalList
                items={[
                  'An "Open in Spotify" search link under each song, next to the same link for Audiomack, Boomplay, Apple Music, YouTube Music, and Deezer. It opens a search on Spotify\'s own site; MUSE does not know whether Spotify has the song.',
                  'Tester sign-in with Spotify and "Create in Spotify", offered only to testers the operator has allow-listed or who hold a tester key, so that playlist creation can be tested through the Spotify Web API.',
                  'The optional Spotify data export upload on the Profile page, which reads the file Spotify gives you inside your browser and never contacts Spotify at all.',
                ]}
              />
              <LegalParagraph>
                For testers, every track, playlist, and piece of artwork shown
                on the Discover, Library, and Playlists pages is provided by
                Spotify through the Spotify Web API, links back to Spotify, and
                stays in the tester&apos;s own Spotify account. Audio never
                plays inside MUSE.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'independence',
          title: 'MUSE is not Spotify',
          body: (
            <LegalParagraph>
              MUSE is an independent product built by {LEGAL_OPERATOR}. It is
              not affiliated with, endorsed by, certified by, or sponsored by
              Spotify AB. Spotify and the Spotify logo are trademarks of Spotify
              AB. Nothing in MUSE should be read as Spotify&apos;s opinion or
              recommendation, and a song appearing in MUSE says nothing about
              whether Spotify carries it.
            </LegalParagraph>
          ),
        },
        {
          id: 'brand',
          title: 'How MUSE uses the Spotify brand',
          body: (
            <>
              <LegalParagraph>
                MUSE follows Spotify&apos;s Design and Branding Guidelines for
                anything that carries the Spotify name. In practice:
              </LegalParagraph>
              <LegalList
                items={[
                  'The Spotify name appears only where the action really goes to Spotify: the open-in link, tester sign-in, and Create in Spotify.',
                  'The public landing page and chat make no claim that MUSE searches Spotify, creates playlists in Spotify, or is powered by Spotify.',
                  'Spotify logos are used unmodified, in the colours and clear space the guidelines allow, or not at all. At the time of this draft MUSE shows the Spotify name as text and no Spotify logo.',
                  "Spotify content shown to testers is attributed to Spotify and is never presented as MUSE's own catalogue.",
                ]}
              />
            </>
          ),
        },
        {
          id: 'other-services',
          title: 'Other services MUSE names',
          body: (
            <>
              <LegalList
                items={[
                  'Deezer: song checks use the public Deezer API; cover art for verified songs comes from Deezer. MUSE is not affiliated with or endorsed by Deezer.',
                  'Apple: when Deezer finds nothing, song checks use the Apple iTunes Search API, and cover art for those songs comes from Apple. Apple Music search links open Apple Music. MUSE is not affiliated with or endorsed by Apple.',
                  'Last.fm: the optional profile import uses the Last.fm API. MUSE is not affiliated with or endorsed by Last.fm.',
                  'Audiomack, Boomplay, and YouTube Music: named only in the open-in search links. MUSE does not use their APIs and is not affiliated with or endorsed by them or by Google.',
                  'WhatsApp: the share fallback opens WhatsApp with your list as text. MUSE is not affiliated with Meta.',
                ]}
              />
              <LegalParagraph>
                All names and marks belong to their owners and are used only to
                say where a link goes or where data comes from. The chat shows a
                short attribution line under each list naming Deezer and the
                Apple iTunes Search API.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'data',
          title: 'What MUSE does with Spotify data',
          body: (
            <LegalParagraph>
              For testers, MUSE asks for the Spotify permissions listed in the{' '}
              <LegalLink href="/privacy">Privacy Policy</LegalLink> and uses the
              data for one purpose: answering the tester&apos;s request.
              Listening data is read from Spotify when a request needs it and is
              not kept as a separate copy. MUSE keeps track references (the
              Spotify ID, name, and artists) only as part of recommendations
              shown and playlists created. MUSE does not store audio, does not
              resell or redistribute Spotify content, does not use Spotify data
              to train models, and offers no paid feature that depends on
              Spotify data. A tester can withdraw access at any time from the
              Spotify account page under Apps. If you notice a place where MUSE
              falls short of a brand guideline, write to{' '}
              <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
                {LEGAL_CONTACT_EMAIL}
              </LegalLink>{' '}
              and it will be corrected.
            </LegalParagraph>
          ),
        },
      ]}
      reviewNotes={[
        'Check the open-in link, tester sign-in, and Create in Spotify against the current Spotify Design and Branding Guidelines before launch; if logos are added, use the official files unmodified.',
        'Check the Deezer API terms for the attribution they require and whether the chat line is enough; add the Deezer logo if they require it.',
        'Check the Apple iTunes Search API terms for required attribution wording and linking.',
        'Confirm with the Last.fm API terms that the "Last.fm" name is enough or whether a logo is required.',
        'Verify every external link opens the intended page.',
      ]}
      references={[
        {
          label: 'Spotify Design and Branding Guidelines',
          href: 'https://developer.spotify.com/documentation/design',
        },
        {
          label: 'Spotify Developer Policy',
          href: 'https://developer.spotify.com/policy',
        },
        {
          label: 'Deezer API terms of use',
          href: 'https://developers.deezer.com/termsofuse',
        },
        {
          label: 'Apple iTunes Search API',
          href: 'https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/',
        },
        {
          label: 'Last.fm API terms of service',
          href: 'https://www.last.fm/api/tos',
        },
      ]}
    />
  );
}
