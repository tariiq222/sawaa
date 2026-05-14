import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('./contact.api', () => ({
  submitContactMessage: vi.fn(),
}));

import { ContactForm } from './contact-form';
import { submitContactMessage } from './contact.api';

const submitMock = submitContactMessage as unknown as ReturnType<typeof vi.fn>;

function fillField(label: RegExp | string, value: string) {
  const el = screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement;
  fireEvent.change(el, { target: { value } });
}

describe('ContactForm', () => {
  beforeEach(() => {
    submitMock.mockReset();
  });

  it('blocks submission and shows a name error when name is too short', async () => {
    render(<ContactForm locale="en" />);
    fillField(/message/i, 'a valid message');
    fillField(/email/i, 'a@b.co');
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText('Name is required')).toBeTruthy());
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('requires email or phone', async () => {
    render(<ContactForm locale="en" />);
    fillField(/name/i, 'Sara');
    fillField(/message/i, 'a valid message');
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText('Email or phone required')).toBeTruthy());
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('flags messages shorter than 5 characters', async () => {
    render(<ContactForm locale="en" />);
    fillField(/name/i, 'Sara');
    fillField(/email/i, 'a@b.co');
    fillField(/message/i, 'hi');
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText('Message too short')).toBeTruthy());
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('calls submitContactMessage with omitted empty optionals', async () => {
    submitMock.mockResolvedValue(undefined);
    render(<ContactForm locale="en" />);
    fillField(/name/i, 'Sara');
    fillField(/email/i, 'sara@test.com');
    fillField(/message/i, 'Looking forward to the session.');
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(submitMock).toHaveBeenCalled());
    expect(submitMock).toHaveBeenCalledWith({
      name: 'Sara',
      phone: undefined,
      email: 'sara@test.com',
      subject: undefined,
      body: 'Looking forward to the session.',
    });
    await waitFor(() =>
      expect(screen.getByText(/Your message has been sent/i)).toBeTruthy(),
    );
  });

  it('surfaces the API error message when submission fails', async () => {
    submitMock.mockRejectedValue(new Error('Network down'));
    render(<ContactForm locale="en" />);
    fillField(/name/i, 'Sara');
    fillField(/email/i, 'sara@test.com');
    fillField(/message/i, 'Looking forward to the session.');
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(screen.getByText('Network down')).toBeTruthy());
  });

  it('renders Arabic validation error when locale is ar', async () => {
    render(<ContactForm locale="ar" />);
    fillField(/الرسالة/, 'رسالة صالحة');
    fillField(/البريد/, 'a@b.co');
    fireEvent.click(screen.getByRole('button', { name: /إرسال/ }));
    await waitFor(() => expect(screen.getByText('الاسم مطلوب')).toBeTruthy());
  });
});
