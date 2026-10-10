import * as Keychain from 'react-native-keychain';

// react-native-keychain shows the AndroidX BiometricPrompt when reading an item that
// was stored with biometric-protected storage. The stored value itself is a marker;
// the successful prompt is what unlocks the app.
const serviceFor = (userId: number) => `com.painflame.therapies.biometric.${userId}`;

const prompt = {
  title: 'Unlock Painflame Clinic',
  subtitle: 'Use your fingerprint',
  cancel: 'Use PIN instead',
};

export async function isFingerprintAvailable() {
  try {
    const type = await Keychain.getSupportedBiometryType();
    return type !== null;
  } catch {
    return false;
  }
}

/** Turns fingerprint unlock on for a user. Shows the fingerprint prompt once to confirm. */
export async function enableFingerprint(userId: number, mobile: string) {
  const result = await Keychain.setGenericPassword(mobile, 'unlock', {
    service: serviceFor(userId),
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
    storage: Keychain.STORAGE_TYPE.AES_GCM,
    authenticationPrompt: { ...prompt, subtitle: 'Confirm your fingerprint' },
  });
  return result !== false;
}

export async function disableFingerprint(userId: number) {
  await Keychain.resetGenericPassword({ service: serviceFor(userId) });
}

/** Returns true only if the fingerprint matched. Failure or cancel returns false (fall back to PIN). */
export async function unlockWithFingerprint(userId: number) {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: serviceFor(userId),
      authenticationPrompt: prompt,
    });
    return credentials !== false;
  } catch {
    return false;
  }
}
