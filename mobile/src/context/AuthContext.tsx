import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { clearSession, getSessionUserId, setSessionUserId } from '../db/session';
import { getUser, type User } from '../db/users';
import { errorCode, forgetGoogleAccount, signInWithGoogle } from '../services/google';
import { functionError, supabase } from '../services/supabase';
import { syncPatient } from '../services/sync';

// Re-lock with fingerprint if the app was in the background longer than this.
// Short trips (file picker, fingerprint dialog) don't trigger a lock.
const RELOCK_AFTER_MS = 60 * 1000;
// Sync again when returning to the app after this long.
const RESYNC_AFTER_MS = 5 * 60 * 1000;
// Screens ask for a sync when they open; don't hit the server more often than this.
const MIN_SYNC_GAP_MS = 30 * 1000;

/**
 * signedOut  → "Continue with Google"
 * needsLink  → signed in with Google, but not yet linked to a patient (mobile + clinic code)
 * locked     → fingerprint unlock is on and the app was just opened
 */
type Status = 'loading' | 'signedOut' | 'needsLink' | 'locked' | 'signedIn';

/** Outcome of sign-in/linking; `error` is a code (see authErrorMessage). */
export type AuthResult =
  | { ok: true }
  | { ok: false; error: string; attemptsLeft?: number };

