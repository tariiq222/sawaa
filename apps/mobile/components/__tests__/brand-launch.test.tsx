import { act, render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';

import { BrandLaunch } from '@/components/BrandLaunch';

let mockPathname = '/';
let mockReduceMotion = false;

jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => mockReduceMotion }));

const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

describe('BrandLaunch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPathname = '/';
    mockReduceMotion = false;
    jest.mocked(SplashScreen.hideAsync).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides the native splash as soon as the overlay mounts', () => {
    render(<BrandLaunch />);
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('keeps covering the bootstrap route until the first screen is resolved', () => {
    const view = render(<BrandLaunch />);
    advance(2000);
    expect(view.queryByTestId('brand-launch')).not.toBeNull();

    mockPathname = '/home';
    view.rerender(<BrandLaunch />);
    advance(1000);
    expect(view.queryByTestId('brand-launch')).toBeNull();
  });

  it('finishes the logo reveal before leaving even when the route is ready at once', () => {
    mockPathname = '/home';
    const view = render(<BrandLaunch />);
    advance(400);
    expect(view.queryByTestId('brand-launch')).not.toBeNull();
    advance(1200);
    expect(view.queryByTestId('brand-launch')).toBeNull();
  });

  it('leaves after the wait cap when the first screen never resolves', () => {
    const view = render(<BrandLaunch />);
    advance(3900);
    expect(view.queryByTestId('brand-launch')).not.toBeNull();
    // The cap flips state first; the exit starts on the following render.
    advance(200);
    advance(600);
    expect(view.queryByTestId('brand-launch')).toBeNull();
  });

  it('only fades when reduce motion is enabled', () => {
    mockReduceMotion = true;
    mockPathname = '/home';
    const view = render(<BrandLaunch />);
    advance(300);
    expect(view.queryByTestId('brand-launch')).toBeNull();
  });
});
