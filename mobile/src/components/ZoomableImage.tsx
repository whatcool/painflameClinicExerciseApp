import React, { useCallback, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  uri: string;
  width: number;
  height: number;
  /** Lets a surrounding pager stop swiping while the photo is zoomed in. */
  onZoomChange?: (zoomed: boolean) => void;
};

/** Photo with pinch-to-zoom, drag while zoomed, and double-tap to zoom in/out. */
export function ZoomableImage({ uri, width, height, onZoomChange }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);

  const reportZoom = useCallback(
    (value: boolean) => {
      setZoomed(value);
      onZoomChange?.(value);
    },
    [onZoomChange],
  );

  // Keep the photo's edges from being dragged past the screen edges.
  const clampX = (value: number, s: number) => {
    'worklet';
    const max = (width * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, value));
  };
  const clampY = (value: number, s: number) => {
    'worklet';
    const max = (height * (s - 1)) / 2;
    return Math.min(max, Math.max(-max, value));
  };

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedScale.value = 1;
    savedX.value = 0;
    savedY.value = 0;
    runOnJS(reportZoom)(false);
  };

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      scale.value = Math.min(
        MAX_SCALE,
        Math.max(1, savedScale.value * e.scale),
      );
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        reset();
      } else {
        savedScale.value = scale.value;
        x.value = withTiming(clampX(x.value, scale.value));
        y.value = withTiming(clampY(y.value, scale.value));
        savedX.value = clampX(x.value, scale.value);
        savedY.value = clampY(y.value, scale.value);
        runOnJS(reportZoom)(true);
      }
    });

  // Dragging only while zoomed in, so swiping between photos keeps working.
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate(e => {
      x.value = clampX(savedX.value + e.translationX, scale.value);
      y.value = clampY(savedY.value + e.translationY, scale.value);
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
        runOnJS(reportZoom)(true);
      }
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.View style={[styles.frame, { width, height }]}>
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
});
