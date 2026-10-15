import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { font, radius, spacing } from '../theme';
import { makeStyles } from '../theme/ThemeContext';
import { Button } from './Button';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Two-button question: confirm is filled with the theme colour, cancel is outlined. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
}: Props) {
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Swallow taps on the card so only the backdrop closes the dialog. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.row}>
            <Button title={cancelLabel} variant="secondary" onPress={onCancel} style={styles.flex} />
            <Button title={confirmLabel} onPress={onConfirm} style={styles.flex} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
    title: { fontSize: font.large, fontWeight: '700', color: colors.text },
    message: { fontSize: font.body, color: colors.textMuted, marginTop: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    flex: { flex: 1 },
  }),
);
