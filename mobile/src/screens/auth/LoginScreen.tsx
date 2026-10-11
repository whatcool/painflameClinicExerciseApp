import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { isSupabaseConfigured } from '../../config/supabase';
import { authErrorMessage, useAuth } from '../../context/AuthContext';
import type { ScreenProps } from '../../navigation/types';
import { PIN_LENGTH } from '../../security/pin';
import { font, spacing } from '../../theme';
import { makeStyles } from '../../theme/ThemeContext';
import { digitsOnly } from '../../utils/validation';

export function LoginScreen({ navigation }: ScreenProps<'Login'>) {
  const styles = useStyles();
  const { login } = useAuth();
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (mobile.length !== 10 || pin.length !== PIN_LENGTH) {
      setError(`Enter your 10-digit mobile number and ${PIN_LENGTH}-digit PIN`);
      return;
    }
    setBusy(true);
    setError('');
    const result = await login(mobile, pin);
    setBusy(false);
    if (!result.ok) {
      setError(authErrorMessage(result));
      setPin('');
    }
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <Logo width={260} />
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Log in to see your exercises</Text>
      {!isSupabaseConfigured() && (
        <Text style={styles.error}>
          The app is not connected to the server yet. Fill in src/config/supabase.ts.
        </Text>
      )}

      <TextField
        label="Mobile number"
        value={mobile}
        onChangeText={text => setMobile(digitsOnly(text, 10))}
        keyboardType="number-pad"
        placeholder="10-digit mobile number"
        maxLength={10}
      />
      <TextField
        label="PIN"
        value={pin}
        onChangeText={text => setPin(digitsOnly(text, PIN_LENGTH))}
        keyboardType="number-pad"
        secureTextEntry
        placeholder={`${PIN_LENGTH}-digit PIN`}
        maxLength={PIN_LENGTH}
        onSubmitEditing={submit}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Log in" onPress={submit} loading={busy} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>First time, or forgot PIN?</Text>
        <Pressable onPress={() => navigation.navigate('Activate')} hitSlop={10}>
          <Text style={styles.link}>Activate with clinic code</Text>
        </Pressable>
      </View>
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
    subtitle: { fontSize: font.body, color: colors.textMuted, marginBottom: spacing.lg },
    error: { color: colors.danger, fontSize: font.body, marginBottom: spacing.md },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg, gap: spacing.sm },
    footerText: { fontSize: font.body, color: colors.textMuted },
    link: { fontSize: font.body, color: colors.primary, fontWeight: '700' },
  }),
);
