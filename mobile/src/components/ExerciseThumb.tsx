import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { getThumbnail, type LibraryExercise } from '../data/exerciseLibrary';
import { radius } from '../theme';
import { makeStyles } from '../theme/ThemeContext';

/** The exercise's thumbnail image, or its initials until the clinic adds images. */
export function ExerciseThumb({ exercise, size = 56 }: { exercise: LibraryExercise; size?: number }) {
  const styles = useStyles();
  const source = getThumbnail(exercise);
  const box = { width: size, height: size };
  if (source) {
    return <Image source={source} style={[styles.box, box]} />;
  }
  const initials = exercise.name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.box, styles.placeholder, box]}>
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    box: { borderRadius: radius.sm, backgroundColor: colors.primaryLight },
    placeholder: { alignItems: 'center', justifyContent: 'center' },
    initials: { color: colors.primary, fontWeight: '700' },
  }),
);
