import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BusyOverlay } from '../../components/BusyOverlay';
import { ExitConfirm } from '../../components/ExitConfirm';
import { GoogleButton } from '../../components/GoogleButton';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { isGoogleConfigured, isSupabaseConfigured } from '../../config/supabase';
import { authErrorMessage, useAuth } from '../../context/AuthContext';
import { font, radius, spacing } from '../../theme';
import { makeStyles } from '../../theme/ThemeContext';

export function LoginScreen() {
  const styles = useStyles();
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    const result = await signInWithGoogle();
    setBusy(false);
    if (!result.ok) {
      setError(authErrorMessage(result) ?? '');
    }
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <ExitConfirm />
      <BusyOverlay visible={busy} message="Signing you in…" />
      <Animated.View entering={FadeInDown.duration(500)}>
        <Logo width={260} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(120).duration(500)}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.subtitle}>Sign in to see your exercises</Text>
      </Animated.View>

      {(!isSupabaseConfigured() || !isGoogleConfigured()) && (
        <Text style={styles.error}>
          The app is not fully set up yet: fill in src/config/supabase.ts.
        </Text>
      )}

      <Animated.View entering={FadeInDown.delay(240).duration(500)}>
        <GoogleButton onPress={submit} loading={busy} />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.info}>
          <Text style={styles.infoTitle}>First time here?</Text>
          <Text style={styles.infoText}>
            After choosing your Google account, enter your mobile number and the 8-digit code
            from Painflame Clinic. You only do this once.
          </Text>
        </View>
      </Animated.View>
    </Screen>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    content: { paddingTop: spacing.xl },
    title: {
      fontSize: font.hero,
      fontWeight: '700',
      color: colors.primary,
      marginTop: spacing.lg,
    },
    subtitle: { fontSize: font.body, color: colors.textMuted, marginBottom: spacing.xl },
    error: { color: colors.danger, fontSize: font.body, marginTop: spacing.md },
    info: {
      marginTop: spacing.xl,
      padding: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
    },
    infoTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
    infoText: { fontSize: font.small, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 21 },
  }),
);
