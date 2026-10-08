import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { EmployeeContactStore } from './employee-contact.store';
import { RequestEmployeeContactDto } from './employee-contact.dto';
import { EmailEntryDeliveryError, MobileEmailDelivery } from '../mobile-email-entry/mobile-email-delivery';
import { MobileEmailSendLimiter } from '../mobile-email-entry/mobile-email-send-limiter';

@Injectable()
export class RequestEmployeeContactHandler {
  constructor(private readonly store: EmployeeContactStore, private readonly delivery: MobileEmailDelivery, private readonly limiter: MobileEmailSendLimiter) {}
  async execute(userId: string, input: RequestEmployeeContactDto) {
    const identifier = this.store.normalize(input.channel, input.identifier);
    await this.store.transaction(async tx => {
      const { user, employee } = await this.store.owner(tx, userId);
      if ((input.channel === 'EMAIL' ? user.email : user.phone) === identifier) throw new BadRequestException('contact_unchanged');
      await this.store.available(tx, userId, employee.id, input.channel, identifier);
    });
    // Limit both the destination and the actor, so changing targets cannot bypass the budget.
    const actorReservation = await this.limiter.reserve(input.channel, `employee-contact:${userId}`);
    let reservation: Awaited<ReturnType<MobileEmailSendLimiter['reserve']>>;
    try { reservation = await this.limiter.reserve(input.channel, identifier); }
    catch (error) { await this.limiter.settle(actorReservation, 'rejected'); throw error; }
    const settle = async (outcome: 'accepted' | 'rejected' | 'unknown') => {
      await Promise.all([this.limiter.settle(actorReservation, outcome), this.limiter.settle(reservation, outcome)]);
    };
    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 300000);
    let challenge: { id: string };
    try {
      challenge = await this.store.transaction(async tx => {
        const { user, employee } = await this.store.owner(tx, userId);
        await this.store.available(tx, userId, employee.id, input.channel, identifier);
        await tx.employeeContactChallenge.updateMany({ where: { userId, channel: input.channel, consumedAt: null }, data: { consumedAt: new Date() } });
        return tx.employeeContactChallenge.create({ data: { userId, employeeId: employee.id, channel: input.channel, identifier,
          previousValue: input.channel === 'EMAIL' ? user.email : user.phone, codeHash, expiresAt } });
      });
    } catch (error) { await settle('rejected'); throw error; }
    try { await this.delivery.send(input.channel, identifier, code); }
    catch (error) {
      await this.store.transaction(tx => tx.employeeContactChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } }));
      await settle(error instanceof EmailEntryDeliveryError ? error.outcome : 'unknown');
      throw new ServiceUnavailableException({ code: 'delivery_unavailable' });
    }
    await settle('accepted');
    const ready = await this.store.transaction(tx => tx.employeeContactChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { ready: true } }));
    if (ready.count !== 1) throw new BadRequestException('contact_challenge_superseded');
    return { challengeId: challenge.id, expiresIn: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)), retryAfterSeconds: 60 };
  }
}
