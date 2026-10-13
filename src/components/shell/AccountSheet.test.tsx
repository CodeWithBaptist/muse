import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSheet } from './AccountSheet';
const auth = vi.hoisted(() => ({ authenticated: true, logout: vi.fn() }));
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    ...auth,
    user: {
      displayName: 'A very long tester display name that should wrap',
      avatarUrl: null,
    },
  }),
}));
beforeEach(() => {
  auth.authenticated = true;
  auth.logout
    .mockReset()
    .mockResolvedValue({
      ok: false,
      message: 'Unable to log out right now. Please try again.',
    });
});
function setup() {
  render(<AccountSheet />);
  fireEvent.click(screen.getByRole('button', { name: 'Account' }));
  return within(screen.getByRole('dialog', { name: 'Account' }));
}
describe('phone account', () => {
  it('offers guest identity and display preferences, but no tester settings, Spotify status or logout', () => {
    auth.authenticated = false;
    const sheet = setup();
    expect(sheet.getByText('Guest')).toBeInTheDocument();
    expect(sheet.getByText('Chat stays on this device')).toBeInTheDocument();
    expect(sheet.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(sheet.getByRole('group', { name: 'Lite mode' })).toBeInTheDocument();
    expect(sheet.queryByText('Spotify connected')).toBeNull();
    expect(sheet.queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(sheet.queryByRole('button', { name: 'Log out' })).toBeNull();
  });
  it('shows the tester, wraps their name, opens Settings and reports failed logout', async () => {
    const sheet = setup();
    expect(sheet.getByText('Spotify connected')).toBeInTheDocument();
    expect(sheet.getByText(/very long tester/).parentElement).toHaveClass(
      'break-words',
    );
    expect(sheet.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
    fireEvent.click(sheet.getByRole('button', { name: 'Log out' }));
    await waitFor(() =>
      expect(sheet.getByRole('alert')).toHaveTextContent('Unable to log out'),
    );
    expect(auth.logout).toHaveBeenCalledOnce();
    expect(sheet.getByRole('button', { name: 'Log out' })).not.toBeDisabled();
  });
  it('closes on Settings and returns focus on dismiss', () => {
    const sheet = setup();
    fireEvent.click(sheet.getByRole('link', { name: 'Settings' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Account' }),
    );
  });
});
