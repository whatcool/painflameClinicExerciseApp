import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { getLibraryExercise } from '../data/exerciseLibrary';
import type { PatientExercise } from '../db/exerciseList';
import type { DotColor } from '../db/tracking';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';
import { MONTH_NAMES } from '../utils/date';
import { ExerciseThumb } from './ExerciseThumb';
import { Icon, type IconName } from './Icon';
import { MonthCalendar } from './MonthCalendar';

type Props = {
  exercises: PatientExercise[];
  month: { year: number; monthIndex: number; dots: Map<string, DotColor>; today: string };
  onEditExercises: () => void;
  onOpenStreak: () => void;
};

const PAGE_COUNT = 2;

/** Swipeable pages on the dashboard: 1) today's exercise list, 2) this month's calendar. */
export function DashboardCarousel({ exercises, month, onEditExercises, onOpenStreak }: Props) {
  const styles = useStyles();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  const [page, setPage] = useState(0);

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) {
      setPage(Math.round(event.nativeEvent.contentOffset.x / width));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.viewport} onLayout={e => setSize(e.nativeEvent.layout)}>
        {width > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}>
            <Page
              width={width}
              height={height}
              title="Your exercises"
              action={{ icon: 'edit', label: 'Edit exercise list', onPress: onEditExercises }}>
              <ExercisesPage exercises={exercises} />
            </Page>
            <Page
              width={width}
              height={height}
              title={`${MONTH_NAMES[month.monthIndex]} ${month.year}`}
              action={{ icon: 'flame', label: 'Streak', onPress: onOpenStreak, caption: 'Streak' }}>
              <MonthCalendar
                year={month.year}
                monthIndex={month.monthIndex}
                dots={month.dots}
                today={month.today}
                compact
              />
            </Page>
          </ScrollView>
        )}
      </View>
      <View style={styles.dots}>
        {Array.from({ length: PAGE_COUNT }, (_, i) => (
          <View key={i} style={[styles.pageDot, i === page && styles.pageDotActive]} />
        ))}
      </View>
    </View>
  );
}

function Page({
  width,
  height,
  title,
  action,
  children,
}: {
  width: number;
  height: number;
  title: string;
  action: { icon: IconName; label: string; onPress: () => void; caption?: string };
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.page, { width, height }]}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{title}</Text>
        {/* Scrolls vertically when the content is taller than the card. */}
        <ScrollView
          nestedScrollEnabled
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator>
          {children}
        </ScrollView>
      </View>
      {/* Round button hanging off the card's bottom-right corner. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.label}
        onPress={action.onPress}
        style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
        <Icon
          name={action.icon}
          size={action.caption ? 20 : 22}
          color={colors.white}
          strokeWidth={2.2}
        />
        {action.caption ? <Text style={styles.actionCaption}>{action.caption}</Text> : null}
      </Pressable>
    </View>
  );
}

function ExercisesPage({ exercises }: { exercises: PatientExercise[] }) {
  const styles = useStyles();
  if (exercises.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No exercises yet</Text>
        <Text style={styles.emptyText}>Tap the edit button to create your exercise list.</Text>
      </View>
    );
  }
  return (
    <>
      {exercises.map((item, index) => {
        const exercise = getLibraryExercise(item.exerciseId);
        if (!exercise) {
          return null;
        }
        return (
          <View key={`${item.exerciseId}-${index}`} style={styles.row}>
            <Text style={styles.position}>{index + 1}</Text>
            <ExerciseThumb exercise={exercise} size={40} />
            <View style={styles.rowInfo}>
              <Text style={styles.name} numberOfLines={1}>
                {exercise.name}
              </Text>
              <Text style={styles.counts}>
                Reps {item.reps} · Hold {item.holdSeconds}s
              </Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

const ACTION_SIZE = 56;
// Space under the button so its shadow isn't clipped by the page edge.
const SHADOW_ROOM = 6;

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    container: { flex: 1, minHeight: 240 },
    viewport: { flex: 1 },
    page: {
      // Room below/right of the card for the hanging action button.
      paddingBottom: ACTION_SIZE / 2 + SHADOW_ROOM,
      paddingHorizontal: 2,
    },
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    cardTitle: {
      fontSize: font.body,
      fontWeight: '700',
      color: colors.primary,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    cardContent: {
      paddingHorizontal: spacing.md,
      // Keep the last row clear of the action button.
      paddingBottom: ACTION_SIZE / 2 + spacing.sm,
    },
    action: {
      position: 'absolute',
      right: spacing.md,
      bottom: SHADOW_ROOM,
      width: ACTION_SIZE,
      height: ACTION_SIZE,
      borderRadius: ACTION_SIZE / 2,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
    },
    actionPressed: { opacity: 0.85 },
    actionCaption: { color: colors.white, fontSize: 10, fontWeight: '700', marginTop: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.primaryLight,
    },
    position: {
      minWidth: 24,
      textAlign: 'center',
      fontSize: font.body,
      fontWeight: '700',
      color: colors.primary,
    },
    rowInfo: { flex: 1 },
    name: { fontSize: font.body, fontWeight: '600', color: colors.text },
    counts: { fontSize: font.small - 1, color: colors.textMuted },
    empty: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
    emptyTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
    emptyText: { fontSize: font.small, color: colors.textMuted, textAlign: 'center' },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs },
    pageDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    pageDotActive: { backgroundColor: colors.primary, width: 20 },
  }),
);
