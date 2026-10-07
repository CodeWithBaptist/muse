import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';
import { Input } from './Input';
import { Textarea } from './Textarea';

describe('Field', () => {
  it('associates the label with the control', () => {
    render(
      <Field label="Playlist name">
        {(control) => <Input {...control} defaultValue="Late drive" />}
      </Field>,
    );
    const input = screen.getByLabelText('Playlist name');
    expect(input).toHaveValue('Late drive');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('describes the control with the hint when there is no error', () => {
    render(
      <Field label="Description" hint="Shown under the playlist in Spotify.">
        {(control) => <Textarea {...control} />}
      </Field>,
    );
    const textarea = screen.getByLabelText('Description');
    const hint = screen.getByText('Shown under the playlist in Spotify.');
    expect(textarea).toHaveAttribute('aria-describedby', hint.id);
  });

  it('switches to the error, marks the control invalid, and announces it', () => {
    render(
      <Field
        label="Playlist name"
        hint="Keep it short."
        error="Give the playlist a name."
      >
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText('Playlist name');
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Give the playlist a name.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
    expect(screen.queryByText('Keep it short.')).toBeNull();
  });

  it('marks required controls without relying on the asterisk alone', () => {
    render(
      <Field label="Artist" required>
        {(control) => <Input {...control} />}
      </Field>,
    );
    expect(screen.getByLabelText(/Artist/)).toHaveAttribute(
      'aria-required',
      'true',
    );
  });

  it('respects an explicit id', () => {
    render(
      <Field label="Key" id="memory-key">
        {(control) => <Input {...control} />}
      </Field>,
    );
    expect(screen.getByLabelText('Key')).toHaveAttribute('id', 'memory-key');
  });
});
