import { LegalPlaceholder } from '@/components/legal/LegalPlaceholder';

export default function TermsPage() {
  return (
    <LegalPlaceholder
      title="Terms"
      intro="This page is a placeholder structure for review. The prompts below are not service terms. Add reviewed text before publication."
      sections={[
        {
          title: 'Account and access',
          prompt:
            '[Placeholder: set out reviewed account, eligibility, and access requirements.]',
        },
        {
          title: 'Spotify integration',
          prompt:
            '[Placeholder: explain the relationship to Spotify and identify applicable third-party terms without implying endorsement.]',
        },
        {
          title: 'AI features and generated content',
          prompt:
            '[Placeholder: describe the scope and limitations of AI features, and the reviewed terms for generated content.]',
        },
        {
          title: 'Acceptable use',
          prompt: '[Placeholder: add reviewed rules for use of the service.]',
        },
        {
          title: 'Availability and changes',
          prompt:
            '[Placeholder: describe service availability, updates, and how changes to these terms will be handled.]',
        },
        {
          title: 'Contact',
          prompt:
            '[Placeholder: add a verified contact method for questions about these terms.]',
        },
      ]}
    />
  );
}
