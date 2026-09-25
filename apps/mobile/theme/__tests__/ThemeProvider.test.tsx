import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { useSawaaColors } from '../sawaa/useSawaaColors';
import { getSawaaColors } from '../sawaa/tokens';

let mockSystemScheme = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true, default: () => mockSystemScheme,
}));
jest.mock('@/hooks/queries/useBranding', () => ({ useBranding: () => ({ data: null }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(() => Promise.resolve()),
}));
function Probe() {
  const { scheme, setThemeMode } = useTheme();
  const colors = useSawaaColors();
  return <>
    <Text testID="scheme">{scheme}</Text><Text testID="ink">{colors.ink[900]}</Text>
    {(['light', 'dark', 'system'] as const).map(mode => (
      <Pressable key={mode} accessibilityRole="button" accessibilityLabel={mode} onPress={() => setThemeMode(mode)}><Text>{mode}</Text></Pressable>
    ))}
  </>;
}
const App = () => <ThemeProvider language="en"><Probe /></ThemeProvider>;

describe('ThemeProvider appearance preferences', () => {
  beforeEach(() => { jest.clearAllMocks(); mockSystemScheme = 'light'; });
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
  });
});
