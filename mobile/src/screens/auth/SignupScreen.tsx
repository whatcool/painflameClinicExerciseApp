import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { GenderPicker } from '../../components/GenderPicker';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import { mobileExists, type Gender } from '../../db/users';
import { isValidPin, PIN_LENGTH } from '../../security/pin';
import { font, spacing } from '../../theme';
import { makeStyles } from '../../theme/ThemeContext';
import { latestAllowedDob, MIN_PATIENT_AGE_YEARS, toDayKey } from '../../utils/date';
import { digitsOnly, isValidMobile } from '../../utils/validation';

type Errors = Partial<Record<'fullName' | 'mobile' | 'gender' | 'dob' | 'pin' | 'confirmPin', string>>;

export function SignupScreen() {
  const styles = useStyles();
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [dob, setDob] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const validate = (): Errors => {
    const next: Errors = {};
    if (!fullName.trim()) {
      next.fullName = 'Enter your full name';
    }
    if (!isValidMobile(mobile)) {
      next.mobile = 'Enter a valid 10-digit mobile number';
    } else if (mobileExists(mobile)) {
      next.mobile = 'An account with this mobile number already exists. Please log in.';
    }
    if (!gender) {
      next.gender = 'Select your gender';
    }
    if (!dob) {
      next.dob = 'Select your date of birth';
    } else if (dob > toDayKey(latestAllowedDob())) {
      next.dob = `You must be at least ${MIN_PATIENT_AGE_YEARS} years old`;
    }
    if (!isValidPin(pin)) {
      next.pin = `PIN must be exactly ${PIN_LENGTH} digits`;
    }
    if (confirmPin !== pin) {
      next.confirmPin = 'PINs do not match';
    }
    return next;
  };

  const submit = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      return;
    }
    setBusy(true);
    try {
      await signup({ fullName: fullName.trim(), mobile, gender: gender!, dob: dob!, pin });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.intro}>Create your Painflame Clinic account.</Text>
      <TextField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        error={errors.fullName}
      />
      <TextField
        label="Mobile number"
        value={mobile}
        onChangeText={text => setMobile(digitsOnly(text, 10))}
        keyboardType="number-pad"
        maxLength={10}
        error={errors.mobile}
      />
      <GenderPicker value={gender} onChange={setGender} error={errors.gender} />
      <DateField
        label="Date of birth"
        value={dob}
        onChange={setDob}
        maximumDate={latestAllowedDob()}
        error={errors.dob}
      />
      <TextField
        label={`Create a ${PIN_LENGTH}-digit PIN`}
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
      <Text style={styles.hint}>
        Remember your PIN. It cannot be recovered if you forget it.
      </Text>
      <Button title="Create account" onPress={submit} loading={busy} />
    </Screen>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    intro: { fontSize: font.body, color: colors.textMuted, marginBottom: spacing.lg },
    hint: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.md },
  }),
);
