import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { Icon } from './Icon';

/** "🔥 5 days" style pill showing the current streak. */
export function StreakBadge({ days }: { days: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View
      style={styles.badge}
      accessible
      accessibilityLabel={`Current streak: ${days} ${days === 1 ? 'day' : 'days'}`}>
      <Icon name="flame" size={26} color={colors.dotOrange} strokeWidth={2.2} />
      <View>
        <Text style={styles.count}>{days}</Text>
        <Text style={styles.label}>day streak</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.streakBackground,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    count: { fontSize: font.title, fontWeight: '800', color: colors.text, lineHeight: font.title + 2 },
    label: { fontSize: font.small - 2, color: colors.textMuted, fontWeight: '600' },
  }),
);
