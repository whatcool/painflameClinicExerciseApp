import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DotColor } from '../db/tracking';
import { font, spacing, type Colors } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { daysInMonth, toDayKey } from '../utils/date';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dotColor(colors: Colors, dot: Exclude<DotColor, null>) {
  return { red: colors.dotRed, green: colors.dotGreen, orange: colors.dotOrange }[dot];
}

type Props = {
  year: number;
  monthIndex: number;
  dots: Map<string, DotColor>;
  today: string;
  compact?: boolean;
};

/** Month grid with a coloured dot under each day. Used on Tracking and the dashboard. */
export function MonthCalendar({ year, monthIndex, dots, today, compact }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  // Leading blanks for the weekday of the 1st, then each day, padded to full weeks.
  const leading = new Date(year, monthIndex, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth(year, monthIndex) }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return (
    <View>
      <View style={styles.week}>
        {WEEKDAYS.map(day => (
          <Text key={day} style={styles.weekday}>
            {day}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          const key = day ? toDayKey(new Date(year, monthIndex, day)) : null;
          const dot = key ? dots.get(key) : null;
          return (
            <View key={i} style={[styles.cell, compact && styles.cellCompact]}>
              {day !== null && (
                <>
                  <Text
                    style={[
                      styles.dayNumber,
                      compact && styles.dayCompact,
                      key === today && styles.today,
                    ]}>
                    {day}
                  </Text>
                  <View style={[styles.dot, dot ? { backgroundColor: dotColor(colors, dot) } : null]} />
                </>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    week: { flexDirection: 'row' },
    weekday: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontSize: font.small - 2,
      color: colors.textMuted,
      fontWeight: '600',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: spacing.sm },
    cellCompact: { paddingVertical: 3 },
    dayNumber: { fontSize: font.body, color: colors.text },
    dayCompact: { fontSize: font.small },
    today: { color: colors.primary, fontWeight: '800', textDecorationLine: 'underline' },
    dot: { width: 8, height: 8, borderRadius: 4, marginTop: 3 },
  }),
);
