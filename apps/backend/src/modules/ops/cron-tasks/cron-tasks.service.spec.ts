import { CronTasksService, CRON_JOBS } from './cron-tasks.service';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { ConfigService } from '@nestjs/config';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { BookingAutocompleteCron } from './booking-autocomplete.cron';
import { BookingExpiryCron } from './booking-expiry.cron';
import { BookingNoShowCron } from './booking-noshow.cron';
import { AppointmentRemindersCron } from './appointment-reminders.cron';
import { GroupSessionAutomationCron } from './group-session-automation.cron';
import { RefreshTokenCleanupCron } from './refresh-token-cleanup.cron';
import { DbRowCountCron } from './db-row-count.cron';
import { RunOrphanAuditHandler } from '../orphan-audit/run-orphan-audit.handler';
import { ReconcileRefundsCron } from './reconcile-refunds.cron';
import { OutboxPublisherCron } from './outbox-publisher.cron';
import { AuthenticaBalanceCheckCron } from './authentica-balance-check.cron';
import * as Sentry from '@sentry/node';

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

describe('CronTasksService', () => {
  let service: CronTasksService;
  let mockBullMq: jest.Mocked<BullMqService>;
  let mockConfig: jest.Mocked<ConfigService>;
  let mockEmailFactory: jest.Mocked<EmailProviderFactory>;
  let mockQueue: { add: jest.Mock };
  let mockWorker: { on: jest.Mock; close: jest.Mock };
  let workerEventHandlers: Map<string, Function>;
  let mockBookingAutocomplete: jest.Mocked<BookingAutocompleteCron>;
  let mockBookingExpiry: jest.Mocked<BookingExpiryCron>;
  let mockBookingNoShow: jest.Mocked<BookingNoShowCron>;
  let mockAppointmentReminders: jest.Mocked<AppointmentRemindersCron>;
  let mockGroupSessionAutomation: jest.Mocked<GroupSessionAutomationCron>;
  let mockRefreshTokenCleanup: jest.Mocked<RefreshTokenCleanupCron>;
  let mockDbRowCount: jest.Mocked<DbRowCountCron>;
  let mockOrphanAudit: jest.Mocked<RunOrphanAuditHandler>;
  let mockReconcileRefunds: jest.Mocked<ReconcileRefundsCron>;
  let mockOutboxPublisher: jest.Mocked<OutboxPublisherCron>;
  let mockAuthenticaBalanceCheck: jest.Mocked<AuthenticaBalanceCheckCron>;

  beforeEach(() => {
    workerEventHandlers = new Map();
    mockQueue = { add: jest.fn().mockResolvedValue(undefined) };
    mockWorker = {
      on: jest.fn((event: string, handler: Function) => {
        workerEventHandlers.set(event, handler);
      }),
      close: jest.fn(),
    };

    mockBullMq = {
      getQueue: jest.fn().mockReturnValue(mockQueue),
      createWorker: jest.fn().mockReturnValue(mockWorker),
    } as unknown as jest.Mocked<BullMqService>;

    mockConfig = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<ConfigService>;

    mockEmailFactory = {
      resolve: jest.fn().mockResolvedValue({
        isAvailable: () => false,
        sendMail: jest.fn().mockResolvedValue(undefined),
      }),
    } as unknown as jest.Mocked<EmailProviderFactory>;

    mockBookingAutocomplete = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BookingAutocompleteCron>;
    mockBookingExpiry = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BookingExpiryCron>;
    mockBookingNoShow = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<BookingNoShowCron>;
    mockAppointmentReminders = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AppointmentRemindersCron>;
    mockGroupSessionAutomation = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GroupSessionAutomationCron>;
    mockRefreshTokenCleanup = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RefreshTokenCleanupCron>;
    mockDbRowCount = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DbRowCountCron>;
    mockOrphanAudit = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RunOrphanAuditHandler>;
    mockReconcileRefunds = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ReconcileRefundsCron>;
    mockOutboxPublisher = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OutboxPublisherCron>;
    mockAuthenticaBalanceCheck = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuthenticaBalanceCheckCron>;

    service = new CronTasksService(
      mockBullMq,
      mockConfig,
      mockEmailFactory,
      mockBookingAutocomplete,
      mockBookingExpiry,
      mockBookingNoShow,
      mockAppointmentReminders,
      mockGroupSessionAutomation,
      mockRefreshTokenCleanup,
      mockDbRowCount,
      mockOrphanAudit,
      mockReconcileRefunds,
      mockOutboxPublisher,
      mockAuthenticaBalanceCheck,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('calls registerRepeatingJobs and registerWorker', () => {
      const registerRepeatingJobsSpy = jest.spyOn(
        service as any,
        'registerRepeatingJobs',
      );
      const registerWorkerSpy = jest.spyOn(
        service as any,
        'registerWorker',
      );

      service.onModuleInit();

      expect(registerRepeatingJobsSpy).toHaveBeenCalledTimes(1);
      expect(registerWorkerSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('CRON_JOBS constants', () => {
    it('no longer carries dead SaaS subscription/billing crons', () => {
      const keys = Object.keys(CRON_JOBS);
      const values = Object.values(CRON_JOBS);
      const deadKeys = [
        'METER_USAGE',
        'CHARGE_DUE_SUBSCRIPTIONS',
        'ENFORCE_GRACE_PERIOD',
        'EXPIRE_TRIALS',
        'USAGE_WARNINGS',
        'PROCESS_SCHEDULED_PLAN_CHANGES',
        'DUNNING_RETRY',
      ];
      const deadValues = [
        'meter-usage',
        'charge-due-subscriptions',
        'enforce-grace-period',
        'expire-trials',
        'usage-warnings',
        'process-scheduled-plan-changes',
        'dunning-retry',
      ];
      for (const k of deadKeys) expect(keys).not.toContain(k);
      for (const v of deadValues) expect(values).not.toContain(v);
    });

    it('still defines every active cron', () => {
      const values = Object.values(CRON_JOBS);
      expect(values).toEqual(
        expect.arrayContaining([
          'booking-autocomplete',
          'booking-expiry',
          'booking-noshow',
          'appointment-reminders',
          'group-session-automation',
          'refresh-token-cleanup',
          'db-row-count',
          'orphan-audit',
          'reconcile-refunds',
          'outbox-publisher',
          'authentica-balance-check',
        ]),
      );
      expect(values).toHaveLength(11);
    });
  });

  describe('registerRepeatingJobs', () => {
    it('adds all jobs to the queue with correct cron patterns', () => {
      (service as any).registerRepeatingJobs();

      expect(mockBullMq.getQueue).toHaveBeenCalledWith('ops-cron');
      expect(mockQueue.add).toHaveBeenCalledTimes(11);

      const expectedJobs = [
        { name: CRON_JOBS.BOOKING_AUTOCOMPLETE, cron: '*/15 * * * *' },
        { name: CRON_JOBS.BOOKING_EXPIRY, cron: '*/10 * * * *' },
        { name: CRON_JOBS.BOOKING_NOSHOW, cron: '*/5 * * * *' },
        { name: CRON_JOBS.APPOINTMENT_REMINDERS, cron: '*/5 * * * *' },
        { name: CRON_JOBS.GROUP_SESSION_AUTOMATION, cron: '*/30 * * * *' },
        { name: CRON_JOBS.REFRESH_TOKEN_CLEANUP, cron: '0 3 * * *' },
        { name: CRON_JOBS.DB_ROW_COUNT, cron: '0 1 * * 0' },
        { name: CRON_JOBS.ORPHAN_AUDIT, cron: '0 2 * * 0' },
        { name: CRON_JOBS.RECONCILE_REFUNDS, cron: '*/15 * * * *' },
        { name: CRON_JOBS.OUTBOX_PUBLISHER, cron: '*/1 * * * *' },
        { name: CRON_JOBS.AUTHENTICA_BALANCE_CHECK, cron: '0 8 * * *' },
      ];

      for (const { name, cron } of expectedJobs) {
        expect(mockQueue.add).toHaveBeenCalledWith(
          name,
          {},
          expect.objectContaining({
            repeat: { pattern: cron },
            jobId: `repeat:${name}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 500 },
          }),
        );
      }
    });
  });

  describe('registerWorker', () => {
    const createJob = (name: string, attemptsMade = 0, opts = { attempts: 3 }) =>
      ({
        name,
        attemptsMade,
        opts,
        id: 'job-1',
      }) as any;

    it('handles booking-autocomplete', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.BOOKING_AUTOCOMPLETE));
      expect(mockBookingAutocomplete.execute).toHaveBeenCalledTimes(1);
    });

    it('handles booking-expiry', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.BOOKING_EXPIRY));
      expect(mockBookingExpiry.execute).toHaveBeenCalledTimes(1);
    });

    it('handles booking-noshow', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.BOOKING_NOSHOW));
      expect(mockBookingNoShow.execute).toHaveBeenCalledTimes(1);
    });

    it('handles appointment-reminders', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.APPOINTMENT_REMINDERS));
      expect(mockAppointmentReminders.execute).toHaveBeenCalledTimes(1);
    });

    it('handles group-session-automation', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.GROUP_SESSION_AUTOMATION));
      expect(mockGroupSessionAutomation.execute).toHaveBeenCalledTimes(1);
    });

    it('handles refresh-token-cleanup', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.REFRESH_TOKEN_CLEANUP));
      expect(mockRefreshTokenCleanup.execute).toHaveBeenCalledTimes(1);
    });

    it('handles db-row-count', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.DB_ROW_COUNT));
      expect(mockDbRowCount.execute).toHaveBeenCalledTimes(1);
    });

    it('handles orphan-audit', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.ORPHAN_AUDIT));
      expect(mockOrphanAudit.execute).toHaveBeenCalledTimes(1);
    });

    it('handles reconcile-refunds', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.RECONCILE_REFUNDS));
      expect(mockReconcileRefunds.execute).toHaveBeenCalledTimes(1);
    });

    it('handles outbox-publisher', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.OUTBOX_PUBLISHER));
      expect(mockOutboxPublisher.execute).toHaveBeenCalledTimes(1);
    });

    it('handles authentica-balance-check', async () => {
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.AUTHENTICA_BALANCE_CHECK));
      expect(mockAuthenticaBalanceCheck.execute).toHaveBeenCalledTimes(1);
    });

    it('handles unknown job name by logging warning', async () => {
      const loggerWarnSpy = jest.spyOn(
        (service as any).logger,
        'warn',
      );
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob('unknown-job'));
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Unknown cron job: unknown-job',
      );
    });

    it('logs success after job execution', async () => {
      const loggerLogSpy = jest.spyOn(
        (service as any).logger,
        'log',
      );
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await processor(createJob(CRON_JOBS.BOOKING_AUTOCOMPLETE));
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cron booking-autocomplete ok'),
      );
    });

    it('catches errors and re-throws', async () => {
      const error = new Error('boom');
      mockBookingAutocomplete.execute.mockRejectedValue(error);
      (service as any).registerWorker();
      const processor = (mockBullMq.createWorker as jest.Mock).mock.calls[0][1];
      await expect(processor(createJob(CRON_JOBS.BOOKING_AUTOCOMPLETE))).rejects.toThrow('boom');
    });
  });

  describe('worker failed event', () => {
    it('logs exhausted retries and calls Sentry.captureException', () => {
      (service as any).registerWorker();
      const failedHandler = workerEventHandlers.get('failed');
      expect(failedHandler).toBeDefined();

      const err = new Error('job failed');
      const job = {
        name: 'booking-autocomplete',
        id: 'job-1',
        attemptsMade: 3,
        opts: { attempts: 3 },
      } as any;

      const loggerErrorSpy = jest.spyOn(
        (service as any).logger,
        'error',
      );

      failedHandler!(job, err);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('EXHAUSTED retries'),
        err.stack,
      );
      expect(Sentry.captureException).toHaveBeenCalledWith(err, {
        tags: { cron: 'booking-autocomplete', jobId: 'job-1' },
      });
    });

    it('does NOT log/Sentry when attempts are not exhausted', () => {
      (service as any).registerWorker();
      const failedHandler = workerEventHandlers.get('failed');
      expect(failedHandler).toBeDefined();

      const err = new Error('job failed');
      const job = {
        name: 'booking-autocomplete',
        id: 'job-1',
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as any;

      const loggerErrorSpy = jest.spyOn(
        (service as any).logger,
        'error',
      );

      failedHandler!(job, err);

      expect(loggerErrorSpy).not.toHaveBeenCalled();
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('treats missing job as exhausted', () => {
      (service as any).registerWorker();
      const failedHandler = workerEventHandlers.get('failed');
      expect(failedHandler).toBeDefined();

      const err = new Error('job failed');
      const loggerErrorSpy = jest.spyOn(
        (service as any).logger,
        'error',
      );

      failedHandler!(null, err);

      expect(loggerErrorSpy).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(err, {
        tags: { cron: 'unknown', jobId: 'unknown' },
      });
    });
  });
});
