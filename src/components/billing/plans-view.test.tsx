// @vitest-environment jsdom
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlansView } from './PlansView';

const CLOSED = {
  enabled: false,
  configured: false,
  provider: 'paystack' as const,
  currency: 'NGN' as const,
  live: false,
};

describe('PlansView', () => {
  it('shows both plans, no price for Plus yet, and no form while payments are off', () => {
    render(<PlansView status={CLOSED} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'MUSE Plus' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('plan-free')).toHaveTextContent('NGN 0');
    expect(screen.getByTestId('plan-plus')).toHaveTextContent(
      'price to be announced',
    );
    expect(screen.getByTestId('plus-closed')).toHaveTextContent(
      'Nothing is charged',
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /paystack/i })).toBeNull();
    expect(document.body.textContent?.toLowerCase()).toContain(
      'spotify account',
    );
  });

  it('keeps the form closed with the flag on until a price exists, and never claims Plus on return', () => {
    render(
      <PlansView
        status={{ ...CLOSED, enabled: true, configured: true }}
        returned
      />,
    );
    expect(screen.getByTestId('plus-closed')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'does not claim it yet',
    );
  });
});
