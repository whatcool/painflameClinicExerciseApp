import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BusyOverlay } from '../../components/BusyOverlay';
import { Button } from '../../components/Button';
import { DateField } from '../../components/DateField';
import { GenderPicker } from '../../components/GenderPicker';
import { Icon } from '../../components/Icon';
import { Screen } from '../../components/Screen';
import { ReadOnlyField, TextField } from '../../components/TextField';
import { useAuth, useCurrentUser } from '../../context/AuthContext';
import { setBiometricEnabled, type Gender } from '../../db/users';
import { updateProfile, uploadProfilePhoto } from '../../services/api';
import {
  disableFingerprint,
  enableFingerprint,
  isFingerprintAvailable,
} from '../../security/biometrics';
import { pickImage } from '../../services/files';
import { font, radius, spacing } from '../../theme';
import { makeStyles, useTheme } from '../../theme/ThemeContext';
import { latestAllowedDob, MIN_PATIENT_AGE_YEARS, toDayKey } from '../../utils/date';

export function ProfileScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useCurrentUser();
  const { refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user.fullName);
  const [gender, setGender] = useState<Gender>(user.gender);
  const [dob, setDob] = useState(user.dob);
  const [nameError, setNameError] = useState('');
  const [dobError, setDobError] = useState('');
  const [fingerprintSupported, setFingerprintSupported] = useState(false);
  const [togglingFingerprint, setTogglingFingerprint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    isFingerprintAvailable().then(setFingerprintSupported);
  }, []);

  const dirty = fullName !== user.fullName || gender !== user.gender || dob !== user.dob;

  const save = async () => {
    if (!fullName.trim()) {
      setNameError('Enter your full name');
      return;
    }
    setNameError('');
    if (dob > toDayKey(latestAllowedDob())) {
      setDobError(`You must be at least ${MIN_PATIENT_AGE_YEARS} years old`);
      return;
    }
    setDobError('');
    setSaving(true);
    try {
      await updateProfile(user.id, { full_name: fullName.trim(), gender, dob });
      refreshUser();
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch {
      Alert.alert('Not saved', 'Please check your internet connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = async () => {
    try {
      const file = await pickImage('profile');
      if (file) {
        setUploading(true);
        await uploadProfilePhoto(user.id, file, user.photoPath);
        refreshUser();
      }
    } catch {
      Alert.alert('Could not add photo', 'Please check your internet connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const toggleFingerprint = async (on: boolean) => {
    setTogglingFingerprint(true);
    try {
      if (on) {
        const ok = await enableFingerprint(user.id, user.mobile);
        if (!ok) {
          return;
        }
      } else {
        await disableFingerprint(user.id);
      }
      setBiometricEnabled(user.id, on);
      refreshUser();
    } catch {
      Alert.alert('Fingerprint not turned on', 'The fingerprint was not confirmed. Please try again.');
    } finally {
      setTogglingFingerprint(false);
    }
  };

  return (
    <Screen>
      <BusyOverlay
        visible={saving || uploading}
        message={uploading ? 'Uploading your photo…' : 'Saving your profile…'}
      />
      <View style={styles.photoBlock}>
        <Avatar uri={user.photoUrl} size={130} />
        <Pressable
          accessibilityRole="button"
          onPress={changePhoto}
          style={styles.photoButton}
          hitSlop={8}>
          <Icon name="camera" size={18} color={colors.white} />
          <Text style={styles.photoButtonText}>{uploading ? 'Uploading…' : user.photoUrl ? 'Edit photo' : 'Add photo'}</Text>
        </Pressable>
      </View>

      <TextField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        error={nameError}
      />
      <ReadOnlyField label="Mobile number" value={user.mobile} />
      <GenderPicker value={gender} onChange={setGender} />
      <DateField
        label="Date of birth"
        value={dob}
        onChange={setDob}
        maximumDate={latestAllowedDob()}
        error={dobError}
      />

      <Button title="Save changes" onPress={save} disabled={!dirty} loading={saving} />

      {fingerprintSupported && (
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>Unlock with fingerprint</Text>
            <Text style={styles.toggleHint}>Ask for your fingerprint every time the app opens</Text>
          </View>
          <Switch
            value={user.biometricEnabled}
            onValueChange={toggleFingerprint}
            disabled={togglingFingerprint}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>
      )}
    </Screen>
  );
}

const useStyles = makeStyles(colors =>
  StyleSheet.create({
    photoBlock: { alignItems: 'center', marginBottom: spacing.lg },
    photoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: -14,
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: colors.white,
    },
    photoButtonText: { color: colors.white, fontSize: font.small, fontWeight: '600' },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xl,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    toggleText: { flex: 1, marginRight: spacing.md },
    toggleTitle: { fontSize: font.body, fontWeight: '600', color: colors.text },
    toggleHint: { fontSize: font.small, color: colors.textMuted, marginTop: 2 },
  }),
);
