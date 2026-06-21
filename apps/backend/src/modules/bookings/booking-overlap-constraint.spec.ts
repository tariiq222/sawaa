/**
 * Integration tests: booking state machine impossible sequences
 * ==============================================================
 * These tests verify that the state machine correctly blocks invalid
 * transitions — especially the sequences most likely to cause data corruption:
 *
 *   - CANCELLED → CONFIRMED (re-confirming a cancelled booking)
 *   - COMPLETED → CANCELLED (cancelling a completed session)
 *   - CONFIRMED reschedule preserves CONFIRMED status (no status regression)
 */

import { BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { assertTransition } from './booking-state-machine';
import { STAFF_TIME_BLOCKING_BOOKING_STATUSES } from './active-booking-statuses';

describe('Booking state machine — impossible sequences (integration)', () => {
  describe('terminal state protection', () => {
    it('CANCELLED booking cannot become CONFIRMED (CONFIRM transition)', () => {
      expect(() => assertTransition(BookingStatus.CANCELLED, 'CONFIRM')).toThrow(BadRequestException);
    });

    it('CANCELLED booking cannot become CONFIRMED (PAYMENT_CONFIRMED transition)', () => {
      expect(() => assertTransition(BookingStatus.CANCELLED, 'PAYMENT_CONFIRMED')).toThrow(BadRequestException);
    });

    it('CANCELLED booking cannot become CONFIRMED (REJECT_CANCEL transition)', () => {
      expect(() => assertTransition(BookingStatus.CANCELLED, 'REJECT_CANCEL')).toThrow(BadRequestException);
    });

    it('COMPLETED booking cannot be cancelled (CLIENT_DIRECT_CANCEL)', () => {
      expect(() => assertTransition(BookingStatus.COMPLETED, 'CLIENT_DIRECT_CANCEL')).toThrow(BadRequestException);
    });

    it('COMPLETED booking cannot be cancelled (DIRECT_CANCEL)', () => {
      expect(() => assertTransition(BookingStatus.COMPLETED, 'DIRECT_CANCEL')).toThrow(BadRequestException);
    });

    it('COMPLETED booking cannot be cancelled (APPROVE_CANCEL)', () => {
      expect(() => assertTransition(BookingStatus.COMPLETED, 'APPROVE_CANCEL')).toThrow(BadRequestException);
    });

    it('EXPIRED booking cannot be confirmed (CONFIRM)', () => {
      expect(() => assertTransition(BookingStatus.EXPIRED, 'CONFIRM')).toThrow(BadRequestException);
    });

    it('EXPIRED booking cannot be confirmed (PAYMENT_CONFIRMED)', () => {
      expect(() => assertTransition(BookingStatus.EXPIRED, 'PAYMENT_CONFIRMED')).toThrow(BadRequestException);
    });

    it('NO_SHOW booking cannot be cancelled', () => {
      expect(() => assertTransition(BookingStatus.NO_SHOW, 'DIRECT_CANCEL')).toThrow(BadRequestException);
    });

    it('NO_SHOW booking cannot be completed again', () => {
      expect(() => assertTransition(BookingStatus.NO_SHOW, 'COMPLETE')).toThrow(BadRequestException);
    });
  });

  describe('reschedule self-loop', () => {
    it('CONFIRMED reschedule returns CONFIRMED (status unchanged)', () => {
      const result = assertTransition(BookingStatus.CONFIRMED, 'RESCHEDULE');
      expect(result).toBe(BookingStatus.CONFIRMED);
    });

    it('PENDING reschedule returns PENDING (status unchanged)', () => {
      const result = assertTransition(BookingStatus.PENDING, 'RESCHEDULE');
      expect(result).toBe(BookingStatus.PENDING);
    });

    it('CANCELLED booking cannot be rescheduled', () => {
      expect(() => assertTransition(BookingStatus.CANCELLED, 'RESCHEDULE')).toThrow(BadRequestException);
    });

    it('COMPLETED booking cannot be rescheduled', () => {
      expect(() => assertTransition(BookingStatus.COMPLETED, 'RESCHEDULE')).toThrow(BadRequestException);
    });
  });

  describe('cancel request flow', () => {
    it('CANCEL_REQUESTED → APPROVE_CANCEL → CANCELLED (happy path)', () => {
      const result = assertTransition(BookingStatus.CANCEL_REQUESTED, 'APPROVE_CANCEL');
      expect(result).toBe(BookingStatus.CANCELLED);
    });

    it('CANCEL_REQUESTED → REJECT_CANCEL → CONFIRMED (staff reinstates booking)', () => {
      const result = assertTransition(BookingStatus.CANCEL_REQUESTED, 'REJECT_CANCEL');
      expect(result).toBe(BookingStatus.CONFIRMED);
    });

    it('CONFIRMED cannot go directly to APPROVE_CANCEL (must be CANCEL_REQUESTED first)', () => {
      expect(() => assertTransition(BookingStatus.CONFIRMED, 'APPROVE_CANCEL')).toThrow(BadRequestException);
    });

    it('PENDING cannot go directly to APPROVE_CANCEL', () => {
      expect(() => assertTransition(BookingStatus.PENDING, 'APPROVE_CANCEL')).toThrow(BadRequestException);
    });
  });

  describe('staff time blocking statuses', () => {
    it('does not include terminal statuses released from employee time', () => {
      expect(STAFF_TIME_BLOCKING_BOOKING_STATUSES).not.toContain(BookingStatus.CANCELLED);
      expect(STAFF_TIME_BLOCKING_BOOKING_STATUSES).not.toContain(BookingStatus.COMPLETED);
      expect(STAFF_TIME_BLOCKING_BOOKING_STATUSES).not.toContain(BookingStatus.NO_SHOW);
      expect(STAFF_TIME_BLOCKING_BOOKING_STATUSES).not.toContain(BookingStatus.EXPIRED);
    });
  });
});
