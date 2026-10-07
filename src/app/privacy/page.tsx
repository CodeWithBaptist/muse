import { LegalDocument } from '@/components/legal/LegalDocument';

/**
 * Privacy notice, written from the behaviour currently in the code.
 *
 * Every statement here was read out of an implementation: the Spotify scopes
 * from src/lib/spotify.ts, token encryption from src/lib/encryption.ts, the
 * session cookie from src/lib/session.ts, the AI request contents from
 * src/lib/ai/recommendation-engine.ts and src/lib/ai/user-memory.ts, the
 * disconnect behaviour from src/app/api/me/spotify/route.ts, and account
 * deletion from src/app/api/me/account/route.ts. Where the behaviour is
 * narrower than Spotify's Developer Policy requires, that is stated rather
 * than smoothed over.
 */
export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy"
      statusNote="Draft pending legal review"
      intro="This notice describes what MUSE actually collects and does today. It is a draft written from the current implementation and it has not yet been reviewed by counsel. Do not treat it as final."
      sections={[
        {
          title: 'What MUSE collects',
          paragraphs: [
            'When you connect Spotify, MUSE stores your Spotify user id, display name, email address, and avatar image URL. These are read from the Spotify /v1/me endpoint.',
            'When you use MUSE, it fetches listening data from Spotify on your behalf: your top artists, your top tracks, your recently played tracks, your saved tracks, your saved albums, and your playlists.',
            'MUSE also stores the messages you send, the recommendations it returns together with the reason written for each one, the preferences you explicitly save, and the playlists you create inside MUSE with their track metadata.',
          ],
        },
        {
          title: 'What MUSE does not do',
          items: [
            'MUSE runs no analytics, advertising, or tracking software. No third party analytics provider is installed.',
            'No error monitoring service is installed, so crash reports are not sent anywhere.',
            'MUSE does not stream or store audio. Preview URLs returned by Spotify are discarded rather than kept or played.',
            'MUSE does not sell or share your data with advertisers.',
          ],
        },
        {
          title: 'Spotify permissions MUSE requests',
          paragraphs: [
            'Connecting Spotify asks for these scopes and nothing more:',
          ],
          items: [
            'user-read-private and user-read-email, to identify your account',
            'user-top-read and user-read-recently-played, to understand your listening',
            'user-library-read, to show your saved tracks, albums, and playlists',
            'playlist-modify-public and playlist-modify-private, to create playlists you ask for',
            'user-read-playback-state and user-modify-playback-state, to control playback on your own devices',
          ],
          note: 'You can revoke these at any time from your Spotify account settings, independently of MUSE.',
        },
        {
          title: 'How your Spotify tokens are stored',
          paragraphs: [
            'Your Spotify access token and refresh token are encrypted at rest with AES-256-GCM using a server side key held in environment configuration.',
            'Tokens are never returned to your browser, never written to application logs, and never sent to any AI provider.',
          ],
        },
        {
          title: 'What is sent to the AI provider',
          paragraphs: [
            'MUSE uses OpenAI, model gpt-4o-mini, to interpret your request, to rank the candidates Spotify returned, and to write the one line reason shown against each recommendation.',
            'A request to OpenAI may include:',
          ],
          items: [
            'your message, after sanitisation that strips control characters and known prompt injection patterns',
            'up to five of your top artist names',
            'up to five of your top track names, as title and artist',
            'up to twelve preferences you have explicitly saved',
            'the candidate tracks Spotify search returned, as id, title, artist, and album name',
          ],
          note: 'Your email address, avatar, Spotify tokens, and full listening history are not sent to OpenAI. OpenAI processes this content under its own terms, which are not controlled by MUSE.',
        },
        {
          title: 'Your sign-in session',
          paragraphs: [
            'MUSE uses a single cookie named muse_session to keep you signed in. It is httpOnly, marked SameSite=Lax, marked Secure in production, and it expires after 30 days.',
            'State changing requests are checked against the origin of the request before they are accepted.',
          ],
        },
        {
          title: 'What happens when you disconnect Spotify',
          paragraphs: [
            'Disconnecting deletes your stored Spotify tokens, your recommendations, your music profile insights, your conversations and their messages, and any playlists and playlist tracks MUSE created for you. This happens in a single database transaction.',
          ],
          items: [
            'Retained: your MUSE account identity, meaning Spotify id, display name, email, and avatar URL',
            'Retained: preferences and memories you saved',
            'Retained: your active MUSE session',
          ],
          note: 'Open compliance item. This retention is narrower than Spotify\'s Developer Policy requires, which asks for deletion of a user\'s personal data and no further processing after disconnection. It must be remediated before public release, and it is recorded in the project decision log.',
        },
        {
          title: 'What happens when you delete your account',
          paragraphs: [
            'Deleting your account removes your identity record along with every related row: Spotify tokens, conversations and messages, playlists and playlist tracks, recommendations, music profiles, preferences, and memories. Your session is ended and the rate limit counters associated with your account are cleared. This also runs as a single database transaction.',
          ],
        },
        {
          title: 'Your controls',
          paragraphs: ['In Settings you can:'],
          items: [
            'view, edit, and delete each saved preference, or clear them together',
            'export your MUSE data',
            'disconnect Spotify',
            'delete your account and all associated data',
          ],
        },
        {
          title: 'Data sent to Spotify',
          paragraphs: [
            'MUSE reads your profile and library, searches the Spotify catalogue, creates playlists you confirm, and sends playback commands to your own Spotify devices. Recommendations are only ever tracks that Spotify search actually returned. A track id that the AI proposes but Spotify did not return is discarded.',
          ],
        },
        {
          title: 'Retention',
          paragraphs: [
            'Your data is kept until you disconnect Spotify or delete your account, subject to the retention gap described above. MUSE does not currently run scheduled deletion of inactive accounts.',
          ],
        },
        {
          title: 'Contact',
          paragraphs: [
            '[To be completed: a real privacy contact address must be added before publication. No contact route exists in the product today.]',
          ],
        },
      ]}
      references={[
        {
          label: 'Spotify Developer Policy',
          href: 'https://developer.spotify.com/policy',
        },
        {
          label: 'OpenAI privacy and data handling',
          href: 'https://openai.com/privacy',
        },
      ]}
    />
  );
}
