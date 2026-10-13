import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SendFeedbackLink } from '@/components/support/SendFeedbackLink';
import { LEGAL_CONTACT_EMAIL } from './legal';
import { FEEDBACK_SUBJECT, feedbackMailto } from './feedback';

const read = (relative: string) =>
  readFileSync(path.join(process.cwd(), relative), 'utf8');

describe('feedback link', () => {
  it('writes to the contact address already on the Privacy page, with a subject', () => {
    expect(FEEDBACK_SUBJECT).toBe('MUSE feedback');
    expect(feedbackMailto()).toBe(
      `mailto:${LEGAL_CONTACT_EMAIL}?subject=MUSE%20feedback`,
    );
    expect(read('src/app/privacy/page.tsx')).toContain(
      '<LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>',
    );
  });

  it('renders a real mailto link with the prefilled subject', () => {
    render(<SendFeedbackLink />);
    const link = screen.getByTestId('send-feedback');
    expect(link.getAttribute('href')).toBe(
      `mailto:${LEGAL_CONTACT_EMAIL}?subject=MUSE%20feedback`,
    );
    expect(link.textContent).toBe('Send feedback');
  });

  it('is a plain anchor with no tracker, script, request, or form', () => {
    const source = read('src/components/support/SendFeedbackLink.tsx');
    expect(source).not.toMatch(
      /use client|<script|gtag|analytics|fetch\(|XMLHttpRequest|<form/,
    );
    expect(source).toContain('feedbackMailto');
    expect(read('src/lib/feedback.ts')).toContain('mailto:');
    // The footer and the chat menu, and nowhere else.
    expect(read('src/components/landing/SiteFooter.tsx')).toContain(
      '<SendFeedbackLink',
    );
    expect(read('src/app/(app)/chat/page.tsx')).toContain('<SendFeedbackLink');
    expect(path.join('src', 'components', 'support')).toBeTruthy();
  });
});
