/**
 * Tab bar icons. NativeTabs only accepts image sources, so the Lucide icons used
 * everywhere else in the app are pre-rendered as template PNGs (1x/2x/3x) under
 * `assets/tabs/`. The selected state uses a heavier stroke of the same icon.
 * iOS and Android tint them from the tab bar `iconColor`.
 */
export const tabIcons = {
  house: { default: require('../../assets/tabs/house.png'), selected: require('../../assets/tabs/house-selected.png') },
  calendar: { default: require('../../assets/tabs/calendar.png'), selected: require('../../assets/tabs/calendar-selected.png') },
  grid: { default: require('../../assets/tabs/layout-grid.png'), selected: require('../../assets/tabs/layout-grid-selected.png') },
  account: { default: require('../../assets/tabs/circle-user-round.png'), selected: require('../../assets/tabs/circle-user-round-selected.png') },
  sun: { default: require('../../assets/tabs/sun.png'), selected: require('../../assets/tabs/sun-selected.png') },
  users: { default: require('../../assets/tabs/users.png'), selected: require('../../assets/tabs/users-selected.png') },
} as const;
