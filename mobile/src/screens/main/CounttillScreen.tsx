import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Video, { type ReactVideoSource } from 'react-native-video';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Icon } from '../../components/Icon';
import { TourOverlay, type Rect, type TourStep } from '../../components/TourOverlay';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { getLibraryExercise, type LibraryExercise } from '../../data/exerciseLibrary';
import { getExerciseList, type PatientExercise } from '../../db/exerciseList';
import { recordExerciseDay } from '../../db/tracking';
import { setCounttillTourDone } from '../../db/users';
import type { ScreenProps } from '../../navigation/types';
import {
  countdown,
  Interrupted,
  isVoiceAvailable,
  keepScreenOn,
  playSound,
  sleep,
  speak,
  stopAll,
  waitForGo,
} from '../../services/coach';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { toDayKey } from '../../utils/date';

type ViewRef = React.ComponentRef<typeof View>;
type Phase = 'tour' | 'tips' | 'running';
type Step = 'idle' | 'speaking' | 'listening' | 'holding' | 'relax';
type PlanItem = { item: PatientExercise; exercise: LibraryExercise };

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The guided exercise session ("Counttill"). No navbar here: nothing to distract. */
export function CounttillScreen({ navigation }: ScreenProps<'Counttill'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useCurrentUser();
  const { refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const plan = useMemo<PlanItem[]>(
    () =>
      getExerciseList(user.id).flatMap(item => {
        const exercise = getLibraryExercise(item.exerciseId);
        return exercise ? [{ item, exercise }] : [];
      }),
    [user.id],
  );

  const [phase, setPhase] = useState<Phase>(user.counttillTourDone ? 'tips' : 'tour');
  const [index, setIndex] = useState(0);
  const [rep, setRep] = useState(1);
  const [counter, setCounter] = useState(plan[0]?.item.holdSeconds ?? 0);
  const [step, setStep] = useState<Step>('idle');
  const [voiceOn, setVoiceOn] = useState(true);

  const sessionAbort = useRef<AbortController | null>(null);
  const exerciseAbort = useRef<AbortController | null>(null);
  const tapGo = useRef<(() => void) | null>(null);
  const progress = useRef({ repsDone: 0, completed: 0, skipped: 0 });
  const finished = useRef(false);

  // Areas highlighted by the tour.
  const rootRef = useRef<ViewRef>(null);
  const nameRef = useRef<ViewRef>(null);
  const videoRef = useRef<ViewRef>(null);
  const imagesRef = useRef<ViewRef>(null);
  const counterRef = useRef<ViewRef>(null);
  const statusRef = useRef<ViewRef>(null);
  const skipRef = useRef<ViewRef>(null);
  const endRef = useRef<ViewRef>(null);

  const current = plan[index];

  /** Saves today's result for the Tracking calendar (nothing if no rep was done). */
  const recordProgress = useCallback(() => {
    const { repsDone, completed } = progress.current;
    if (repsDone > 0) {
      recordExerciseDay(
        user.id,
        toDayKey(new Date()),
        completed === plan.length ? 'complete' : 'partial',
      );
    }
  }, [user.id, plan.length]);

  // The session itself: runs once the tips pop-up is confirmed.
  useEffect(() => {
    if (phase !== 'running') {
      return;
    }
    const session = new AbortController();
    sessionAbort.current = session;

    (async () => {
      keepScreenOn(true);
      let voice = await isVoiceAvailable().catch(() => false);
      setVoiceOn(voice);
      const voiceUnavailable = () => {
        voice = false;
        setVoiceOn(false);
      };

      for (let i = 0; i < plan.length && !session.signal.aborted; i++) {
        const { item, exercise } = plan[i];
        const ctrl = new AbortController();
        exerciseAbort.current = ctrl;
        const signal = ctrl.signal;
        setIndex(i);
        setRep(1);
        setCounter(item.holdSeconds);
        try {
          setStep('speaking');
          await speak(
            `Let's start ${exercise.name}. ${count(item.reps, 'rep')}, holding each for ${count(
              item.holdSeconds,
              'second',
            )}.`,
            signal,
          );
          for (let r = 1; r <= item.reps; r++) {
            setRep(r);
            setCounter(item.holdSeconds);
            setStep('speaking');
            const hint =
              i === 0 && r === 1 && voice ? ' Say go, or start, when you are ready.' : '';
            await speak(`Start rep ${r}.${hint}`, signal);

            setStep('listening');
            const tapped = new Promise<void>(resolve => {
              tapGo.current = resolve;
            });
            await waitForGo(signal, tapped, voice, voiceUnavailable);
            tapGo.current = null;

            setStep('holding');
            playSound('whistle', signal).catch(() => {});
            await countdown(item.holdSeconds, signal, setCounter);
            progress.current.repsDone++;

            setStep('relax');
            playSound('bell', signal).catch(() => {});
            await sleep(1500, signal);
          }
          progress.current.completed++;
          if (i < plan.length - 1) {
            setStep('speaking');
            await speak("Well done! Now let's move to the next exercise.", signal);
          }
        } catch (error) {
          if (!(error instanceof Interrupted)) {
            throw error;
          }
          stopAll();
          if (session.signal.aborted) {
            return; // End was pressed
          }
          progress.current.skipped++; // Skip was pressed: go on to the next exercise
        }
      }

      if (!session.signal.aborted) {
        finished.current = true;
        recordProgress();
        navigation.replace('SessionComplete', {
          completed: progress.current.completed,
          total: plan.length,
        });
      }
    })().catch(error => console.warn('Exercise session failed', error));

    return () => {
      session.abort();
      exerciseAbort.current?.abort();
      stopAll();
      keepScreenOn(false);
    };
  }, [phase, plan, navigation, recordProgress]);

  const endNow = useCallback(() => {
    finished.current = true;
    sessionAbort.current?.abort();
    exerciseAbort.current?.abort();
    stopAll();
    recordProgress();
  }, [recordProgress]);

  const confirmEnd = useCallback(
    (leave: () => void) => {
      if (phase !== 'running') {
        finished.current = true;
        leave();
        return;
      }
      Alert.alert('End exercises?', 'Your progress so far will be saved.', [
        { text: 'Keep going', style: 'cancel' },
        {
          text: 'End',
          style: 'destructive',
          onPress: () => {
            endNow();
            leave();
          },
        },
      ]);
    },
    [phase, endNow],
  );

  // Android back button behaves like End.
  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        if (finished.current) {
          return;
        }
        event.preventDefault();
        confirmEnd(() => navigation.dispatch(event.data.action));
      }),
    [navigation, confirmEnd],
  );

  const skip = () => {
    if (phase === 'running') {
      exerciseAbort.current?.abort();
    }
  };

  const finishTour = () => {
    setCounttillTourDone(user.id);
    refreshUser();
    setPhase('tips');
  };

  const measure = (ref: React.RefObject<ViewRef | null>) => () =>
    new Promise<Rect | null>(resolve => {
      const node = ref.current;
      const root = rootRef.current;
      if (!node || !root) {
        resolve(null);
        return;
      }
      node.measureLayout(
        root,
        (x, y, width, height) => resolve({ x, y, width, height }),
        () => resolve(null),
      );
    });

  const tourSteps: TourStep[] = [
    {
      title: 'Your exercise',
      text: 'The name of the exercise you are doing now. Exercises follow the order in your list.',
      measure: measure(nameRef),
    },
    {
      title: 'Watch the video',
      text: 'A short video shows the correct way to do the exercise.',
      measure: measure(videoRef),
    },
    {
      title: 'Check your posture',
      text: 'These pictures show the important positions of the exercise.',
      measure: measure(imagesRef),
    },
    {
      title: 'The hold counter',
      text: 'After you start a rep, a whistle blows and this counts down the seconds to hold. A soft bell rings when the time is over.',
      measure: measure(counterRef),
    },
    {
      title: 'Start with your voice',
      text: 'The app will say “Start rep 1”. When you are ready, say “Go” or “Start”. If speaking does not work, tap the counter instead.',
      measure: measure(statusRef),
    },
    {
      title: 'Skip',
      text: 'Moves on to the next exercise if you cannot do this one today.',
      measure: measure(skipRef),
    },
    {
      title: 'End',
      text: 'Stops the exercises and takes you back home. What you have done is saved.',
      measure: measure(endRef),
    },
  ];

  if (!current) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>You have no exercises in your list yet.</Text>
          <Button title="Back to home" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const { item, exercise } = current;
  const photos = exercise.images.slice(0, 3);
  const listening = phase === 'running' && step === 'listening';
  const holding = step === 'holding';

  const status = (() => {
    if (phase !== 'running') {
      return { icon: 'mic' as const, text: 'Say “Go” or “Start” to begin each rep' };
    }
    switch (step) {
      case 'listening':
        return voiceOn
          ? { icon: 'mic' as const, text: 'Say “Go” or “Start”  ·  or tap the counter' }
          : { icon: 'play' as const, text: 'Tap the counter to start' };
      case 'holding':
        return { icon: 'flame' as const, text: 'Hold… keep breathing normally' };
      case 'relax':
        return { icon: 'check' as const, text: 'Relax' };
      default:
        return { icon: 'play' as const, text: 'Listen…' };
    }
  })();

  return (
    // Insets are applied inside the root so the tour's dimming also covers the system bars.
    <SafeAreaView style={styles.safe} edges={[]}>
      <View
        ref={rootRef}
        style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
        collapsable={false}>
        <View style={styles.topRow}>
          <Text style={styles.progressText}>
            Exercise {index + 1} of {plan.length}
          </Text>
          <Text style={styles.progressText}>
            Rep {rep} of {item.reps}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${((index + 1) / plan.length) * 100}%` }]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View ref={nameRef} collapsable={false}>
            <Text style={styles.name}>{exercise.name}</Text>
          </View>

          <View ref={videoRef} collapsable={false} style={styles.video}>
            {exercise.video ? (
              <Video
                // Bundled require() assets are supported at runtime; the type doesn't say so.
                source={exercise.video as unknown as ReactVideoSource}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                repeat
                muted
              />
            ) : (
              <View style={styles.placeholder}>
                <Icon name="play" size={40} color={colors.textMuted} />
                <Text style={styles.placeholderText}>Video coming soon</Text>
              </View>
            )}
          </View>

          <View ref={imagesRef} collapsable={false} style={styles.images}>
            {[0, 1, 2].map(i =>
              photos[i] ? (
                <Image key={i} source={photos[i]} style={styles.image} />
              ) : (
                <View key={i} style={[styles.image, styles.placeholder]}>
                  {i === 0 ? (
                    <ExerciseThumb exercise={exercise} size={48} />
                  ) : (
                    <Icon name="image" size={28} color={colors.textMuted} />
                  )}
                </View>
              ),
            )}
          </View>

          <View style={styles.counterBlock}>
            <View ref={counterRef} collapsable={false}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={listening ? 'Start this rep' : `${counter} seconds`}
                onPress={() => listening && tapGo.current?.()}
                style={[
                  styles.counter,
                  listening && styles.counterListening,
                  holding && styles.counterHolding,
                ]}>
                <Text style={[styles.counterText, holding && styles.counterTextHolding]}>
                  {counter}
                </Text>
                <Text style={[styles.counterUnit, holding && styles.counterTextHolding]}>
                  seconds
                </Text>
              </Pressable>
            </View>
            <View ref={statusRef} collapsable={false} style={styles.status}>
              <Icon
                name={status.icon}
                size={22}
                color={listening ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.statusText, listening && styles.statusTextActive]}>
                {status.text}
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <View ref={skipRef} collapsable={false} style={styles.flex}>
            <Button title="Skip exercise" variant="secondary" onPress={skip} />
          </View>
          <View ref={endRef} collapsable={false} style={styles.flex}>
            <Button
              title="End"
              variant="danger"
              onPress={() => confirmEnd(() => navigation.popToTop())}
            />
          </View>
        </View>

        {phase === 'tour' && <TourOverlay steps={tourSteps} onDone={finishTour} />}
      </View>

      <Modal visible={phase === 'tips'} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Before you begin</Text>
            <Tip text="If your doctor has suggested it, a hot pack and a gentle oil massage on the painful area can help before exercising." />
            <Tip text="Try to do your exercises every day — 3 times a day if you can." />
            <Button title="Okay" onPress={() => setPhase('running')} style={styles.tipsButton} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Tip({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.tip}>
      <View style={styles.tipDot} />
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const COUNTER_SIZE = 168;

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    progressText: { fontSize: font.small, fontWeight: '700', color: colors.textMuted },
    progressTrack: {
      height: 6,
      marginHorizontal: spacing.md,
      marginTop: spacing.xs,
      borderRadius: 3,
      backgroundColor: colors.primaryLight,
      overflow: 'hidden',
    },
    progressFill: { height: 6, backgroundColor: colors.primary },
    content: { padding: spacing.md, gap: spacing.md },
    name: { fontSize: font.title, fontWeight: '800', color: colors.text, textAlign: 'center' },
    video: {
      aspectRatio: 16 / 9,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    placeholderText: { marginTop: spacing.xs, fontSize: font.small, color: colors.textMuted },
    images: { flexDirection: 'row', gap: spacing.sm },
    image: { flex: 1, aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden' },
    counterBlock: { alignItems: 'center', gap: spacing.sm },
    counter: {
      width: COUNTER_SIZE,
      height: COUNTER_SIZE,
      borderRadius: COUNTER_SIZE / 2,
      borderWidth: 6,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterListening: { borderColor: colors.primary },
    counterHolding: { borderColor: colors.primary, backgroundColor: colors.primary },
    counterText: { fontSize: 72, fontWeight: '800', color: colors.text, lineHeight: 80 },
    counterUnit: { fontSize: font.small, color: colors.textMuted, marginTop: -4 },
    counterTextHolding: { color: colors.white },
    status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.xs },
    statusText: { fontSize: font.body, color: colors.textMuted, flexShrink: 1 },
    statusTextActive: { color: colors.primary, fontWeight: '700' },
    bottomBar: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    emptyBox: { flex: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
    emptyText: { fontSize: font.body, color: colors.text, textAlign: 'center' },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    tipsCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
    tipsTitle: {
      fontSize: font.title,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.md,
    },
    tip: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    tipDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.dotOrange,
      marginTop: 8,
    },
    tipText: { flex: 1, fontSize: font.body, color: colors.text, lineHeight: 26 },
    tipsButton: { marginTop: spacing.sm },
  }),
);
