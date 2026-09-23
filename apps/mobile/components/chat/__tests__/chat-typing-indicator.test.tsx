import React from 'react';
import { Animated } from 'react-native';
import { cleanup, render } from '@testing-library/react-native';
import { ChatTypingIndicator } from '../chat-typing-indicator';

let mockReduceMotion = true;

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: { colors: { surfaceHigh: '#E6E8EA', textMuted: '#64748B' } } }),
}));

jest.mock('@/hooks/useA11y', () => ({
  useReduceMotion: () => mockReduceMotion,
}));

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('ChatTypingIndicator motion accessibility', () => {
  it('does not start looping animation when reduced motion is enabled', () => {
    mockReduceMotion = true;
    const loop = jest.spyOn(Animated, 'loop');

    render(<ChatTypingIndicator />);

    expect(loop).not.toHaveBeenCalled();
  });

  it('stops all animation loops when unmounted', () => {
    mockReduceMotion = false;
    const stop = jest.fn();
    const loop = jest.spyOn(Animated, 'loop').mockImplementation(
      () => ({ start: jest.fn(), stop }) as unknown as ReturnType<typeof Animated.loop>,
    );

    const { unmount } = render(<ChatTypingIndicator />);

    expect(loop).toHaveBeenCalledTimes(3);
    unmount();
    expect(stop).toHaveBeenCalledTimes(3);
  });
});
