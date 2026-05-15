import { SmtpEmailAdapter } from './smtp.adapter';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'msg-1' });
const mockTransporter = { sendMail: mockSendMail };

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => mockTransporter),
}));

describe('SmtpEmailAdapter', () => {
  it('is always available', () => {
    const adapter = new SmtpEmailAdapter({
      host: 'smtp.example.com',
      port: 587,
      user: 'user',
      pass: 'pass',
    });
    expect(adapter.isAvailable()).toBe(true);
  });

  it('sends mail with default from', async () => {
    const { createTransport } = jest.requireMock('nodemailer');
    const adapter = new SmtpEmailAdapter({
      host: 'smtp.example.com',
      port: 587,
      user: 'user@example.com',
      pass: 'pass',
    });
    const result = await adapter.sendMail({
      to: 'to@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });
    expect(result.messageId).toBe('msg-1');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'user@example.com' }),
    );
  });

  it('sends mail with custom fromName and fromEmail', async () => {
    const { createTransport } = jest.requireMock('nodemailer');
    const adapter = new SmtpEmailAdapter({
      host: 'smtp.example.com',
      port: 587,
      user: 'user@example.com',
      pass: 'pass',
    });
    await adapter.sendMail({
      to: 'to@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      fromName: 'Sender',
      fromEmail: 'sender@example.com',
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Sender <sender@example.com>' }),
    );
  });

  it('sends mail with fromEmail only', async () => {
    const { createTransport } = jest.requireMock('nodemailer');
    const adapter = new SmtpEmailAdapter({
      host: 'smtp.example.com',
      port: 587,
      user: 'user@example.com',
      pass: 'pass',
    });
    await adapter.sendMail({
      to: 'to@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
      fromEmail: 'sender@example.com',
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'sender@example.com' }),
    );
  });
});
