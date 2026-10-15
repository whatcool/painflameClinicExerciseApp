import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import NativePlatform from '../../specs/NativePlatform';
import { GOOGLE_WEB_CLIENT_ID, isGoogleConfigured } from '../config/supabase';

export type GoogleSignIn = { idToken: string; nonce: string; email: string | null };

/** A random nonce, and its SHA-256 (hex) which is what Google puts in the ID token. */
export function makeNonce() {
  const raw = bytesToHex(randomBytes(32));
  return { raw, hashed: bytesToHex(sha256(utf8ToBytes(raw))) };
}

/**
 * Shows Google's account chooser and returns an ID token for Supabase.
 * A random nonce is hashed for Google and passed in plain form to Supabase, which checks
 * they match, so a stolen token can't be replayed.
 * Throws an Error whose `code` is 'cancelled', 'no_account', 'not_configured' or 'failed'.
 */
export async function signInWithGoogle(): Promise<GoogleSignIn> {
  if (!NativePlatform || !isGoogleConfigured()) {
    throw Object.assign(new Error('Google sign-in is not set up'), { code: 'not_configured' });
  }
  const nonce = makeNonce();
  const result = await NativePlatform.googleSignIn(GOOGLE_WEB_CLIENT_ID, nonce.hashed);
  return { idToken: result.idToken, nonce: nonce.raw, email: result.email };
}

/** Forgets the Google account choice, so the next sign-in shows the account chooser. */
export async function forgetGoogleAccount() {
  await NativePlatform?.googleSignOut().catch(() => {});
}

export const errorCode = (error: unknown) =>
  (error as { code?: string })?.code ?? 'failed';
