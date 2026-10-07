import { LegalDocument } from '@/components/legal/LegalDocument';

/**
 * Spotify attribution, as an honest working document.
 *
 * The surfaces below are the screens that actually render Spotify metadata or
 * artwork in the current code. The file level inventory is kept in
 * docs/part-a-trust-fixes.md. Approved wording and the approved brand asset
 * cannot be produced from inside the product: they must come from Spotify's
 * current Design and Branding Guidelines and be checked against a running
 * deployment, so those two sections stay marked as open.
 */
export default function SpotifyAttributionPage() {
  return (
    <LegalDocument
      title="Spotify attribution"
      statusNote="Draft pending legal review"
      intro="MUSE displays content from Spotify. This page records where that content appears and what still has to be completed. It is not final attribution and it does not yet contain an approved brand asset."
      sections={[
        {
          title: 'Relationship to Spotify',
          paragraphs: [
            'MUSE is an independent product built on the Spotify Web API. It is not endorsed, certified, reviewed, or produced by Spotify.',
            'MUSE does not host or stream audio. It searches the Spotify catalogue, reads your own library and listening data with your permission, creates playlists you confirm, and sends playback commands to your own Spotify devices.',
          ],
        },
        {
          title: 'Screens that display Spotify content',
          paragraphs: [
            'Every screen below shows Spotify metadata, artwork, or both, and each one needs attribution placed according to the current official guidelines:',
          ],
          items: [
            'Chat, where recommended tracks show artwork, title, artist, and duration',
            'The playlist draft preview, before anything is created in Spotify',
            'Now Playing, showing artwork, title, artist, and progress',
            'Mobile navigation, showing the current track',
            'The sidebar, showing your Spotify display name and avatar',
            'Library, showing recently played, top artists, top tracks, saved tracks, saved albums, and playlists',
            'Discover, showing artwork and track details in editorial sections',
            'Playlists, showing playlist artwork, names, and track metadata',
            'Profile, showing top artist names and insights derived from your listening',
            'Artwork transitions between those contexts',
          ],
        },
        {
          title: 'Links to Spotify',
          paragraphs: [
            'Spotify metadata links out to the corresponding destination on open.spotify.com from Library, Now Playing, the Playlists screen, and the playlist creation flow.',
            'The track link helper validates a 22 character Spotify identifier before producing a link, so a malformed identifier cannot generate a dead link.',
          ],
          note: 'Open item: confirm against the current guidelines that every surface required to link does link, and that no surface links to a destination the guidelines do not permit.',
        },
        {
          title: 'Content MUSE deliberately does not use',
          paragraphs: [
            'MUSE requests no audio features, no audio analysis, no related artists endpoint, and no Spotify recommendations endpoint. Preview URLs returned by Spotify are discarded rather than stored or played.',
            'The scripted demonstration on the landing page is labelled Sample, uses no Spotify artwork or identifiers, never contacts Spotify, and has inert controls.',
          ],
        },
        {
          title: 'Approved attribution wording',
          paragraphs: [
            '[To be completed: insert the approved attribution wording from Spotify\'s current Design and Branding Guidelines. Substitute wording must not be invented.]',
          ],
        },
        {
          title: 'Approved brand asset',
          paragraphs: [
            '[To be completed: insert the approved brand asset and confirm its required size, colour, and clear space. Spotify\'s guidelines specify exact assets and treatments, so a drawn substitute must not be used.]',
          ],
        },
        {
          title: 'Known policy items requiring review',
          paragraphs: [
            'MUSE sends Spotify derived listening data to an AI provider in order to interpret requests and rank results. Spotify\'s Developer Policy restricts analysing Spotify content and using Spotify content for AI ingestion. This use requires policy and legal review before public release.',
            'Disconnecting Spotify currently retains MUSE account identity and saved preferences. Spotify\'s Developer Policy asks for deletion of a user\'s personal data and no further processing after disconnection. This is recorded as an open compliance item.',
          ],
          note: 'Both items are described in the privacy notice and tracked in the project decision log rather than being presented as resolved.',
        },
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
      ]}
    />
  );
}
