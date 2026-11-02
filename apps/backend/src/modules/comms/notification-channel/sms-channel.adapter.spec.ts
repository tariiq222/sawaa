import { Logger } from '@nestjs/common';
import { SmsChannelAdapter, SmsChannelNotConfiguredError } from './sms-channel.adapter';
it('does not log phone, code, or raw provider errors', async () => {
  const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  try {
    const adapter = new SmsChannelAdapter({ isConfigured: () => true, sendOtp: async () => { throw Error('123456 recipient +966512345678'); } } as never);
    await expect(adapter.send('+966512345678', '123456')).rejects.toThrow();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/123456|966512345678/);
  } finally { log.mockRestore(); }
});
it('fails closed when Authentica is not configured', async () => {
  const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  const sendOtp = jest.fn();
  try {
    const adapter = new SmsChannelAdapter({ isConfigured: () => false, sendOtp } as never);
    await expect(adapter.send('+966512345678', '123456')).rejects.toBeInstanceOf(
      SmsChannelNotConfiguredError,
    );
    expect(sendOtp).not.toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/123456|966512345678/);
  } finally { log.mockRestore(); }
});
