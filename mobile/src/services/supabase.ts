import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as Keychain from 'react-native-keychain';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config/supabase';

/** Keeps the patient's login tokens in the Android Keystore instead of plain storage. */
const secureStorage = {
  async getItem(key: string) {
    const item = await Keychain.getGenericPassword({ service: `painflame.${key}` });
    return item ? item.password : null;
  },
  async setItem(key: string, value: string) {
    await Keychain.setGenericPassword('supabase', value, {
      service: `painflame.${key}`,
      storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH,
    });
  },
  async removeItem(key: string) {
    await Keychain.resetGenericPassword({ service: `painflame.${key}` });
  },
};

/** The signed-in patient's client. Row level security limits it to their own data. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground (recommended for React Native).
AppState.addEventListener('change', state => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

/** A short-lived client for one clinic action, after the therapist enters the password. */
export function createClinicClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type Client = SupabaseClient;

export const publicUrl = (bucket: 'exercise-media' | 'doctor-photos', path: string | null) =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${encodeURI(path)}` : null;

/**
 * Uploads a local file (file:// or content://) to storage.
 * React Native can't upload through FormData/Blob with supabase-js, so the file is read as
 * raw bytes and sent as an ArrayBuffer (the approach the library documents for React Native).
 */
export async function uploadFile(
  client: Client,
  bucket: string,
  path: string,
  localUri: string,
  mimeType: string,
) {
  const bytes = await (await fetch(localUri)).arrayBuffer();
  const { error } = await client.storage.from(bucket).upload(path, bytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) {
    console.warn(`Upload to ${bucket} failed`, error);
    throw error;
  }
  return path;
}

export const fileExtension = (name: string | null, mimeType: string) =>
  name?.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ??
  (mimeType === 'application/pdf' ? 'pdf' : mimeType.split('/')[1] ?? 'bin');

/** Turns a failed Edge Function call into its { error } code, or 'network'. */
export async function functionError(error: unknown): Promise<{ error: string; [k: string]: unknown }> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      return await context.json();
    } catch {
      // fall through
    }
  }
  return { error: 'network' };
}
