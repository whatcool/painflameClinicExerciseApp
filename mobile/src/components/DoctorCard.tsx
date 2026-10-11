import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Doctor } from '../db/doctors';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { formatMonthYear } from '../utils/date';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

type Props = { doctor: Doctor | null; onChange: () => void };

export function DoctorCard({ doctor, onChange }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!doctor) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onChange}
        style={[styles.card, styles.placeholder]}>
        <View style={styles.plusCircle}>
          <Icon name="plus" color={colors.primary} size={28} />
        </View>
        <Text style={styles.placeholderText}>Add doctor</Text>
      </Pressable>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.caption}>Your doctor</Text>
      <View style={styles.row}>
        <Avatar uri={doctor.photoUrl} size={76} />
        <View style={styles.info}>
          <Text style={styles.name}>{doctor.fullName}</Text>
          <Text style={styles.detail}>{doctor.contact}</Text>
          <Text style={styles.detail}>
            At Painflame since {formatMonthYear(doctor.startMonth, doctor.startYear)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change doctor"
          onPress={onChange}
          hitSlop={12}
          style={styles.edit}>
          <Icon name="edit" color={colors.primary} size={20} />
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    caption: {
      fontSize: font.small,
      color: colors.textMuted,
      marginBottom: spacing.sm,
      fontWeight: '600',
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    info: { flex: 1, marginLeft: spacing.md },
    name: { fontSize: font.large, fontWeight: '700', color: colors.text },
    detail: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
    edit: { padding: spacing.sm },
    placeholder: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      borderStyle: 'dashed',
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    plusCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    placeholderText: {
      marginTop: spacing.sm,
      fontSize: font.large,
      color: colors.primary,
      fontWeight: '600',
    },
  }),
);
