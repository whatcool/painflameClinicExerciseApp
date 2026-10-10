import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { Icon } from './Icon';

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

/** Whole-number control with big − / + buttons. */
export function Stepper({ label, value, onChange, min = 1, max = 99 }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          style={[styles.button, value <= min && styles.disabled]}>
          <Icon name="minus" size={18} color={colors.primary} />
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable
          accessibilityLabel={`Increase ${label}`}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          style={[styles.button, value >= max && styles.disabled]}>
          <Icon name="plus" size={18} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    wrapper: { alignItems: 'center' },
    label: { fontSize: font.small - 2, color: colors.textMuted, marginBottom: 2 },
    row: { flexDirection: 'row', alignItems: 'center' },
    button: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    value: {
      minWidth: 36,
      textAlign: 'center',
      fontSize: font.body,
      fontWeight: '700',
      color: colors.text,
      marginHorizontal: spacing.xs,
    },
    disabled: { opacity: 0.35 },
  }),
);
