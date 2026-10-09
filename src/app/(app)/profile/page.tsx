import type { Metadata } from 'next';
import { ProfileView } from '@/components/profile/ProfileView';
import { isLastfmConfigured } from '@/lib/taste/lastfm';

export const metadata: Metadata = {
  title: 'Profile',
  description:
    'Your taste in words. Bring your listening from Last.fm or a Spotify data export and MUSE writes a short profile from it, on your device, with no account.',
};

/**
 * Open to everyone. The only server-side fact the page needs is whether
 * Last.fm import is switched on, so the form can say so instead of failing.
 */
export default function ProfilePage() {
  return <ProfileView lastfmEnabled={isLastfmConfigured()} />;
}
