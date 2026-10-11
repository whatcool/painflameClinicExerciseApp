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
import {
  clearSession,
  getLocalPin,
  getSessionUserId,
  setLocalPin,
  setSessionUserId,
} from '../db/session';
import { getUser, type User } from '../db/users';
import { hashPin, verifyPin } from '../security/pin';
import { functionError, supabase } from '../services/supabase';
import { syncPatient } from '../services/sync';

// Re-lock with fingerprint if the app was in the background longer than this.
// Short trips (file picker, fingerprint dialog) don't trigger a lock.
const RELOCK_AFTER_MS = 60 * 1000;
// Sync again when returning to the app after this long.
const RESYNC_AFTER_MS = 5 * 60 * 1000;
// Screens ask for a sync when they open; don't hit the server more often than this.
const MIN_SYNC_GAP_MS = 30 * 1000;

type Status = 'loading' | 'signedOut' | 'locked' | 'signedIn';

/** Outcome of login/activation; `error` is a code from the Edge Functions or 'network'. */
export type AuthResult =
  | { ok: true }
  | { ok: false; error: string; attemptsLeft?: number; retryAfterMinutes?: number };

type AuthContextValue = {
  status: Status;
  user: User | null;
  login: (mobile: string, pin: string) => Promise<AuthResult>;
  activate: (mobile: string, code: string, pin: string) => Promise<AuthResult>;
  /** Lock screen: checks the PIN against the local hash, so it works offline. */
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlock: () => void;
  logout: () => void;
  refreshUser: () => void;
  /** Pulls the latest data from the server (silently keeps cached data when offline). */
  sync: (force?: boolean) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const toResult = (body: Record<string, unknown>): AuthResult => ({
  ok: false,
  error: String(body.error ?? 'network'),
  attemptsLeft: typeof body.attempts_left === 'number' ? body.attempts_left : undefined,
  retryAfterMinutes:
    typeof body.retry_after_minutes === 'number' ? body.retry_after_minutes : undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
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
    setUser(null);
    setStatus('signedOut');
  }, []);

  // Restore the session on app start.
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

  // The server ended the session (e.g. the clinic deleted the account or reset the PIN code).
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
        if (status !== 'signedOut' && Date.now() - lastSync.current > RESYNC_AFTER_MS) {
          sync();
        }
      }
    });
    return () => subscription.remove();
  }, [user, status, sync]);

  const login = useCallback<AuthContextValue['login']>(async (mobile, pin) => {
    const { data, error } = await supabase.functions.invoke('patient-login', {
      body: { mobile, pin },
    });
    if (error) {
      return toResult(await functionError(error));
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sessionError) {
      return { ok: false, error: 'network' };
    }
    const patientId: string = data.patient_id;
    setSessionUserId(patientId);
    setLocalPin(patientId, await hashPin(pin));
    try {
      await syncPatient(patientId);
      lastSync.current = Date.now();
    } catch {
      if (!getUser(patientId)) {
        logout();
        return { ok: false, error: 'network' };
      }
    }
    setUser(getUser(patientId));
    setStatus('signedIn');
    return { ok: true };
  }, [logout]);

  const activate = useCallback<AuthContextValue['activate']>(
    async (mobile, code, pin) => {
      const { error } = await supabase.functions.invoke('activate-patient', {
        body: { mobile, code, pin, consent: true },
      });
      if (error) {
        return toResult(await functionError(error));
      }
      return login(mobile, pin);
    },
    [login],
  );

  const unlockWithPin = useCallback(async (pin: string) => {
    const patientId = getSessionUserId();
    const stored = patientId ? getLocalPin(patientId) : null;
    return stored ? verifyPin(pin, stored) : false;
  }, []);

  const unlock = useCallback(() => setStatus('signedIn'), []);

  const refreshUser = useCallback(() => {
    setUser(current => (current ? getUser(current.id) : null));
  }, []);

  const value = useMemo(
    () => ({ status, user, login, activate, unlockWithPin, unlock, logout, refreshUser, sync }),
    [status, user, login, activate, unlockWithPin, unlock, logout, refreshUser, sync],
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

/** Plain-language messages for login and activation errors. */
export function authErrorMessage(result: Extract<AuthResult, { ok: false }>) {
  switch (result.error) {
    case 'invalid_credentials':
      return result.attemptsLeft !== undefined
        ? `Mobile number or PIN is incorrect. ${result.attemptsLeft} ${
            result.attemptsLeft === 1 ? 'try' : 'tries'
          } left.`
        : 'Mobile number or PIN is incorrect.';
    case 'locked':
      return `Too many wrong PINs. Please try again in ${result.retryAfterMinutes ?? 15} minutes.`;
    case 'not_activated':
      return 'This account is not activated yet. Tap “First time? Activate” and enter the code from the clinic.';
    case 'invalid_code':
      return 'The clinic code is not correct. Please check it and try again.';
    case 'code_expired':
      return 'This clinic code has expired. Please ask the clinic for a new one.';
    case 'too_many_attempts':
      return 'Too many wrong codes. Please ask the clinic for a new code.';
    case 'invalid_input':
      return 'Please check the mobile number, code and PIN.';
    case 'network':
      return 'Could not reach the server. Please check your internet connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
