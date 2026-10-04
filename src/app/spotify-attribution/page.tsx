import { LegalPlaceholder } from '@/components/legal/LegalPlaceholder';

export default function SpotifyAttributionPage() {
  return (
    <LegalPlaceholder
      title="Spotify attribution"
      intro="This page is a placeholder structure for review. It does not contain final branding, artwork treatment, or attribution text. Verify every Spotify content surface against the current official guidelines before release."
      sections={[
        {
          title: 'Approved attribution',
          prompt:
            '[Placeholder: insert the approved Spotify attribution wording for this product.]',
        },
        {
          title: 'Brand asset',
          prompt:
            '[Placeholder: insert the approved Spotify brand asset and confirm its required size, color, and clear space.]',
        },
        {
          title: 'Placement by product surface',
          prompt:
            '[Placeholder: list each screen that displays Spotify metadata, artwork, preview audio, or playback, and document the required nearby attribution.]',
        },
        {
          title: 'Links to Spotify',
          prompt:
            '[Placeholder: verify that Spotify metadata and artwork link to the corresponding Spotify destination where required.]',
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
      ]}
    />
  );
}
