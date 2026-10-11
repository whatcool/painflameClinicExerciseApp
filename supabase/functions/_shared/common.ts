// Shared helpers for the Painflame Edge Functions (Deno).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const MAX_SETUP_ATTEMPTS = 5;
export const SETUP_CODE_DAYS = 7;

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
};

const SUPABASE_URL = () => env('SUPABASE_URL');
// Newer projects expose publishable/secret keys; older ones anon/service_role. Accept either.
const PUBLIC_KEY = () =>
  Deno.env.get('SUPABASE_ANON_KEY') ?? firstKey('SUPABASE_PUBLISHABLE_KEYS') ?? env('SUPABASE_ANON_KEY');
const SECRET_KEY = () =>
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? firstKey('SUPABASE_SECRET_KEYS') ?? env('SUPABASE_SERVICE_ROLE_KEY');

function firstKey(name: string) {
  const raw = Deno.env.get(name);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw);
    return (typeof parsed === 'object' ? Object.values(parsed)[0] : parsed) as string;
  } catch {
    return raw;
  }
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Full-access client (bypasses row level security). Never expose to apps. */
export const adminClient = (): SupabaseClient =>
  createClient(SUPABASE_URL(), SECRET_KEY(), noSession);

/** Ordinary client, used to sign patients in. */
export const publicClient = (): SupabaseClient =>
  createClient(SUPABASE_URL(), PUBLIC_KEY(), noSession);

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Error responses carry a stable `error` code the apps switch on. */
export const fail = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  json({ error, ...extra }, status);

export const isValidMobile = (mobile: unknown): mobile is string =>
  typeof mobile === 'string' && /^[6-9]\d{9}$/.test(mobile);

export const isValidPin = (pin: unknown): pin is string =>
  typeof pin === 'string' && /^\d{6}$/.test(pin);

/** Each patient is a Supabase Auth user with this (never e-mailed) address. */
export const patientEmail = (mobile: string) => `${mobile}@patients.painflame.com`;

async function hmacHex(message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env('PIN_PEPPER')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The patient's Supabase Auth password is derived from the PIN with a server-side
 * secret (PIN_PEPPER). Without the secret nobody can sign in with a guessed PIN
 * directly, so all PIN attempts must go through patient-login and its lockout.
 */
export const passwordFor = (mobile: string, pin: string) => hmacHex(`pin:${mobile}:${pin}`);

export const hashSetupCode = (patientId: string, code: string) =>
  hmacHex(`setup:${patientId}:${code}`);

/** 8-digit one-time code the clinic gives the patient, easy to type on a phone keypad. */
export function newSetupCode() {
  const digits: number[] = [];
  const buffer = new Uint8Array(1);
  while (digits.length < 8) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < 250) {
      digits.push(buffer[0] % 10); // reject 250-255 so every digit is equally likely
    }
  }
  return digits.join('');
}

export function randomPassword() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}
