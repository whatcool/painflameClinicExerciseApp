import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const isConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT-REF'));

/** The clinic's client. Row level security gives the clinic login access to everything. */
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true },
});

export const publicUrl = (bucket: 'exercise-media' | 'doctor-photos', path: string | null) =>
  path ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;

export const extensionOf = (file: File) =>
  file.name.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ??
  (file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1] ?? 'bin');

export async function upload(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) {
    throw error;
  }
  return path;
}

/** Throws the error of a Supabase response, so pages can use try/catch. */
export function must<T>(result: { data: T; error: unknown }): T {
  if (result.error) {
    throw result.error;
  }
  return result.data;
}

/** Calls the clinic-patients Edge Function. */
export async function clinicPatients<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('clinic-patients', { body });
  if (error) {
    const context = (error as { context?: Response }).context;
    const details = context ? await context.json().catch(() => null) : null;
    throw new Error(details?.error ?? error.message);
  }
  return data as T;
}

export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error
    ? String((error as { message: unknown }).message)
    : 'Something went wrong';
