import { EventEmitter } from 'node:events';
import { InFlightRequestTracker } from './request-tracker';

describe('InFlightRequestTracker', () => {
  it('decrements a completed request once when finish is followed by close', () => {
    const tracker = new InFlightRequestTracker();
    const response = new EventEmitter();

    tracker.track(response);
    expect(tracker.count).toBe(1);

    response.emit('finish');
    response.emit('close');

    expect(tracker.count).toBe(0);
  });

  it('keeps another request in flight after a completed request closes', () => {
    const tracker = new InFlightRequestTracker();
    const completedResponse = new EventEmitter();
    const activeResponse = new EventEmitter();

    tracker.track(completedResponse);
    tracker.track(activeResponse);
    completedResponse.emit('finish');
    completedResponse.emit('close');

    expect(tracker.count).toBe(1);
  });
});
