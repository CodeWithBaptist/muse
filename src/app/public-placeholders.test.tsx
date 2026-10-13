import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import HomePage from './page';
import ChatPage from './(app)/chat/page';
import PrivacyPage from './privacy/page';
import TermsPage from './terms/page';
import AttributionPage from './spotify-attribution/page';

vi.mock(
  'motion/react',
  async () => (await import('@/test/motion-mock')).motionMock,
);

describe('public page publication guard', () => {
  it('renders every public page without a Placeholder component', async () => {
    for (const page of [
      await HomePage({}),
      <ChatPage key="chat" />,
      <PrivacyPage key="privacy" />,
      <TermsPage key="terms" />,
      <AttributionPage key="attribution" />,
    ]) {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const html = renderToStaticMarkup(
        <QueryClientProvider client={client}>{page}</QueryClientProvider>,
      );
      expect(html).not.toContain('data-legal-placeholder');
      client.clear();
    }
  });
});
