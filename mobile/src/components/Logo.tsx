import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { radius, spacing } from '../theme';
import { useTheme } from '../theme/ThemeContext';

const logo = require('../assets/images/logo.png');

// The source logo is 330 x 150 with dark text on a transparent background,
// so in dark mode it sits on a light pill to stay readable.
export function Logo({ width = 240 }: { width?: number }) {
  const { isDark } = useTheme();
  const image = (
    <Image source={logo} style={[styles.logo, { width, height: (width * 150) / 330 }]} />
  );
  return isDark ? <View style={styles.pill}>{image}</View> : image;
}

const styles = StyleSheet.create({
  logo: { resizeMode: 'contain', alignSelf: 'center' },
  pill: {
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
