import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { PanResponder } from 'react-native';
import type { GestureResponderEvent, PanResponderGestureState } from 'react-native';

const mockPush = jest.fn();
let mockPanResponderConfig: Parameters<typeof PanResponder.create>[0] | null = null;
const realPanResponderCreate = PanResponder.create.bind(PanResponder);
let mockDir: { locale: string; isRTL: boolean; row: 'row' | 'row-reverse'; textAlign: 'left' | 'right'; writingDirection: 'ltr' | 'rtl' } = { locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', writingDirection: 'rtl' };
let mockReduceMotion = false;

const createGestureResponderEvent = (): GestureResponderEvent => (
  // The carousel never reads responder-event fields; only PanResponderGestureState drives behavior.
  { nativeEvent: {} } as unknown as GestureResponderEvent
);

const createGestureState = (dx: number, dy: number): PanResponderGestureState => ({
  stateID: 1,
  moveX: dx,
  moveY: dy,
  x0: 0,
  y0: 0,
  dx,
  dy,
  vx: 0,
  vy: 0,
  numberActiveTouches: 1,
  _accountsForMovesUpTo: 0,
});

const getMoveShouldSetPanResponder = () => {
  const callback = mockPanResponderConfig?.onMoveShouldSetPanResponder;
  if (!callback) throw new Error('Expected PanResponder move callback to be configured');
  return callback;
};

const getPanResponderRelease = () => {
  const callback = mockPanResponderConfig?.onPanResponderRelease;
  if (!callback) throw new Error('Expected PanResponder release callback to be configured');
  return callback;
};

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: { current?: number; total?: number }) => key === 'home.mobileCardPage' ? `Card ${values?.current} of ${values?.total}` : key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => mockDir }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => mockReduceMotion }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: (props: Record<string, unknown>) => {
  const { View } = require('react-native');
  return <View {...props} />;
} }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => {
  const { Pressable, View } = require('react-native');
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{children}</Pressable>
    : <View>{children}</View>;
} }));
import { HomeCardsCarousel } from '../HomeCardsCarousel';
import type { PublicMobileHomeCard } from '@/services/mobile-home-cards';

const card = (overrides: Partial<PublicMobileHomeCard> = {}): PublicMobileHomeCard => ({
  id: 'one', titleAr: 'عنوان عربي', titleEn: null, descriptionAr: 'وصف عربي', descriptionEn: null,
  imageUrl: null, imageAltAr: null, imageAltEn: null, destination: null, ...overrides,
});

