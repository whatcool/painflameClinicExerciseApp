import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';

type Props = TextInputProps & { label: string; error?: string };

export function TextField({ label, error, style, ...inputProps }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...inputProps}
        style={[styles.input, !!error && styles.inputError, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.input, styles.readOnly]}>
        <Text style={styles.readOnlyText}>{value}</Text>
      </View>
    </View>
  );
}

export const useFieldStyles = makeStyles(colors =>
  StyleSheet.create({
    label: { fontSize: font.small, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    error: { color: colors.danger, fontSize: font.small, marginTop: spacing.xs },
  }),
);

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    wrapper: { marginBottom: spacing.md },
    label: { fontSize: font.small, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: font.body,
      color: colors.text,
      minHeight: 52,
    },
    inputError: { borderColor: colors.danger },
    error: { color: colors.danger, fontSize: font.small, marginTop: spacing.xs },
    readOnly: { backgroundColor: colors.primaryLight, justifyContent: 'center' },
    readOnlyText: { fontSize: font.body, color: colors.textMuted },
  }),
);
