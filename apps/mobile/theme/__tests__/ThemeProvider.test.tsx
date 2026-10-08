import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { ImageBackground, Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { useSawaaColors } from '../sawaa/useSawaaColors';
import { getSawaaColors } from '../sawaa/tokens';
import { AquaBackground } from '../sawaa/AquaBackground';

let mockSystemScheme = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true, default: () => mockSystemScheme,
}));
jest.mock('@/hooks/queries/useBranding', () => ({ useBranding: () => ({ data: null }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()),
}));
function Probe() {
  const { scheme, isHydrated, setThemeMode } = useTheme();
  const colors = useSawaaColors();
  return <>
    <Text testID="scheme">{scheme}</Text><Text testID="ink">{colors.ink[900]}</Text>
    <Text testID="ready">{String(isHydrated)}</Text>
    {(['light', 'dark', 'system'] as const).map(mode => (
      <Pressable key={mode} accessibilityRole="button" accessibilityLabel={mode} onPress={() => setThemeMode(mode)}><Text>{mode}</Text></Pressable>
    ))}
  </>;
}
function Counter() {
  const [count, setCount] = React.useState(0);
  return <Pressable accessibilityRole="button" accessibilityLabel="Increment" onPress={() => setCount(value => value + 1)}>
    <Text testID="count">{count}</Text>
  </Pressable>;
}
const App = () => <ThemeProvider language="en"><AquaBackground><Probe /><Counter /></AquaBackground></ThemeProvider>;

describe('ThemeProvider appearance preferences', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSystemScheme = 'light'; });
  it('requests only the stored dark backdrop after preference hydration without resetting content', async () => {
    let resolve!: (value: string) => void;
    jest.mocked(AsyncStorage.getItem).mockReturnValue(new Promise(r => { resolve = r; }));
    const view = render(<App />);
    expect(screen.getByTestId('ready').props.children).toBe('false');
    expect(view.UNSAFE_queryByType(ImageBackground)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Increment' }));
    await act(async () => { resolve('dark'); });
    expect(screen.getByTestId('ready').props.children).toBe('true');
    expect(view.UNSAFE_getByType(ImageBackground).props.source).toEqual(require('../../assets/bg-aqua-dark.png'));
    expect(screen.getByTestId('count').props.children).toBe(1);
  });
  it.each([null, 'invalid'])('becomes ready with the system appearance when stored mode is %s', async storedMode => {
    mockSystemScheme = 'dark';
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(storedMode);
    const view = render(<App />);
    await act(async () => {});
    expect(screen.getByTestId('ready').props.children).toBe('true');
    expect(screen.getByTestId('scheme').props.children).toBe('dark');
    expect(view.UNSAFE_getByType(ImageBackground).props.source).toEqual(require('../../assets/bg-aqua-dark.png'));
  });
  it('becomes ready with the system backdrop if preference storage rejects', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('Storage unavailable'));
    const view = render(<App />);
    await act(async () => {});
    expect(screen.getByTestId('ready').props.children).toBe('true');
    expect(screen.getByTestId('scheme').props.children).toBe('light');
    expect(view.UNSAFE_getByType(ImageBackground).props.source).toEqual(require('../../assets/bg-aqua.png'));
  });
  it('keeps the default context ready for consumers outside the provider', () => {
    const view = render(<AquaBackground><Probe /></AquaBackground>);
    expect(screen.getByTestId('ready').props.children).toBe('true');
    expect(view.UNSAFE_getByType(ImageBackground).props.source).toEqual(require('../../assets/bg-aqua.png'));
  });
  it('hydrates persisted appearance and updates hook colors when toggled', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('dark');
    render(<App />);
    await act(async () => {});
    expect(screen.getByTestId('scheme').props.children).toBe('dark');
    expect(screen.getByTestId('ink').props.children).toBe(getSawaaColors('dark').ink[900]);
    fireEvent.press(screen.getByRole('button', { name: 'light' }));
    expect(screen.getByTestId('ink').props.children).toBe(getSawaaColors('light').ink[900]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('sawaa.themeMode', 'light');
    fireEvent.press(screen.getByRole('button', { name: 'system' }));
    mockSystemScheme = 'dark';
    screen.rerender(<App />);
    expect(screen.getByTestId('scheme').props.children).toBe('dark');
  });
  it('does not let late storage hydration overwrite a user selection', async () => {
    let resolve!: (value: string) => void;
    jest.mocked(AsyncStorage.getItem).mockReturnValue(new Promise(r => { resolve = r; }));
    render(<App />);
    fireEvent.press(screen.getByRole('button', { name: 'dark' }));
    await act(async () => { resolve('light'); });
    expect(screen.getByTestId('scheme').props.children).toBe('dark');
    expect(screen.getByTestId('ready').props.children).toBe('true');
    expect(screen.UNSAFE_getByType(ImageBackground).props.source).toEqual(require('../../assets/bg-aqua-dark.png'));
  });
});
