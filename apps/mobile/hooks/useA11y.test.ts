import { AccessibilityInfo } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { useIncreasedContrast } from './useA11y';

describe('useIncreasedContrast', () => {
  it('uses the iOS darker system colors setting and change event', async () => {
    const isDarkerSystemColorsEnabled = jest.fn().mockResolvedValue(true);
    const remove = jest.fn();
    const addEventListener = jest.fn().mockReturnValue({ remove });
    const accessibilityInfo = AccessibilityInfo as unknown as {
      isDarkerSystemColorsEnabled: () => Promise<boolean>;
      addEventListener: (event: string, listener: (enabled: boolean) => void) => { remove: () => void };
    };
    const checkSpy = jest
      .spyOn(accessibilityInfo, 'isDarkerSystemColorsEnabled')
      .mockImplementation(isDarkerSystemColorsEnabled);
    const listenerSpy = jest
      .spyOn(accessibilityInfo, 'addEventListener')
      .mockImplementation(addEventListener);

    const { result, unmount } = renderHook(() => useIncreasedContrast());

    await act(async () => {
      await Promise.resolve();
    });

    expect(checkSpy).toHaveBeenCalledTimes(1);
    expect(listenerSpy).toHaveBeenCalledWith('darkerSystemColorsChanged', expect.any(Function));
    expect(result.current).toBe(true);

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    checkSpy.mockRestore();
    listenerSpy.mockRestore();
  });
});
