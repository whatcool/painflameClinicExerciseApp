import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Gender } from '../db/users';
import { font, radius, spacing } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { useFieldStyles } from './TextField';

const OPTIONS: Gender[] = ['Male', 'Female', 'Other'];

type Props = { value: Gender | null; onChange: (gender: Gender) => void; error?: string };

export function GenderPicker({ value, onChange, error }: Props) {
  const styles = useStyles();
  const fieldStyles = useFieldStyles();
  return (
    <View style={styles.wrapper}>
      <Text style={fieldStyles.label}>Gender</Text>
      <View style={styles.row}>
        {OPTIONS.map(option => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option)}
              style={[styles.option, selected && styles.selected]}>
              <Text style={[styles.text, selected && styles.selectedText]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    wrapper: { marginBottom: spacing.md },
    row: { flexDirection: 'row', gap: spacing.sm },
    option: {
      flex: 1,
      minHeight: 52,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: colors.primary, borderColor: colors.primary },
    text: { fontSize: font.body, color: colors.text },
    selectedText: { color: colors.white, fontWeight: '600' },
  }),
);
