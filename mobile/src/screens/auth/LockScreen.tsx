import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { unlockWithFingerprint } from '../../security/biometrics';
import { PIN_LENGTH } from '../../security/pin';
import { font, spacing } from '../../theme';
import { makeStyles } from '../../theme/ThemeContext';
import { digitsOnly, firstName } from '../../utils/validation';

/** Shown on app open when fingerprint unlock is on. Falls back to the PIN. */
export function LockScreen() {
  const styles = useStyles();
  const { unlock, unlockWithPin, logout } = useAuth();
  const user = useCurrentUser();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const tryFingerprint = useCallback(async () => {
    if (await unlockWithFingerprint(user.id)) {
      unlock();
    }
  }, [user.id, unlock]);

  useEffect(() => {
    tryFingerprint();
  }, [tryFingerprint]);

  const submitPin = async () => {
    if (pin.length !== PIN_LENGTH) {
      setError(`Enter your ${PIN_LENGTH}-digit PIN`);
      return;
    }
    setBusy(true);
    const ok = await unlockWithPin(pin);
    setBusy(false);
    if (ok) {
      unlock();
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <Logo width={200} />
      <View style={styles.avatar}>
        <Avatar uri={user.photoUrl} size={96} />
      </View>
      <Text style={styles.name}>Hello, {firstName(user.fullName)}</Text>
      <Text style={styles.subtitle}>Enter your PIN to continue</Text>
      <TextField
        label="PIN"
        value={pin}
        onChangeText={text => {
          setPin(digitsOnly(text, PIN_LENGTH));
          setError('');
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        error={error}
        onSubmitEditing={submitPin}
        style={styles.pin}
      />
      <Button title="Unlock" onPress={submitPin} loading={busy} />
      <Button
        title="Use fingerprint"
        variant="secondary"
        onPress={tryFingerprint}
        style={styles.secondary}
      />
      <Pressable onPress={logout} hitSlop={10} style={styles.switch}>
        <Text style={styles.switchText}>Not you? Log in with another account</Text>
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
    pin: { textAlign: 'center', letterSpacing: 8 },
    secondary: { marginTop: spacing.sm },
    switch: { marginTop: spacing.lg, alignItems: 'center' },
    switchText: { color: colors.primary, fontSize: font.body },
  }),
);
