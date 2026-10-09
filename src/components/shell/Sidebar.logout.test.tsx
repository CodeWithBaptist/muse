import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

const auth = vi.hoisted(() => ({
  logout: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { displayName: 'Ada', email: 'ada@example.com', avatarUrl: null },
    authenticated: true,
    isLoading: false,
    logout: auth.logout,
  }),
}));

describe('Sidebar log out', () => {
  beforeEach(() => {
    auth.logout.mockReset();
  });

  it('marks the control busy while the server ends the session', async () => {
    let finish: (value: { ok: true }) => void = () => {};
    auth.logout.mockReturnValue(
      new Promise<{ ok: true }>((resolve) => {
        finish = resolve;
      }),
    );
    render(<Sidebar />);

    const button = screen.getByRole('button', { name: 'Log out' });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(
      screen
        .getByRole('button', { name: 'Logging out' })
        .getAttribute('aria-busy'),
    ).toBe('true');
    expect(
      (screen.getByRole('button', { name: 'Logging out' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    await act(async () => {
      finish({ ok: true });
    });
    // On success the hook navigates away; the control simply stays busy.
    expect(screen.getByRole('button', { name: 'Logging out' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the failure and lets the person try again instead of pretending', async () => {
    auth.logout.mockResolvedValue({
      ok: false,
      message: 'Unable to log out right now. Please try again.',
    });
    render(<Sidebar />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(
      'Unable to log out right now. Please try again.',
    );
    const button = screen.getByRole('button', {
      name: 'Log out',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('aria-describedby')).toBe(alert.id);
  });
});
