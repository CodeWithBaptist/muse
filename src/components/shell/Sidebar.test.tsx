import { render, screen } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/chat',
}));

describe('Sidebar', () => {
  it('renders navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('New chat')).toBeDefined();
    expect(screen.getByText('Discover')).toBeDefined();
  });

  it('indicates active state for current path', () => {
    render(<Sidebar />);
    const chatLink = screen.getByText('New chat').closest('a');
    // Primary items use text-accent for active state
    expect(chatLink?.className).toContain('text-accent');
    
    const discoverLink = screen.getByText('Discover').closest('a');
    // We mocked pathname to '/chat', so discover shouldn't be active
    expect(discoverLink?.className).toContain('text-text-secondary');
  });
});
