import { PermissionsAndroid, Platform } from 'react-native';
import NativeCoach from '../../specs/NativeCoach';

// Words that start a rep. Hindi words are included because many patients may say them.
export const GO_WORDS = ['go', 'start', 'started', 'chalo', 'shuru', 'shuroo', 'चलो', 'शुरू'];

// The microphone listens in 10-second windows, starting a new window until "Go" is heard.
export const LISTEN_WINDOW_MS = 10_000;

/** Thrown when a step is interrupted by Skip or End. */
export class Interrupted extends Error {}

/** Rejects with `Interrupted` as soon as `signal` aborts; runs `onAbort` to stop native work. */
function interruptible<T>(signal: AbortSignal, work: Promise<T>, onAbort?: () => void) {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      onAbort?.();
      reject(new Interrupted());
      return;
    }
    const handleAbort = () => {
      onAbort?.();
      reject(new Interrupted());
    };
    signal.addEventListener('abort', handleAbort);
    work.then(
      value => {
        signal.removeEventListener('abort', handleAbort);
        resolve(value);
      },
      error => {
        signal.removeEventListener('abort', handleAbort);
        reject(error);
      },
    );
  });
}

export function speak(text: string, signal: AbortSignal) {
  return interruptible(signal, NativeCoach?.speak(text) ?? Promise.resolve(), () =>
    NativeCoach?.stopSpeaking(),
  );
}

export function playSound(name: 'whistle' | 'bell', signal: AbortSignal) {
  return interruptible(signal, NativeCoach?.playSound(name) ?? Promise.resolve());
}

export function sleep(ms: number, signal: AbortSignal) {
  let timer: ReturnType<typeof setTimeout>;
  return interruptible(
    signal,
    new Promise<void>(resolve => {
      timer = setTimeout(resolve, ms);
    }),
    () => clearTimeout(timer),
  );
}

export type ListenOutcome = 'voice' | 'tap' | 'voice-unavailable';

/**
 * Waits until the patient says "Go"/"Start" or taps the on-screen button.
 * Listens in 10-second windows and simply opens a new window after each one.
 * If voice recognition can't be used, it falls back to waiting for the tap only.
 */
export async function waitForGo(
  signal: AbortSignal,
  tapped: Promise<void>,
  voiceEnabled: boolean,
  onVoiceUnavailable: () => void,
): Promise<ListenOutcome> {
  const tap = tapped.then(() => 'tap' as const);
  if (!voiceEnabled || !NativeCoach) {
    return interruptible(signal, tap);
  }
  for (;;) {
    const result = await interruptible(
      signal,
      Promise.race([NativeCoach.listen(GO_WORDS, LISTEN_WINDOW_MS), tap]),
      () => NativeCoach?.stopListening(),
    );
    if (result === 'matched') {
      return 'voice';
    }
    if (result === 'tap') {
      NativeCoach.stopListening();
      return 'tap';
    }
    if (result === 'unavailable' || result === 'permission' || result === 'error') {
      onVoiceUnavailable();
      await interruptible(signal, tap);
      return 'voice-unavailable';
    }
    // 'timeout' (nothing heard in this window) or 'cancelled': listen again.
  }
}

/**
 * Counts down `seconds`, calling `onTick` with the whole seconds remaining.
 * Uses the clock rather than counting timer ticks, so it stays accurate.
 */
export function countdown(seconds: number, signal: AbortSignal, onTick: (left: number) => void) {
  let timer: ReturnType<typeof setInterval>;
  return interruptible(
    signal,
    new Promise<void>(resolve => {
      const endAt = Date.now() + seconds * 1000;
      onTick(seconds);
      timer = setInterval(() => {
        const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        onTick(left);
        if (left === 0) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    }),
    () => clearInterval(timer),
  );
}

export function stopAll() {
  NativeCoach?.stopSpeaking();
  NativeCoach?.stopListening();
}

export function keepScreenOn(on: boolean) {
  NativeCoach?.setKeepScreenOn(on);
}

export async function isVoiceAvailable() {
  if (!NativeCoach || !(await NativeCoach.isRecognitionAvailable())) {
    return false;
  }
  if (Platform.OS !== 'android') {
    return true;
  }
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Use your voice',
    message: 'Say “Go” or “Start” to begin each rep, so you don’t have to touch the phone.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}
