import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { formatMonthYear } from '../utils/date';
import { Icon } from './Icon';
import { useFieldStyles } from './TextField';

type Value = { month: number; year: number }; // month is 1-12

type Props = { label: string; value: Value; onChange: (value: Value) => void };

/** Month + year chooser with previous/next arrows. Cannot go past the current month. */
export function MonthYearField({ label, value, onChange }: Props) {
  const styles = useStyles();
  const fieldStyles = useFieldStyles();
  const { colors } = useTheme();
  const now = new Date();
  const atLatest =
    value.year > now.getFullYear() ||
    (value.year === now.getFullYear() && value.month >= now.getMonth() + 1);

  const shift = (delta: number) => {
    const index = value.year * 12 + (value.month - 1) + delta;
    onChange({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  };

  return (
    <View style={styles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel="Previous month"
          onPress={() => shift(-1)}
          style={styles.arrow}>
          <Icon name="chevronLeft" color={colors.primary} />
        </Pressable>
        <Text style={styles.value}>{formatMonthYear(value.month, value.year)}</Text>
        <Pressable
          accessibilityLabel="Next month"
          onPress={() => shift(1)}
          disabled={atLatest}
          style={[styles.arrow, atLatest && styles.disabled]}>
          <Icon name="chevronRight" color={colors.primary} />
        </Pressable>
      </View>
      <View style={styles.quick}>
        <Pressable onPress={() => shift(-12)} style={styles.chip}>
          <Text style={styles.chipText}>− 1 year</Text>
        </Pressable>
        <Pressable
          onPress={() => shift(12)}
          disabled={value.year + 1 > now.getFullYear()}
          style={[styles.chip, value.year + 1 > now.getFullYear() && styles.disabled]}>
          <Text style={styles.chipText}>+ 1 year</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    wrapper: { marginBottom: spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      minHeight: 52,
    },
    arrow: { padding: spacing.md },
    value: { flex: 1, textAlign: 'center', fontSize: font.body, color: colors.text },
    disabled: { opacity: 0.3 },
    quick: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.lg,
      backgroundColor: colors.primaryLight,
    },
    chipText: { color: colors.primary, fontSize: font.small, fontWeight: '600' },
  }),
);
