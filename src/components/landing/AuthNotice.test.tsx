import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AUTH_NOTICES,
  AuthNotice,
  readAuthErrorParam,
  resolveAuthNotice,
} from './AuthNotice';

describe('AuthNotice', () => {
  it('renders nothing without a code', () => {
    const { container } = render(<AuthNotice />);
    expect(container.innerHTML).toBe('');
  });

  it('explains each code the auth routes can send', () => {
    for (const [code, notice] of Object.entries(AUTH_NOTICES)) {
      const { unmount } = render(<AuthNotice code={code} />);
      const status = screen.getByRole('status');
      expect(status.textContent).toContain(notice.title);
      expect(status.textContent).toContain(notice.body);
      unmount();
    }
  });

  it('falls back to a generic, still honest message for unknown codes', () => {
    render(<AuthNotice code="something_new" />);
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Spotify sign-in did not complete.');
    expect(status.textContent).toContain('Nothing was connected.');
  });

  it('only ever promises what the redirect guarantees', () => {
    for (const notice of Object.values(AUTH_NOTICES)) {
      expect(`${notice.title} ${notice.body}`).toMatch(
        /[Nn]othing (was connected|was saved|can be connected)/,
      );
    }
  });

  it('reads only well formed codes from the query string', () => {
    expect(readAuthErrorParam({})).toBeUndefined();
    expect(readAuthErrorParam({ error: 'auth_failed' })).toBe('auth_failed');
    expect(readAuthErrorParam({ error: ['auth_failed', 'other'] })).toBe(
      'auth_failed',
    );
    expect(readAuthErrorParam({ error: 'Not A Code' })).toBeUndefined();
    expect(readAuthErrorParam({ error: '<script>' })).toBeUndefined();
    expect(resolveAuthNotice(undefined)).toBeNull();
  });
});
