import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('sends a trimmed message on Enter and clears the field', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByRole('textbox', { name: 'Message MUSE' });
    fireEvent.change(input, { target: { value: '  Find new soul music  ' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

    expect(onSend).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledWith('Find new soul music');
    expect(input).toHaveValue('');
  });

  it('does not send on Shift and Enter', () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);

    const input = screen.getByRole('textbox', { name: 'Message MUSE' });
    fireEvent.change(input, { target: { value: 'Keep this message open' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
    expect(input).toHaveValue('Keep this message open');
  });

  it('provides a named send control that stays disabled without a message', () => {
    render(<ChatInput onSend={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByText('Enter to send. Shift and Enter for a new line.'))
      .toBeInTheDocument();
  });

  it('disables both message entry and submission while a reply is pending', () => {
    render(<ChatInput onSend={vi.fn()} disabled />);

    expect(screen.getByRole('textbox', { name: 'Message MUSE' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });
});
