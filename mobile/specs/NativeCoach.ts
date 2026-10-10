import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * App-local native module (android/app/src/main/java/com/painflameapp/coach) that
 * powers the exercise session: speech, voice commands, sounds and keep-screen-on.
 */
export interface Spec extends TurboModule {
  /** Speaks the text aloud; resolves when finished (or immediately if no TTS engine). */
  speak(text: string): Promise<void>;
  stopSpeaking(): void;
  isRecognitionAvailable(): Promise<boolean>;
  /**
   * Listens for up to `windowMs` for any of `words`.
   * Resolves 'matched', 'timeout', 'cancelled', 'unavailable', 'permission' or 'error'.
   */
  listen(words: string[], windowMs: number): Promise<string>;
  stopListening(): void;
  /** Plays res/raw/<name>; resolves when the sound ends. */
  playSound(name: string): Promise<void>;
  setKeepScreenOn(on: boolean): void;
}

export default TurboModuleRegistry.get<Spec>('NativeCoach');
