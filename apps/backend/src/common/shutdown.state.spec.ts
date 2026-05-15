import { setShuttingDown, isShuttingDown } from './shutdown.state';

describe('shutdown.state', () => {
  it('isShuttingDown returns false by default', () => {
    expect(isShuttingDown()).toBe(false);
  });

  it('setShuttingDown sets state to true', () => {
    setShuttingDown();
    expect(isShuttingDown()).toBe(true);
  });
});
