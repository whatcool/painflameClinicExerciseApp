import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { THERAPIST_PASSWORD } from '../config/therapist';
import { Button } from '../components/Button';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';

type Gate = (action: () => void) => void;

const TherapistGateContext = createContext<Gate | null>(null);

/**
 * Wraps therapist-only actions. Every call asks for the doctor's password again;
 * the unlock is never remembered.
 */
export function TherapistGateProvider({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const pending = useRef<(() => void) | null>(null);

  const requireTherapist = useCallback<Gate>(action => {
    pending.current = action;
    setPassword('');
    setError('');
    setVisible(true);
  }, []);

  const close = () => {
    pending.current = null;
    setPassword('');
    setVisible(false);
  };

  const submit = () => {
    if (password !== THERAPIST_PASSWORD) {
      setError('Incorrect password');
      return;
    }
    const action = pending.current;
    close();
    action?.();
  };

  return (
    <TherapistGateContext.Provider value={requireTherapist}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Doctor's password</Text>
            <Text style={styles.subtitle}>This action can only be done by the clinic.</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={text => {
                setPassword(text);
                setError('');
              }}
              secureTextEntry
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={submit}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.row}>
              <Button title="Cancel" variant="secondary" onPress={close} style={styles.flex} />
              <Button title="Continue" onPress={submit} style={styles.flex} />
            </View>
          </View>
        </View>
      </Modal>
    </TherapistGateContext.Provider>
  );
}

export function useTherapistGate() {
  const gate = useContext(TherapistGateContext);
  if (!gate) {
    throw new Error('useTherapistGate must be used inside TherapistGateProvider');
  }
  return gate;
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    title: { fontSize: font.large, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: font.small, color: colors.textMuted, marginTop: spacing.xs },
    input: {
      marginTop: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
      fontSize: font.body,
      color: colors.text,
    },
    error: { color: colors.danger, fontSize: font.small, marginTop: spacing.sm },
    row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    flex: { flex: 1 },
  }),
);
