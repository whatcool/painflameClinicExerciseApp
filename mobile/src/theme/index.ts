// Brand colours are taken from the Painflame Clinic logo (deep indigo + grey).
export const lightColors = {
  primary: '#2B1E6B',
  primaryDark: '#1D1450',
  primaryLight: '#ECE9F7',
  header: '#2B1E6B',
  grey: '#4A4A4A',
  background: '#F6F5FA',
  surface: '#FFFFFF',
  text: '#1F1D2B',
  textMuted: '#6B6880',
  border: '#DAD6E8',
  danger: '#C62828',
  white: '#FFFFFF',
  overlay: 'rgba(20, 14, 50, 0.45)',
  streakBackground: '#FFF3E0',
  avatar: '#C9CCD6',
  // Tracking calendar dots
  dotRed: '#E53935',
  dotGreen: '#43A047',
  dotOrange: '#FB8C00',
};

export type Colors = typeof lightColors;

// Dark mode: the brand indigo is too dark to read on a dark background, so `primary`
// becomes a lighter indigo; white text on it stays readable for buttons.
export const darkColors: Colors = {
  primary: '#7C6CF0',
  primaryDark: '#5B4BD1',
  primaryLight: '#2A2542',
  header: '#1C1830',
  grey: '#B5B2C3',
  background: '#121019',
  surface: '#1D1A28',
  text: '#ECEAF4',
  textMuted: '#A7A3B8',
  border: '#36314D',
  danger: '#EF5350',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.6)',
  streakBackground: '#3A2A14',
  avatar: '#4A4560',
  dotRed: '#EF5350',
  dotGreen: '#66BB6A',
  dotOrange: '#FFA726',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Font sizes are deliberately large: many patients are older adults.
export const font = {
  small: 15,
  body: 18,
  large: 21,
  title: 26,
  hero: 30,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
};
