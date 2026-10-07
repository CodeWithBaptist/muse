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
  title: 'Spotify Attribution | MUSE',
  description:
    'How MUSE uses Spotify content, the Spotify Web API, and the Spotify brand.',
};

export default function SpotifyAttributionPage() {
  return (
    <LegalDocument
      title="Spotify Attribution"
      summary="All music in MUSE comes from Spotify. This page states what that means: where the content comes from, what MUSE does with it, how the Spotify brand is used, and that MUSE is not Spotify."
      draftDate={LEGAL_DRAFT_DATE}
      sections={[
        {
          id: 'content',
          title: 'Where the music comes from',
          body: (
            <>
              <LegalParagraph>
                Every track, artist, album, playlist, and piece of artwork shown
                in MUSE is provided by Spotify through the Spotify Web API. MUSE
                searches Spotify&apos;s catalogue for each request and shows
                what Spotify returns; it has no catalogue of its own and never
                invents tracks.
              </LegalParagraph>
              <LegalParagraph>
                Each track MUSE shows links back to that track on Spotify. Audio
                never plays inside MUSE: playback happens in your Spotify app on
                a device you choose, and MUSE only sends the play, pause, and
                skip commands you ask for. Spotify requires Premium for that.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'independence',
          title: 'MUSE is not Spotify',
          body: (
            <LegalParagraph>
              MUSE is an independent product built by{' '}
              <Placeholder>Operator name</Placeholder>. It is not affiliated
              with, endorsed by, certified by, or sponsored by Spotify AB.
              Spotify and the Spotify logo are trademarks of Spotify AB. Nothing
              in MUSE should be read as Spotify&apos;s opinion or
              recommendation.
            </LegalParagraph>
          ),
        },
        {
          id: 'brand',
          title: 'How MUSE uses the Spotify brand',
          body: (
            <>
              <LegalParagraph>
                MUSE is built to follow Spotify&apos;s Design and Branding
                Guidelines for anything that carries the Spotify name: the
                connect button, the links back to Spotify, and any Spotify logo.
                In practice that means:
              </LegalParagraph>
              <LegalList
                items={[
                  'The Spotify name appears only where the action really goes to Spotify, such as connecting your account or opening a track.',
                  'Spotify logos are used unmodified, in the colours and clear space the guidelines allow, or not at all.',
                  "Spotify content is attributed to Spotify and is never presented as MUSE's own catalogue.",
                ]}
              />
              <LegalParagraph>
                If you notice a place where MUSE falls short of the guidelines,
                write to <Placeholder>contact email</Placeholder> and it will be
                corrected.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'data',
          title: 'What MUSE does with Spotify data',
          body: (
            <>
              <LegalParagraph>
                MUSE asks for the Spotify permissions listed in the{' '}
                <LegalLink href="/privacy">Privacy Policy</LegalLink> and uses
                the data for one purpose: answering your request. Listening data
                is read from Spotify when a request needs it and is not kept as
                a separate copy. MUSE keeps track references (the Spotify ID,
                name, and artists) only as part of recommendations you were
                shown and playlists you created.
              </LegalParagraph>
              <LegalParagraph>
                MUSE does not store audio, does not resell or redistribute
                Spotify content, and does not use Spotify data to train models.
              </LegalParagraph>
            </>
          ),
        },
        {
          id: 'your-account',
          title: 'Your Spotify account stays yours',
          body: (
            <LegalParagraph>
              Playlists MUSE creates live in your Spotify account, where you can
              rename, edit, or delete them like any other playlist. You can
              withdraw MUSE&apos;s access at any time from your Spotify account
              page under Apps; MUSE then loses the ability to read or change
              anything on your behalf.
            </LegalParagraph>
          ),
        },
      ]}
      reviewNotes={[
        'Fill in the operator name and the contact email.',
        'Check the connect button, track links, and any logo use against the current Spotify Design and Branding Guidelines before launch.',
        'Confirm the Spotify Developer Terms and Developer Policy still permit each use described above.',
        'Verify every external link opens the intended page.',
      ]}
      references={[
        {
          label: 'Spotify Design and Branding Guidelines',
          href: 'https://developer.spotify.com/documentation/design',
        },
        {
          label: 'Spotify Developer Terms',
          href: 'https://developer.spotify.com/terms',
        },
        {
          label: 'Spotify Developer Policy',
          href: 'https://developer.spotify.com/policy',
        },
        {
          label: 'Manage apps connected to your Spotify account',
          href: 'https://www.spotify.com/account/apps/',
        },
      ]}
    />
  );
}
