import React, { useCallback, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BusyOverlay } from '../../components/BusyOverlay';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { authErrorMessage, useAuth } from '../../context/AuthContext';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { digitsOnly, isValidMobile } from '../../utils/validation';

const CODE_LENGTH = 8;

type Errors = Partial<Record<'mobile' | 'code' | 'consent' | 'form', string>>;

/**
 * Shown once, after the first Google sign-in: the patient enters their mobile number and the
 * one-time code from the clinic, which links this Google account to their record.
 */
export function LinkAccountScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { googleEmail, linkAccount, logout } = useAuth();
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  // Back = choose a different Google account.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        logout();
        return true;
      });
      return () => sub.remove();
    }, [logout]),
  );

  const submit = async () => {
    const next: Errors = {};
    if (!isValidMobile(mobile)) {
      next.mobile = 'Enter your 10-digit mobile number';
    }
    if (code.length !== CODE_LENGTH) {
      next.code = `Enter the ${CODE_LENGTH}-digit code from the clinic`;
    }
    if (!consent) {
      next.consent = 'Please agree to continue';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    const result = await linkAccount(mobile, code);
    setBusy(false);
    if (!result.ok) {
      setErrors({ form: authErrorMessage(result) ?? undefined });
    }
  };

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <BusyOverlay visible={busy} message="Linking your account…" />
      <Text style={styles.title}>Link your account</Text>
      <Text style={styles.intro}>
        Signed in as <Text style={styles.email}>{googleEmail ?? 'your Google account'}</Text>.
        Enter your mobile number and the code Painflame Clinic gave you. You only need to do this
        once.
      </Text>

      <TextField
        label="Mobile number"
        value={mobile}
        onChangeText={text => setMobile(digitsOnly(text, 10))}
        keyboardType="number-pad"
        maxLength={10}
        error={errors.mobile}
      />
      <TextField
        label="Code from the clinic"
        value={code}
        onChangeText={text => setCode(digitsOnly(text, CODE_LENGTH))}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        error={errors.code}
      />

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Your data and privacy</Text>
        <Text style={styles.noticeText}>
          Painflame Clinic stores your name, mobile number, gender, date of birth, Google account
          e-mail, exercise list, exercise history and the reports the clinic adds, so your
          therapists can guide your treatment. It is kept securely, is only seen by you and the
          clinic, and is not shared with anyone else. You can ask the clinic to delete your
          account and data at any time.
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
          onPress={() => setConsent(!consent)}
          style={styles.consentRow}>
          <View style={[styles.checkbox, consent && styles.checkboxOn]}>
            {consent ? <Icon name="check" size={18} color={colors.white} strokeWidth={3} /> : null}
          </View>
          <Text style={styles.consentText}>I agree to Painflame Clinic using my data this way.</Text>
        </Pressable>
        {errors.consent ? <Text style={styles.error}>{errors.consent}</Text> : null}
      </View>

      {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}
      <Button title="Link and continue" onPress={submit} loading={busy} />
      <Pressable onPress={logout} hitSlop={10} style={styles.switch}>
        <Text style={styles.switchText}>Use a different Google account</Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    content: { paddingTop: spacing.xl },
    title: { fontSize: font.title, fontWeight: '800', color: colors.primary },
    intro: {
      fontSize: font.body,
      color: colors.textMuted,
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      lineHeight: 25,
    },
    email: { color: colors.text, fontWeight: '700' },
    notice: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    noticeTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
    noticeText: {
      fontSize: font.small,
      color: colors.textMuted,
      marginTop: spacing.xs,
      lineHeight: 21,
    },
    consentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: colors.primary },
    consentText: { flex: 1, fontSize: font.body, color: colors.text },
    error: { color: colors.danger, fontSize: font.small, marginTop: spacing.xs },
    formError: { color: colors.danger, fontSize: font.body, marginBottom: spacing.md },
    switch: { marginTop: spacing.lg, alignItems: 'center' },
    switchText: { color: colors.primary, fontSize: font.body },
  }),
);
