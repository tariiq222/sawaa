import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LocaleProvider } from '@/features/locale/locale-provider';
import { ChatComposer } from './chat-composer';

describe('ChatComposer', () => {
  it('submits trimmed text on Enter and keeps Shift+Enter for a new line', () => {
    const onSend = vi.fn(async () => undefined);
    render(
      <LocaleProvider locale="en">
        <ChatComposer disabled={false} onSend={onSend} />
      </LocaleProvider>,
    );
    const input = screen.getByLabelText('Message');

    fireEvent.change(input, { target: { value: '  Opening hours?  ' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('Opening hours?', expect.any(String));
  });

  it('reuses the same client message id after a lost-response retry', async () => {
    const onSend = vi.fn()
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce(undefined);
    render(<LocaleProvider locale="en"><ChatComposer disabled={false} onSend={onSend} /></LocaleProvider>);
    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Opening hours?' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
    expect(onSend.mock.calls[1][1]).toBe(onSend.mock.calls[0][1]);
  });
});
