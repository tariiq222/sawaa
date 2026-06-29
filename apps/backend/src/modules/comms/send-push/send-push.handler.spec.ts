import { SendPushHandler } from './send-push.handler';
import type { FcmService } from '../../../infrastructure/mail';

const buildFcm = (available = true) => ({
  isAvailable: jest.fn().mockReturnValue(available),
  sendPush: jest.fn().mockResolvedValue('msg-id'),
});

describe('SendPushHandler', () => {
  it('sends push via FCM', async () => {
    const fcm = buildFcm(true);
    await new SendPushHandler(fcm as unknown as FcmService).execute({
      token: 'tok-1',
      title: 'Hello',
      body: 'World',
    });
    expect(fcm.sendPush).toHaveBeenCalledWith('tok-1', 'Hello', 'World', undefined);
  });

  it('skips when FCM unavailable', async () => {
    const fcm = buildFcm(false);
    await new SendPushHandler(fcm as unknown as FcmService).execute({
      token: 'tok-1',
      title: 'Hello',
      body: 'World',
    });
    expect(fcm.sendPush).not.toHaveBeenCalled();
  });

  it('rethrows when fcm.sendPush rejects so the dispatcher retry path engages (P1-11)', async () => {
    const fcm = buildFcm(true);
    fcm.sendPush = jest.fn().mockRejectedValue(new Error('FCM error'));
    const handler = new SendPushHandler(fcm as unknown as FcmService);
    await expect(handler.execute({ token: 'bad-token', title: 'T', body: 'B' })).rejects.toThrow(
      'FCM error',
    );
  });

  it('does not throw when FCM is unavailable (deliberate skip, not a failure)', async () => {
    const fcm = buildFcm(false);
    fcm.sendPush = jest.fn().mockRejectedValue(new Error('FCM error'));
    const handler = new SendPushHandler(fcm as unknown as FcmService);
    await expect(handler.execute({ token: 'tok', title: 'T', body: 'B' })).resolves.toBeUndefined();
    expect(fcm.sendPush).not.toHaveBeenCalled();
  });

  it('passes data payload to FCM', async () => {
    const fcm = buildFcm(true);
    const handler = new SendPushHandler(fcm as unknown as FcmService);
    const data = { bookingId: 'b-1' };
    await handler.execute({ token: 'tok', title: 'T', body: 'B', data });
    expect(fcm.sendPush).toHaveBeenCalledWith('tok', 'T', 'B', data);
  });
});
