import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ZoomMeetingStatus } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { ZoomMeetingWorker } from './zoom-meeting-worker';
import { ZOOM_MEETING_QUEUE } from './zoom-meeting-queue.service';
import { BullMqService } from '../../../infrastructure/queue/bull-mq.service';
import { CreateZoomMeetingHandler } from './create-zoom-meeting.handler';

describe('ZoomMeetingWorker', () => {
  let worker: ZoomMeetingWorker;
  let bullmq: { createWorker: jest.Mock };
  let createZoomMeeting: { execute: jest.Mock };
  let cls: { run: jest.Mock; set: jest.Mock };
  let workerCallback: (job: { data: { bookingId: string }; attemptsMade: number }) => Promise<void>;

  beforeEach(async () => {
    bullmq = {
      createWorker: jest.fn().mockImplementation((_queue, callback) => {
        workerCallback = callback;
      }),
    };
    createZoomMeeting = {
      execute: jest.fn().mockResolvedValue({
        id: 'book-1',
        zoomMeetingStatus: ZoomMeetingStatus.CREATED,
        zoomMeetingError: null,
      }),
    };
    cls = {
      run: jest.fn().mockImplementation((cb) => cb()),
      set: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ZoomMeetingWorker,
        { provide: BullMqService, useValue: bullmq },
        { provide: CreateZoomMeetingHandler, useValue: createZoomMeeting },
        { provide: ClsService, useValue: cls },
      ],
    }).compile();

    worker = module.get(ZoomMeetingWorker);
    worker.onModuleInit();
  });

  it('registers worker for the zoom-meeting-create queue on module init', () => {
    expect(bullmq.createWorker).toHaveBeenCalledWith(ZOOM_MEETING_QUEUE, expect.any(Function));
  });

  it('runs CreateZoomMeetingHandler with the job bookingId inside a CLS context', async () => {
    await workerCallback({ data: { bookingId: 'book-1' }, attemptsMade: 0 });
    expect(cls.run).toHaveBeenCalled();
    expect(cls.set).toHaveBeenCalledWith('systemContext', true);
    expect(createZoomMeeting.execute).toHaveBeenCalledWith({ bookingId: 'book-1' });
  });

  it('throws when the handler persisted FAILED status so BullMQ retries', async () => {
    createZoomMeeting.execute.mockResolvedValue({
      id: 'book-1',
      zoomMeetingStatus: ZoomMeetingStatus.FAILED,
      zoomMeetingError: 'Zoom API timeout',
    });
    await expect(
      workerCallback({ data: { bookingId: 'book-1' }, attemptsMade: 0 }),
    ).rejects.toThrow('Zoom API timeout');
  });

  it('swallows NotFoundException (booking deleted — retrying cannot help)', async () => {
    createZoomMeeting.execute.mockRejectedValue(new NotFoundException('Booking book-1 not found'));
    await expect(
      workerCallback({ data: { bookingId: 'book-1' }, attemptsMade: 0 }),
    ).resolves.toBeUndefined();
  });

  it('swallows BadRequestException (booking no longer ONLINE)', async () => {
    createZoomMeeting.execute.mockRejectedValue(
      new BadRequestException('Zoom meetings can only be created for ONLINE delivery bookings'),
    );
    await expect(
      workerCallback({ data: { bookingId: 'book-1' }, attemptsMade: 0 }),
    ).resolves.toBeUndefined();
  });

  it('rethrows unexpected errors so BullMQ retries', async () => {
    createZoomMeeting.execute.mockRejectedValue(new Error('db down'));
    await expect(
      workerCallback({ data: { bookingId: 'book-1' }, attemptsMade: 0 }),
    ).rejects.toThrow('db down');
  });
});
