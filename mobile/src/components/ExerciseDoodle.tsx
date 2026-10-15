import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line } from 'react-native-svg';
import { font, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A stick-figure pose in a 100 x 100 box (front view). Arm angles are degrees from
 * hanging straight down (0) to straight up (180). The figure moves between two poses.
 */
type Pose = {
  hipY: number;
  shoulderX: number;
  shoulderY: number;
  armLeft: number;
  armRight: number;
  footSpread: number; // horizontal distance of each foot from the centre
  kneeOut: number; // how far the knees bend outward
};

const STAND: Pose = {
  hipY: 56,
  shoulderX: 50,
  shoulderY: 34,
  armLeft: 15,
  armRight: 15,
  footSpread: 7,
  kneeOut: 0,
};

const EXERCISES: { name: string; from: Pose; to: Pose }[] = [
  {
    name: 'Jumping jacks',
    from: STAND,
    to: { ...STAND, armLeft: 160, armRight: 160, footSpread: 17 },
  },
  {
    name: 'Squats',
    from: { ...STAND, armLeft: 85, armRight: 85, footSpread: 11 },
    to: { ...STAND, hipY: 68, shoulderY: 47, armLeft: 85, armRight: 85, footSpread: 11, kneeOut: 9 },
  },
  {
    name: 'Side bends',
    from: { ...STAND, armLeft: 165, armRight: 10, footSpread: 10 },
    to: { ...STAND, shoulderX: 60, shoulderY: 36, armLeft: 150, armRight: 5, footSpread: 10 },
  },
];

const TIPS = [
  'Breathe normally while you hold a stretch.',
  'Move slowly and stop if you feel sharp pain.',
  'A little every day beats a lot once a week.',
  'Sit up tall: good posture protects your spine.',
  'Drink a glass of water after your exercises.',
  'Warm muscles stretch better: walk around first.',
];

const ARM = 18;
const GROUND = 92;

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  'worklet';
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    hipY: mix(a.hipY, b.hipY),
    shoulderX: mix(a.shoulderX, b.shoulderX),
    shoulderY: mix(a.shoulderY, b.shoulderY),
    armLeft: mix(a.armLeft, b.armLeft),
    armRight: mix(a.armRight, b.armRight),
    footSpread: mix(a.footSpread, b.footSpread),
    kneeOut: mix(a.kneeOut, b.kneeOut),
  };
}

/** A limb drawn from the current pose; `part` picks which line. */
function useLimb(
  progress: SharedValue<number>,
  from: Pose,
  to: Pose,
  part: 'torso' | 'armL' | 'armR' | 'thighL' | 'shinL' | 'thighR' | 'shinR',
) {
  return useAnimatedProps(() => {
    const p = lerpPose(from, to, progress.value);
    const hipX = 50;
    const kneeY = (p.hipY + GROUND) / 2;
    switch (part) {
      case 'torso':
        return { x1: hipX, y1: p.hipY, x2: p.shoulderX, y2: p.shoulderY };
      case 'armL': {
        const a = (p.armLeft * Math.PI) / 180;
        return {
          x1: p.shoulderX,
          y1: p.shoulderY,
          x2: p.shoulderX - Math.sin(a) * ARM,
          y2: p.shoulderY + Math.cos(a) * ARM,
        };
      }
      case 'armR': {
        const a = (p.armRight * Math.PI) / 180;
        return {
          x1: p.shoulderX,
          y1: p.shoulderY,
          x2: p.shoulderX + Math.sin(a) * ARM,
          y2: p.shoulderY + Math.cos(a) * ARM,
        };
      }
      case 'thighL':
        return { x1: hipX, y1: p.hipY, x2: hipX - p.footSpread / 2 - p.kneeOut, y2: kneeY };
      case 'shinL':
        return {
          x1: hipX - p.footSpread / 2 - p.kneeOut,
          y1: kneeY,
          x2: hipX - p.footSpread,
          y2: GROUND,
        };
      case 'thighR':
        return { x1: hipX, y1: p.hipY, x2: hipX + p.footSpread / 2 + p.kneeOut, y2: kneeY };
      case 'shinR':
        return {
          x1: hipX + p.footSpread / 2 + p.kneeOut,
          y1: kneeY,
          x2: hipX + p.footSpread,
          y2: GROUND,
        };
    }
  });
}

type Props = {
  /** Shown under the figure, e.g. "Signing you in…". */
  message?: string;
  size?: number;
  /** Show a rotating exercise tip under the message. */
  tips?: boolean;
};

/** Looping stick-figure exercise animation, used wherever the app waits. */
export function ExerciseDoodle({ message, size = 140, tips = true }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  // A different exercise each time a loader appears.
  const exercise = useMemo(() => EXERCISES[Math.floor(Math.random() * EXERCISES.length)], []);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [progress]);

  useEffect(() => {
    if (!tips) {
      return;
    }
    const timer = setInterval(() => setTip(t => (t + 1) % TIPS.length), 3500);
    return () => clearInterval(timer);
  }, [tips]);

  const { from, to } = exercise;
  const torso = useLimb(progress, from, to, 'torso');
  const armL = useLimb(progress, from, to, 'armL');
  const armR = useLimb(progress, from, to, 'armR');
  const thighL = useLimb(progress, from, to, 'thighL');
  const shinL = useLimb(progress, from, to, 'shinL');
  const thighR = useLimb(progress, from, to, 'thighR');
  const shinR = useLimb(progress, from, to, 'shinR');
  const head = useAnimatedProps(() => {
    const p = lerpPose(from, to, progress.value);
    // The head sits on the line from hip through shoulder.
    const dx = p.shoulderX - 50;
    const dy = p.shoulderY - p.hipY;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    return { cx: p.shoulderX + (dx / length) * 10, cy: p.shoulderY + (dy / length) * 10 };
  });

  const limb = {
    stroke: colors.primary,
    strokeWidth: 4.5,
    strokeLinecap: 'round' as const,
  };

  return (
    <View style={styles.wrapper} accessible accessibilityLabel={message ?? 'Loading'}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Ellipse cx={50} cy={GROUND + 2} rx={24} ry={3} fill={colors.border} />
        <AnimatedLine animatedProps={thighL} {...limb} />
        <AnimatedLine animatedProps={shinL} {...limb} />
        <AnimatedLine animatedProps={thighR} {...limb} />
        <AnimatedLine animatedProps={shinR} {...limb} />
        <AnimatedLine animatedProps={torso} {...limb} />
        <AnimatedLine animatedProps={armL} {...limb} />
        <AnimatedLine animatedProps={armR} {...limb} />
        <AnimatedCircle animatedProps={head} r={7} fill={colors.dotOrange} />
      </Svg>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {tips ? <Text style={styles.tip}>{TIPS[tip]}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    wrapper: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
    message: { fontSize: font.large, fontWeight: '700', color: colors.text, textAlign: 'center' },
    tip: { fontSize: font.small, color: colors.textMuted, textAlign: 'center', minHeight: 40 },
  }),
);
