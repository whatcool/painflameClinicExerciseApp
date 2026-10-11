import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { CLINIC_LOGIN_EMAIL } from '../config/supabase';
import { createClinicClient, type Client } from '../services/supabase';
import { font, radius, spacing } from '../theme';
import { makeStyles, useTheme } from '../theme/ThemeContext';

/** A signed-in clinic connection for one action. Call end() when the action is finished. */
export type ClinicSession = { client: Client; end: () => void };

type Gate = (action: (clinic: ClinicSession) => void) => void;

const TherapistGateContext = createContext<Gate | null>(null);

// Safety net: a forgotten clinic session signs itself out after this long.
const MAX_SESSION_MS = 15 * 60 * 1000;

/**
 * Wraps therapist-only actions. The therapist types the shared clinic password; the app
 * signs in to the clinic account just for this action and signs out again afterwards.
 * Every action asks again; the password is never stored.
 */
export function TherapistGateProvider({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<((clinic: ClinicSession) => void) | null>(null);

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

  const submit = async () => {
    if (!password || busy) {
      return;
    }
    setBusy(true);
    const client = createClinicClient();
    const { data, error: signInError } = await client.auth.signInWithPassword({
      email: CLINIC_LOGIN_EMAIL,
      password,
    });
    setBusy(false);
    if (signInError || data.user?.app_metadata?.role !== 'clinic') {
      const offline = signInError && /network|fetch/i.test(signInError.message);
      setError(offline ? 'No internet connection' : 'Incorrect password');
      client.auth.signOut().catch(() => {});
      return;
    }
    let ended = false;
    const timer = setTimeout(() => end(), MAX_SESSION_MS);
    const end = () => {
      if (!ended) {
        ended = true;
        clearTimeout(timer);
        client.auth.signOut().catch(() => {});
      }
    };
    const action = pending.current;
    close();
    action?.({ client, end });
  };

  return (
    <TherapistGateContext.Provider value={requireTherapist}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Clinic password</Text>
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
              <Button title="Continue" onPress={submit} loading={busy} style={styles.flex} />
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

// Hands a clinic session from one screen to the next (sessions can't go in route params).
let handedOff: ClinicSession | null = null;

export function handOffClinic(session: ClinicSession) {
  handedOff?.end();
  handedOff = session;
}

/** Takes the session handed to this screen, if any (only once). */
export function takeHandedOffClinic() {
  const session = handedOff;
  handedOff = null;
  return session;
}

/** Holds a clinic session for a screen and always ends it when the screen closes. */
export function useClinicSession(initial?: ClinicSession | null) {
  const [session, setSession] = useState<ClinicSession | null>(initial ?? null);
  const ref = useRef<ClinicSession | null>(null);
  ref.current = session;
  useEffect(() => () => ref.current?.end(), []);
  const end = useCallback(() => {
    ref.current?.end();
    setSession(null);
  }, []);
  return { clinic: session, setClinic: setSession, endClinic: end };
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
