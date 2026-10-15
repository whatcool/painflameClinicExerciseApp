import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { BusyOverlay } from '../../components/BusyOverlay';
import { ExitConfirm } from '../../components/ExitConfirm';
import { GoogleButton } from '../../components/GoogleButton';
import { Icon } from '../../components/Icon';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { authErrorMessage, useAuth, useCurrentUser } from '../../context/AuthContext';
import { unlockWithFingerprint } from '../../security/biometrics';
import { font, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { firstName } from '../../utils/validation';

/** Shown on app open when fingerprint unlock is on. Falls back to the Google account. */
export function LockScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { unlock, unlockWithGoogle, logout } = useAuth();
  const user = useCurrentUser();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const tryFingerprint = useCallback(async () => {
    setError('');
    if (await unlockWithFingerprint(user.id)) {
      unlock();
    }
  }, [user.id, unlock]);

  useEffect(() => {
    tryFingerprint();
  }, [tryFingerprint]);

  const tryGoogle = async () => {
    setBusy(true);
    setError('');
    const result = await unlockWithGoogle();
    setBusy(false);
    if (!result.ok) {
      setError(authErrorMessage(result) ?? '');
    }
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <ExitConfirm />
      <BusyOverlay visible={busy} message="Checking your Google account…" />
      <Logo width={200} />
      <View style={styles.avatar}>
        <Avatar uri={user.photoUrl} size={96} />
      </View>
      <Text style={styles.name}>Hello, {firstName(user.fullName)}</Text>
      <Text style={styles.subtitle}>Unlock with your fingerprint</Text>

      <Button title="Use fingerprint" onPress={tryFingerprint} large style={styles.fingerprint} />
      <View style={styles.orRow}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>
      <GoogleButton title="Unlock with Google" onPress={tryGoogle} loading={busy} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={logout} hitSlop={10} style={styles.switch}>
        <Icon name="logout" size={18} color={colors.primary} />
        <Text style={styles.switchText}>Not you? Log out</Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    content: { paddingTop: spacing.xl },
    avatar: { alignItems: 'center', marginTop: spacing.md },
    name: {
      fontSize: font.title,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    subtitle: {
      fontSize: font.body,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    fingerprint: { marginBottom: spacing.md },
    orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    line: { flex: 1, height: 1, backgroundColor: colors.border },
    or: { color: colors.textMuted, fontSize: font.small },
    error: { color: colors.danger, fontSize: font.body, marginTop: spacing.md, textAlign: 'center' },
    switch: {
      marginTop: spacing.xl,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xs,
    },
    switchText: { color: colors.primary, fontSize: font.body },
  }),
);
