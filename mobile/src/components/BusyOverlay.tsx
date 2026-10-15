import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { radius, spacing } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { ExerciseDoodle } from './ExerciseDoodle';

/** Full-screen "please wait" with the exercise doodle, for slow work like uploads. */
export function BusyOverlay({ visible, message }: { visible: boolean; message: string }) {
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <ExerciseDoodle message={message} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      width: '100%',
      maxWidth: 360,
    },
  }),
);
