import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { font, radius, spacing } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { formatLongDate, fromDayKey, toDayKey } from '../utils/date';
import { useFieldStyles } from './TextField';

type Props = {
  label: string;
  value: string | null; // YYYY-MM-DD
  onChange: (day: string) => void;
  maximumDate?: Date;
  error?: string;
  placeholder?: string;
};

export function DateField({ label, value, onChange, maximumDate, error, placeholder }: Props) {
  const styles = useStyles();
  const fieldStyles = useFieldStyles();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.input, !!error && styles.inputError]}>
        <Text style={[styles.text, !value && styles.placeholder]}>
          {value ? formatLongDate(value) : placeholder ?? 'Select date'}
        </Text>
      </Pressable>
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
      {open && (
        <DateTimePicker
          mode="date"
          value={value ? fromDayKey(value) : maximumDate ?? new Date()}
          maximumDate={maximumDate}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type === 'set' && date) {
              onChange(toDayKey(date));
            }
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    wrapper: { marginBottom: spacing.md },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      minHeight: 52,
      justifyContent: 'center',
    },
    inputError: { borderColor: colors.danger },
    text: { fontSize: font.body, color: colors.text },
    placeholder: { color: colors.textMuted },
  }),
);
