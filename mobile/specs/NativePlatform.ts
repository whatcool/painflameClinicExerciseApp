import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * App-local native module (android/app/src/main/java/com/painflameapp/platform):
 * "Continue with Google" via Android's Credential Manager, and file downloads.
 */
export interface Spec extends TurboModule {
  /**
   * Shows Google's account chooser. `nonce` is the SHA-256 (hex) of a random value that is
   * later given to Supabase in plain form. Rejects with code 'cancelled', 'no_account' or 'failed'.
   */
  googleSignIn(
    webClientId: string,
    nonce: string,
  ): Promise<{ idToken: string; email: string | null; name: string | null }>;
  /** Forgets the chosen Google account, so the next sign-in shows the chooser again. */
  googleSignOut(): Promise<void>;
  /** Saves a file to Downloads/Painflame with a system notification. Resolves when queued. */
  downloadFile(url: string, fileName: string, mimeType: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('NativePlatform');
