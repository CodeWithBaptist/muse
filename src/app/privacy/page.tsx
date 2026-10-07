import { LegalPlaceholder } from '@/components/legal/LegalPlaceholder';

export default function PrivacyPage() {
  return (
    <LegalPlaceholder
      title="Privacy"
      intro="This page is a placeholder structure for review. Replace each prompt with verified information before publication."
      sections={[
        {
          title: 'Information and Spotify data',
          prompt:
            '[Placeholder: identify account information, Spotify data, user messages, preferences, and stored content accessed by MUSE.]',
        },
        {
          title: 'Use and AI services',
          prompt:
            '[Placeholder: describe what information is sent to Anthropic (Claude) or other service providers, why it is sent, and how each provider processes it.]',
        },
        {
          title: 'Storage and retention',
          prompt:
            '[Placeholder: describe stored data, retention periods, backup handling, and deletion behavior.]',
        },
        {
          title: 'User controls',
          prompt:
            '[Placeholder: explain Spotify disconnect, Spotify access revocation, memory controls, data export, and account deletion.]',
        },
        {
          title: 'Contact and applicable requirements',
          prompt:
            '[Placeholder: add a verified privacy contact and review the requirements that apply to MUSE and its users.]',
        },
      ]}
    />
  );
}
