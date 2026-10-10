import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  large,
  style,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        large && styles.large,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.white} />
      ) : (
        <Text
          style={[
            styles.text,
            large && styles.largeText,
            variant === 'secondary' && styles.secondaryText,
          ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    base: {
      minHeight: 52,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    large: { minHeight: 72, borderRadius: radius.lg },
    primary: { backgroundColor: colors.primary },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    danger: { backgroundColor: colors.danger },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
    text: { color: colors.white, fontSize: font.body, fontWeight: '600' },
    largeText: { fontSize: font.title, fontWeight: '700', letterSpacing: 1 },
    secondaryText: { color: colors.primary },
  }),
);
