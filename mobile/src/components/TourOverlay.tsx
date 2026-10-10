import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { Button } from './Button';

export type TourStep = {
  title: string;
  text: string;
  /** Returns the highlighted area relative to the overlay's container, or null. */
  measure: () => Promise<Rect | null>;
};

export type Rect = { x: number; y: number; width: number; height: number };

const PAD = 6;

/** Step-by-step guide: dims the page, highlights one area and explains it. */
export function TourOverlay({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const styles = useStyles();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const screenWidth = box.width;
  const screenHeight = box.height;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    let active = true;
    setRect(null);
    step.measure().then(r => active && setRect(r));
    return () => {
      active = false;
    };
  }, [step]);

  const hole = rect && {
    x: Math.max(0, rect.x - PAD),
    y: Math.max(0, rect.y - PAD),
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
  // Put the explanation below the highlight, or above it when it's low on the screen.
  const cardBelow = !hole || hole.y + hole.height < screenHeight * 0.55;

  return (
    <View
      style={StyleSheet.absoluteFill}
      accessibilityViewIsModal
      onLayout={e => setBox(e.nativeEvent.layout)}>
      {hole ? (
        <>
          <View style={[styles.dim, { top: 0, left: 0, right: 0, height: hole.y }]} />
          <View
            style={[styles.dim, { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 }]}
          />
          <View
            style={[styles.dim, { top: hole.y, left: 0, width: hole.x, height: hole.height }]}
          />
          <View
            style={[
              styles.dim,
              {
                top: hole.y,
                left: hole.x + hole.width,
                width: Math.max(0, screenWidth - hole.x - hole.width),
                height: hole.height,
              },
            ]}
          />
          <View style={[styles.highlight, { top: hole.y, left: hole.x, width: hole.width, height: hole.height }]} />
        </>
      ) : (
        <View style={[styles.dim, StyleSheet.absoluteFill]} />
      )}

      <View
        style={[
          styles.card,
          hole && cardBelow ? { top: hole.y + hole.height + spacing.md } : null,
          hole && !cardBelow ? { bottom: screenHeight - hole.y + spacing.md } : null,
          !hole ? styles.cardCentered : null,
        ]}>
        <Text style={styles.counter}>
          Step {index + 1} of {steps.length}
        </Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.text}>{step.text}</Text>
        <View style={styles.row}>
          {!last && (
            <Button title="Skip tour" variant="secondary" onPress={onDone} style={styles.flex} />
          )}
          <Button
            title={last ? 'Got it' : 'Next'}
            onPress={() => (last ? onDone() : setIndex(index + 1))}
            style={styles.flex}
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.7)' },
    highlight: {
      position: 'absolute',
      borderWidth: 3,
      borderColor: colors.dotOrange,
      borderRadius: radius.md,
    },
    card: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
      elevation: 8,
    },
    cardCentered: { top: '35%' },
    counter: { fontSize: font.small - 2, color: colors.textMuted, fontWeight: '600' },
    title: { fontSize: font.large, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
    text: { fontSize: font.body, color: colors.text, marginTop: spacing.sm, lineHeight: 25 },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    flex: { flex: 1 },
  }),
);