type AuthContextValue = {
  status: Status;
  user: User | null;
  /** E-mail of the Google account waiting to be linked (status 'needsLink'). */
  googleEmail: string | null;
  signInWithGoogle: () => Promise<AuthResult>;
  /** First sign-in: links the Google account to the patient using the clinic's code. */
  linkAccount: (mobile: string, code: string) => Promise<AuthResult>;
  /** Lock screen fallback: the same Google account unlocks the app. */
  unlockWithGoogle: () => Promise<AuthResult>;
  unlock: () => void;
  logout: () => void;
  refreshUser: () => void;
  /** Pulls the latest data from the server (silently keeps cached data when offline). */
  sync: (force?: boolean) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const fail = (error: string, attemptsLeft?: number): AuthResult => ({
  ok: false,
  error,
  attemptsLeft,
});

/** The patient record visible to the signed-in Google account (row level security). */
async function findLinkedPatient(): Promise<string | null | 'network'> {
  const { data, error } = await supabase.from('patients').select('id').limit(1).maybeSingle();
  if (error) {
    return 'network';
  }
  return data?.id ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const backgroundedAt = useRef<number | null>(null);
  const lastSync = useRef(0);

  const sync = useCallback(async (force = false) => {
    const patientId = getSessionUserId();
    if (!patientId) {
      return false;
    }
    if (!force && Date.now() - lastSync.current < MIN_SYNC_GAP_MS) {
      return true;
    }
    try {
      await syncPatient(patientId);
      lastSync.current = Date.now();
      setUser(getUser(patientId));
      return true;
    } catch {
      return false; // offline: keep showing cached data
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    forgetGoogleAccount(); // next sign-in shows the account chooser again
    setUser(null);
    setGoogleEmail(null);
    setStatus('signedOut');
  }, []);

  // Restore the session on app start: cached data first, then refresh in the background.
  useEffect(() => {
    (async () => {
      const patientId = getSessionUserId();
      const { data } = await supabase.auth.getSession();
      const cached = patientId ? getUser(patientId) : null;
      if (!patientId || !data.session || !cached) {
        clearSession();
        setStatus('signedOut');
        return;
      }
      setUser(cached);
      setStatus(cached.biometricEnabled ? 'locked' : 'signedIn');
      sync(true);
    })();
  }, [sync]);

  // The server ended the session (e.g. the clinic deleted the account).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' && getSessionUserId()) {
        logout();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [logout]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'background') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS && user?.biometricEnabled && status === 'signedIn') {
          setStatus('locked');
        }
        if (status === 'signedIn' && Date.now() - lastSync.current > RESYNC_AFTER_MS) {
          sync();
        }
      }
    });
    return () => subscription.remove();
  }, [user, status, sync]);

  /**
   * Opens the patient's session. With cached data on this phone the dashboard opens at once
   * and refreshes in the background; on a new phone it waits for the first download.
   */
  const openPatient = useCallback(
    async (patientId: string): Promise<AuthResult> => {
      setSessionUserId(patientId);
      const cached = getUser(patientId);
      if (cached) {
        setUser(cached);
        setStatus(cached.biometricEnabled ? 'locked' : 'signedIn');
        sync(true);
        return { ok: true };
      }
      try {
        await syncPatient(patientId);
        lastSync.current = Date.now();
      } catch {
        clearSession();
        return fail('network');
      }
      setUser(getUser(patientId));
      setStatus('signedIn');
      return { ok: true };
    },
    [sync],
  );

  /** Google account chooser → Supabase session. Returns the Google e-mail. */
  const googleSession = useCallback(async (): Promise<
    { ok: true; email: string | null } | { ok: false; error: string }
  > => {
    let google;
    try {
      google = await signInWithGoogle();
    } catch (error) {
      return { ok: false, error: errorCode(error) };
    }
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: google.idToken,
      nonce: google.nonce,
    });
    if (error) {
      return { ok: false, error: /fetch|network/i.test(error.message) ? 'network' : 'failed' };
    }
    return { ok: true, email: google.email };
  }, []);

  const signInWithGoogleAccount = useCallback(async (): Promise<AuthResult> => {
    const session = await googleSession();
    if (!session.ok) {
      return fail(session.error);
    }
    const patientId = await findLinkedPatient();
    if (patientId === 'network') {
      return fail('network');
    }
    if (!patientId) {
      // First time with this Google account: ask for mobile number + clinic code.
      setGoogleEmail(session.email);
      setStatus('needsLink');
      return { ok: true };
    }
    return openPatient(patientId);
  }, [googleSession, openPatient]);

  const linkAccount = useCallback(
    async (mobile: string, code: string): Promise<AuthResult> => {
      const { data, error } = await supabase.functions.invoke('link-google', {
        body: { mobile, code, consent: true },
      });
      if (error) {
        const body = await functionError(error);
        return fail(
          String(body.error ?? 'network'),
          typeof body.attempts_left === 'number' ? body.attempts_left : undefined,
        );
      }
      setGoogleEmail(null);
      return openPatient(data.patient_id);
    },
    [openPatient],
  );

  const unlockWithGoogle = useCallback(async (): Promise<AuthResult> => {
    const session = await googleSession();
    if (!session.ok) {
      return fail(session.error);
    }
    const patientId = await findLinkedPatient();
    if (patientId === 'network') {
      return fail('network');
    }
    if (patientId !== getSessionUserId()) {
      return fail('wrong_account');
    }
    setStatus('signedIn');
    return { ok: true };
  }, [googleSession]);

  const unlock = useCallback(() => setStatus('signedIn'), []);

  const refreshUser = useCallback(() => {
    setUser(current => (current ? getUser(current.id) : null));
  }, []);

  const value = useMemo(
    () => ({
      status,
      user,
      googleEmail,
      signInWithGoogle: signInWithGoogleAccount,
      linkAccount,
      unlockWithGoogle,
      unlock,
      logout,
      refreshUser,
      sync,
    }),
    [
      status,
      user,
      googleEmail,
      signInWithGoogleAccount,
      linkAccount,
      unlockWithGoogle,
      unlock,
      logout,
      refreshUser,
      sync,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

/** For screens that only render when signed in. */
export function useCurrentUser() {
  const { user } = useAuth();
  if (!user) {
    throw new Error('No signed-in user');
  }
  return user;
}

/** Plain-language messages for sign-in and linking errors (null = say nothing). */
export function authErrorMessage(result: Extract<AuthResult, { ok: false }>): string | null {
  switch (result.error) {
    case 'cancelled':
      return null; // the patient closed the Google chooser
    case 'no_account':
      return 'There is no Google account on this phone. Add one in Settings → Accounts, then try again.';
    case 'not_configured':
      return 'Google sign-in is not set up in this version of the app yet.';
    case 'wrong_account':
      return 'That is a different Google account. Choose the account you used for this app.';
    case 'google_already_linked':
      return 'This Google account is already used by another patient. Please choose a different Google account.';
    case 'invalid_code':
      return result.attemptsLeft !== undefined
        ? `The clinic code or mobile number is not correct. ${result.attemptsLeft} ${
            result.attemptsLeft === 1 ? 'try' : 'tries'
          } left.`
        : 'The clinic code or mobile number is not correct.';
    case 'code_expired':
      return 'This clinic code has expired. Please ask the clinic for a new one.';
    case 'too_many_attempts':
      return 'Too many wrong codes. Please ask the clinic for a new code.';
    case 'invalid_input':
      return 'Please check the mobile number and the 8-digit code.';
    case 'network':
      return 'Could not reach the server. Please check your internet connection.';
    default:
      return 'Sign-in did not work. Please try again.';
  }
}
