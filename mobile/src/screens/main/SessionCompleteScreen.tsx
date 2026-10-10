import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { useCurrentUser } from '../../context/AuthContext';
import { currentStreak, getExercisedDays, longestStreak } from '../../db/tracking';
import type { ScreenProps } from '../../navigation/types';
import { speak } from '../../services/coach';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { toDayKey } from '../../utils/date';
import { firstName } from '../../utils/validation';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** Shown after the last exercise. The navbar is visible again here. */
export function SessionCompleteScreen({ navigation, route }: ScreenProps<'SessionComplete'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useCurrentUser();
  const { completed, total } = route.params;
  const allDone = completed === total;

  const streaks = useMemo(() => {
    const exercised = getExercisedDays(user.id);
    return {
      current: currentStreak(exercised, toDayKey(new Date())),
      best: longestStreak(exercised),
    };
  }, [user.id]);

  useEffect(() => {
    const controller = new AbortController();
    speak(
      allDone
        ? "Well done! You have completed today's exercises."
        : 'Good effort! You finished your session.',
      controller.signal,
    ).catch(() => {});
    return () => controller.abort();
  }, [allDone]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Celebration />
        <Text style={styles.title}>{allDone ? 'Well done!' : 'Good effort!'}</Text>
        <Text style={styles.subtitle}>
          {firstName(user.fullName)}, you completed {completed} of {total}{' '}
          {total === 1 ? 'exercise' : 'exercises'} today.
        </Text>

        <View style={styles.streaks}>
          <View style={styles.streakCard}>
            <Icon name="flame" size={30} color={colors.dotOrange} strokeWidth={2.2} />
            <Text style={styles.streakValue}>{days(streaks.current)}</Text>
            <Text style={styles.streakLabel}>Current Streak</Text>
          </View>
          <View style={styles.streakCard}>
            <Icon name="check" size={30} color={colors.dotGreen} strokeWidth={2.5} />
            <Text style={styles.streakValue}>{days(streaks.best)}</Text>
            <Text style={styles.streakLabel}>Best Streak</Text>
          </View>
        </View>

        <Button title="View streak" onPress={() => navigation.navigate('Tracking')} />
      </View>
    </SafeAreaView>
  );
}

const PARTICLES = ['🎉', '⭐', '✨', '🎊', '⭐', '✨'];

/** Bouncing, wiggling trophy with sparkles floating up around it. */
function Celebration() {
  const styles = useStyles();
  const bounce = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;
  const float = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const animations = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(bounce, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bounce, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(wiggle, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: -1, duration: 500, useNativeDriver: true }),
          Animated.timing(wiggle, { toValue: 0, duration: 250, useNativeDriver: true }),
          Animated.delay(600),
        ]),
      ),
      ...float.map((value, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 280),
            Animated.timing(value, {
              toValue: 1,
              duration: 1800,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ),
      ),
    ];
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [bounce, wiggle, float]);

  return (
    <View style={styles.celebration} accessibilityLabel="Trophy" accessible>
      {float.map((value, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.particle,
            {
              left: `${8 + i * 15}%`,
              opacity: value.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [60, -70] }) },
                { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) },
              ],
            },
          ]}>
          {PARTICLES[i]}
        </Animated.Text>
      ))}
      <Animated.Text
        style={[
          styles.trophy,
          {
            transform: [
              { translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
              { scale: bounce.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
              {
                rotate: wiggle.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-10deg', '10deg'],
                }),
              },
            ],
          },
        ]}>
        🏆
      </Animated.Text>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
    celebration: { height: 190, alignItems: 'center', justifyContent: 'flex-end' },
    trophy: { fontSize: 110, lineHeight: 130 },
    particle: { position: 'absolute', bottom: 40, fontSize: 30 },
    title: { fontSize: font.hero + 4, fontWeight: '800', color: colors.primary, textAlign: 'center' },
    subtitle: { fontSize: font.body, color: colors.textMuted, textAlign: 'center' },
    streaks: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
    streakCard: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.lg,
    },
    streakValue: { fontSize: font.title, fontWeight: '800', color: colors.text },
    streakLabel: { fontSize: font.small, color: colors.textMuted, fontWeight: '600' },
  }),
);
