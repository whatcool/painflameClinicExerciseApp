import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../components/Icon';
import { MonthCalendar } from '../../components/MonthCalendar';
import { Screen } from '../../components/Screen';
import { useCurrentUser } from '../../context/AuthContext';
import {
  currentStreak,
  getExercisedDays,
  getMonthStatuses,
  longestStreak,
  signupDayOf,
  summariseMonth,
} from '../../db/tracking';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { MONTH_NAMES, toDayKey } from '../../utils/date';

export function TrackingScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useCurrentUser();
  const now = new Date();
  const [month, setMonth] = useState({ year: now.getFullYear(), index: now.getMonth() });
  const today = toDayKey(now);
  const signupDay = signupDayOf(user.createdAt);

  const summary = useMemo(
    () =>
      summariseMonth(
        month.year,
        month.index,
        getMonthStatuses(user.id, month.year, month.index),
        signupDay,
        today,
      ),
    [user.id, month, signupDay, today],
  );

  const streaks = useMemo(() => {
    const days = getExercisedDays(user.id);
    return { current: currentStreak(days, today), best: longestStreak(days) };
  }, [user.id, today]);

  const isCurrentMonth = month.year === now.getFullYear() && month.index === now.getMonth();
  const signupDate = new Date(user.createdAt);
  const isSignupMonth =
    month.year === signupDate.getFullYear() && month.index === signupDate.getMonth();

  const shift = (delta: number) => {
    const total = month.year * 12 + month.index + delta;
    setMonth({ year: Math.floor(total / 12), index: total % 12 });
  };

  return (
    <Screen>
      <View style={styles.metric}>
        <Text style={styles.metricValue}>
          {summary.exercisedDays} of {summary.countedDays} days
        </Text>
        <Text style={styles.metricLabel}>
          exercised in {MONTH_NAMES[month.index]}
          {isCurrentMonth ? ' so far' : ''}
        </Text>
      </View>

      <View style={styles.streakRow}>
        <View style={styles.streakCard}>
          <Icon name="flame" size={28} color={colors.dotOrange} strokeWidth={2.2} />
          <View>
            <Text style={styles.streakValue}>{plural(streaks.current)}</Text>
            <Text style={styles.streakLabel}>Current streak</Text>
          </View>
        </View>
        <View style={styles.streakCard}>
          <Icon name="check" size={28} color={colors.dotGreen} strokeWidth={2.5} />
          <View>
            <Text style={styles.streakValue}>{plural(streaks.best)}</Text>
            <Text style={styles.streakLabel}>Best streak</Text>
          </View>
        </View>
      </View>

      <View style={styles.calendar}>
        <View style={styles.monthRow}>
          <Pressable
            accessibilityLabel="Previous month"
            onPress={() => shift(-1)}
            disabled={isSignupMonth}
            style={[styles.arrow, isSignupMonth && styles.disabled]}>
            <Icon name="chevronLeft" color={colors.primary} />
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[month.index]} {month.year}
          </Text>
          <Pressable
            accessibilityLabel="Next month"
            onPress={() => shift(1)}
            disabled={isCurrentMonth}
            style={[styles.arrow, isCurrentMonth && styles.disabled]}>
            <Icon name="chevronRight" color={colors.primary} />
          </Pressable>
        </View>
        <MonthCalendar
          year={month.year}
          monthIndex={month.index}
          dots={summary.dots}
          today={today}
        />
      </View>

      <View style={styles.legend}>
        <LegendItem color={colors.dotGreen} label="All exercises done" />
        <LegendItem color={colors.dotOrange} label="Started, some exercises skipped" />
        <LegendItem color={colors.dotRed} label="No exercise done" />
      </View>
    </Screen>
  );
}

const plural = (days: number) => `${days} ${days === 1 ? 'day' : 'days'}`;

function LegendItem({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    metric: {
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    metricValue: { color: colors.white, fontSize: font.hero, fontWeight: '700' },
    metricLabel: { color: colors.primaryLight, fontSize: font.body, marginTop: spacing.xs },
    streakRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    streakCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    streakValue: { fontSize: font.large, fontWeight: '700', color: colors.text },
    streakLabel: { fontSize: font.small - 1, color: colors.textMuted },
    calendar: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    arrow: { padding: spacing.sm },
    disabled: { opacity: 0.25 },
    monthTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: font.large,
      fontWeight: '700',
      color: colors.text,
    },
    legend: { marginTop: spacing.lg, gap: spacing.sm },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    legendDot: { width: 14, height: 14, borderRadius: 7 },
    legendText: { fontSize: font.body, color: colors.text },
  }),
);
