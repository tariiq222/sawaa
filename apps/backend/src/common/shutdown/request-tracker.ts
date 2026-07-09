export interface RequestResponseLifecycle {
  on(event: 'finish' | 'close', listener: () => void): unknown;
}

/**
 * Counts requests accepted by the HTTP server until each response completes.
 * Node emits both `finish` and `close` for a normal response, so completion
 * must be idempotent to avoid reporting a negative in-flight count.
 */
export class InFlightRequestTracker {
  private activeRequests = 0;

  get count(): number {
    return this.activeRequests;
  }

  track(response: RequestResponseLifecycle): void {
    this.activeRequests++;

    let completed = false;
    const complete = () => {
      if (completed) return;
      completed = true;
      this.activeRequests--;
    };

    response.on('finish', complete);
    response.on('close', complete);
  }
}
