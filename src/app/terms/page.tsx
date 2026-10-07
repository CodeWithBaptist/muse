import { LegalDocument } from '@/components/legal/LegalDocument';

/**
 * Terms, written from the behaviour currently in the code.
 *
 * The clauses below describe what MUSE really does: playback commands rather
 * than audio streaming, playlists created only after confirmation, partial
 * creation reported honestly, recommendations limited to tracks Spotify
 * returned, and an explicit unavailable state when a credential is missing.
 * Sections that require counsel are left marked rather than filled in with
 * plausible sounding boilerplate.
 */
export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms"
      statusNote="Draft pending legal review"
      intro="These terms describe how MUSE actually behaves today. They are a draft and have not been reviewed by counsel. The liability, governing law, and contact sections are deliberately left incomplete."
      sections={[
        {
          title: 'What MUSE is',
          paragraphs: [
            'MUSE is a music discovery companion that works on top of Spotify. It is not a streaming service, it does not host audio, and it does not play audio itself. Playback happens through Spotify on your own devices.',
          ],
        },
        {
          title: 'Your Spotify account',
          paragraphs: [
            'To use the music features you must connect a Spotify account and grant the permissions listed in the privacy notice. You remain responsible for complying with Spotify\'s own terms of use.',
            'Playing full tracks through Spotify requires a Spotify Premium account. Where Premium is not available, MUSE offers an Open in Spotify action instead and does not present playback controls that cannot work.',
          ],
          note: 'MUSE is an independent product. It is not endorsed, certified, or reviewed by Spotify.',
        },
        {
          title: 'Recommendations and generated content',
          paragraphs: [
            'MUSE interprets your request, builds Spotify search queries, and recommends only tracks that Spotify search actually returned. A track identifier proposed by the AI that Spotify did not return is discarded rather than shown.',
            'Recommendations are produced with the assistance of a large language model. They can be wrong, incomplete, or simply not to your taste.',
            'The short reason shown against each recommendation is generated text describing why a track fits your request. It is not a statement of fact about the recording, its production, or its chart history.',
          ],
        },
        {
          title: 'Playlists',
          paragraphs: [
            'MUSE creates a playlist in your Spotify account only after you confirm the action. Nothing is created silently and no existing Spotify playlist is modified without your explicit confirmation.',
            'If some tracks cannot be added, MUSE reports the playlist as partially created and identifies what failed. A failed creation is never reported as a success.',
          ],
        },
        {
          title: 'Saved preferences',
          paragraphs: [
            'MUSE can store preferences you save and reuse them in later recommendations. Only preferences you explicitly save are reused this way. You can view, edit, delete, or clear them at any time in Settings.',
          ],
        },
        {
          title: 'Availability and honest failure states',
          paragraphs: [
            'MUSE depends on Spotify and on an AI provider. When either is unavailable, misconfigured, or rate limited, MUSE reports that state plainly rather than substituting invented content.',
            'Some features show an explicit unavailable state until the relevant credential is configured. The landing page connection action is disabled and labelled when Spotify credentials are not present.',
            'The scripted demonstration on the landing page is labelled Sample, never contacts Spotify or OpenAI, creates nothing, and has inert controls.',
          ],
        },
        {
          title: 'Acceptable use',
          paragraphs: ['You agree not to:'],
          items: [
            'attempt to circumvent rate limits or abuse protections',
            'probe the service for another user\'s data',
            'use MUSE to harvest Spotify catalogue data at scale',
            'submit content intended to subvert the AI system into ignoring its instructions',
          ],
        },
        {
          title: 'No warranty',
          paragraphs: [
            'MUSE is provided as is and as available. Music availability, catalogue metadata, and playback depend on Spotify, on your account, and on your region. MUSE does not warrant that any particular track, artist, or feature will be available to you.',
          ],
        },
        {
          title: 'Limitation of liability and governing law',
          paragraphs: [
            '[To be completed by counsel. These clauses carry jurisdiction specific consequences and must not be filled in with unreviewed boilerplate.]',
          ],
        },
        {
          title: 'Changes to these terms and contact',
          paragraphs: [
            '[To be completed: add the process for notifying users of changes, and a real contact address. No contact route exists in the product today.]',
          ],
        },
      ]}
      references={[
        {
          label: 'Spotify Developer Terms',
          href: 'https://developer.spotify.com/terms',
        },
        {
          label: 'Spotify Design and Branding Guidelines',
          href: 'https://developer.spotify.com/documentation/design',
        },
      ]}
    />
  );
}