describe('HomeCardsCarousel', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReduceMotion = false;
    mockDir = { locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', writingDirection: 'rtl' };
    jest.spyOn(PanResponder, 'create').mockImplementation((config) => {
      mockPanResponderConfig = config;
      return realPanResponderCreate(config);
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('collapses completely when no published cards are available', () => {
    const screen = render(<HomeCardsCarousel cards={[]} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('renders one card and falls back from missing English text to Arabic', () => {
    const screen = render(<HomeCardsCarousel cards={[card()]} />);
    expect(screen.getByText('عنوان عربي')).toBeTruthy();
    expect(screen.getByText('وصف عربي')).toBeTruthy();
    expect(screen.getByTestId('home-cards-viewport').props.style.width).toBe('100%');
  });

  it('renders several cards with English text and English direction', () => {
    mockDir = { locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' };
    const screen = render(<HomeCardsCarousel cards={[
      card({ id: 'one', titleEn: 'First', descriptionEn: 'First description' }),
      card({ id: 'two', titleAr: 'ثان', titleEn: null, descriptionEn: null }),
    ]} />);
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('First description')).toBeTruthy();
    expect(screen.queryByText('ثان')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Card 2 of 2' }));
    expect(screen.getByText('ثان')).toBeTruthy();
    expect(screen.getByText('وصف عربي')).toBeTruthy();
    expect(screen.getByTestId('home-cards-viewport')).toBeTruthy();
  });

  it('keeps card text visible when its image fails', () => {
    const screen = render(<HomeCardsCarousel cards={[card({ imageUrl: 'https://cdn.example/image.png', imageAltAr: 'صورة توضيحية' })]} />);
    const image = screen.getByLabelText('صورة توضيحية');
    const scrim = screen.getByTestId('home-card-scrim');
    expect(image.props.resizeMode).toBe('cover');
    expect(image.props.style.position).toBe('absolute');
    expect(scrim.props.start).toEqual({ x: 0, y: 0 });
    expect(scrim.props.end).toEqual({ x: 1, y: 1 });
    expect(Number.parseInt(scrim.props.colors[0].slice(-2), 16) / 255).toBeLessThanOrEqual(0.03);
    expect(screen.getByText('عنوان عربي').props.numberOfLines).toBeUndefined();
    expect(screen.getByText('وصف عربي').props.numberOfLines).toBeUndefined();
    fireEvent(image, 'error');
    expect(screen.getByText('عنوان عربي')).toBeTruthy();
    expect(screen.queryByLabelText('صورة توضيحية')).toBeNull();
    expect(screen.queryByTestId('home-card-scrim')).toBeNull();
  });

  it.each([
    ['CLINICS', '/public-list/clinics', '/(client)/clinics'],
    ['SERVICES', '/explore', '/(client)/(tabs)/explore'],
    ['SPECIALISTS', '/public-list/therapists', '/(client)/therapists'],
    ['PACKAGES', '/public-list/packages', '/(client)/packages'],
    ['PROGRAMS', '/public-list/programs', '/(client)/groups'],
  ] as const)('routes %s only to approved guest and client destinations', (destination, guestRoute, clientRoute) => {
    const screen = render(<HomeCardsCarousel cards={[card({ destination })]} signedIn={false} />);
    fireEvent.press(screen.getByRole('button', { name: 'عنوان عربي' }));
    expect(mockPush).toHaveBeenLastCalledWith(guestRoute);
    screen.rerender(<HomeCardsCarousel cards={[card({ destination })]} signedIn />);
    fireEvent.press(screen.getByRole('button', { name: 'عنوان عربي' }));
    expect(mockPush).toHaveBeenLastCalledWith(clientRoute);
  });

  it('does not make a card without a destination look or act like a button', () => {
    const screen = render(<HomeCardsCarousel cards={[card()]} signedIn />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('عنوان عربي')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('exposes the full card content through the destination button label without repeating the title', () => {
    const screen = render(<HomeCardsCarousel cards={[card({
      destination: 'CLINICS',
      imageUrl: 'https://cdn.example/image.png',
      imageAltAr: 'عنوان عربي',
    })]} />);
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('عنوان عربي. وصف عربي');

    screen.rerender(<HomeCardsCarousel cards={[card({
      destination: 'CLINICS',
      imageUrl: 'https://cdn.example/image.png',
      imageAltAr: 'صورة توضيحية',
    })]} />);
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('عنوان عربي. وصف عربي. صورة توضيحية');
  });

  it('shows accessible pagination targets and switches cards when a dot is selected', () => {
    const screen = render(<HomeCardsCarousel cards={[
      card({ id: 'one', titleAr: 'الأولى' }),
      card({ id: 'two', titleAr: 'الثانية' }),
    ]} />);
    const secondPage = screen.getByRole('button', { name: 'Card 2 of 2' });
    expect(secondPage.props.accessibilityState).toEqual({ selected: false });
    expect(secondPage.props.style).toEqual(expect.objectContaining({ width: 44, height: 44 }));
    fireEvent.press(secondPage);
    expect(screen.getByText('الثانية')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Card 2 of 2' }).props.accessibilityState).toEqual({ selected: true });
  });

  it.each([
    ['Arabic next swipes right', true, 76, 'الثانية'],
    ['English next swipes left', false, -76, 'Second'],
  ] as const)('%s and ignores vertical motion without triggering card navigation', (_name, isRTL, dx, expectedTitle) => {
    mockDir = isRTL
      ? { locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', writingDirection: 'rtl' }
      : { locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' };
    const screen = render(<HomeCardsCarousel cards={[
      card({ id: 'one', titleAr: 'الأولى', titleEn: 'First', destination: 'CLINICS' }),
      card({ id: 'two', titleAr: 'الثانية', titleEn: 'Second', destination: 'PACKAGES' }),
    ]} />);
    const event = createGestureResponderEvent();
    const canClaim = getMoveShouldSetPanResponder();
    expect(canClaim(event, createGestureState(8, 70))).toBe(false);
    expect(canClaim(event, createGestureState(dx, 4))).toBe(true);
    act(() => getPanResponderRelease()(event, createGestureState(dx, 4)));
    expect(screen.getByText(expectedTitle)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('clamps pagination at the first and last cards and switches immediately with reduced motion', () => {
    mockReduceMotion = true;
    const screen = render(<HomeCardsCarousel cards={[
      card({ id: 'one', titleAr: 'الأولى' }),
      card({ id: 'two', titleAr: 'الثانية' }),
    ]} />);
    act(() => getPanResponderRelease()(createGestureResponderEvent(), createGestureState(-80, 0)));
    expect(screen.getByText('الأولى')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Card 2 of 2' }));
    expect(screen.getByText('الثانية')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Card 2 of 2' }).props.accessibilityState).toEqual({ selected: true });
  });

  it('keeps the latest target when swipe events arrive rapidly', () => {
    const screen = render(<HomeCardsCarousel cards={[
      card({ id: 'one', titleAr: 'الأولى' }),
      card({ id: 'two', titleAr: 'الثانية' }),
      card({ id: 'three', titleAr: 'الثالثة' }),
    ]} />);
    act(() => {
      getPanResponderRelease()(createGestureResponderEvent(), createGestureState(80, 0));
      getPanResponderRelease()(createGestureResponderEvent(), createGestureState(80, 0));
    });
    expect(screen.getByText('الثالثة')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Card 3 of 3' }).props.accessibilityState).toEqual({ selected: true });
  });
});
