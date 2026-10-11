import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { authErrorMessage, useAuth } from '../../context/AuthContext';
import { isValidPin, PIN_LENGTH } from '../../security/pin';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { digitsOnly, isValidMobile } from '../../utils/validation';

const CODE_LENGTH = 8;

type Errors = Partial<Record<'mobile' | 'code' | 'pin' | 'confirmPin' | 'consent' | 'form', string>>;

/**
 * First-time activation and PIN reset: the clinic creates the account and gives the
 * patient a one-time code; the patient chooses their PIN here.
 */
export function ActivateScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { activate } = useAuth();
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: Errors = {};
    if (!isValidMobile(mobile)) {
      next.mobile = 'Enter your 10-digit mobile number';
    }
    if (code.length !== CODE_LENGTH) {
      next.code = `Enter the ${CODE_LENGTH}-digit code from the clinic`;
    }
    if (!isValidPin(pin)) {
      next.pin = `PIN must be exactly ${PIN_LENGTH} digits`;
    }
    if (confirmPin !== pin) {
      next.confirmPin = 'PINs do not match';
    }
    if (!consent) {
      next.consent = 'Please agree to continue';
    }
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    const result = await activate(mobile, code, pin);
    setBusy(false);
    if (!result.ok) {
      setErrors({ form: authErrorMessage(result) });
    }
  };

  return (
    <Screen>
      <Text style={styles.intro}>
        Enter the code the clinic gave you and choose a {PIN_LENGTH}-digit PIN. If you forgot
        your PIN, ask the clinic for a new code and do the same.
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
      <TextField
        label={`Choose a ${PIN_LENGTH}-digit PIN`}
        value={pin}
        onChangeText={text => setPin(digitsOnly(text, PIN_LENGTH))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        error={errors.pin}
      />
      <TextField
        label="Confirm PIN"
        value={confirmPin}
        onChangeText={text => setConfirmPin(digitsOnly(text, PIN_LENGTH))}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={PIN_LENGTH}
        error={errors.confirmPin}
      />

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Your data and privacy</Text>
        <Text style={styles.noticeText}>
          Painflame Clinic stores your name, mobile number, gender, date of birth, exercise
          list, exercise history and the reports the clinic adds, so your therapists can guide
          your treatment. It is kept securely, is only seen by you and the clinic, and is not
          shared with anyone else. You can ask the clinic to delete your account and data at any
          time.
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
      <Button title="Activate and log in" onPress={submit} loading={busy} />
    </Screen>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    intro: { fontSize: font.body, color: colors.textMuted, marginBottom: spacing.lg },
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
  }),
);
