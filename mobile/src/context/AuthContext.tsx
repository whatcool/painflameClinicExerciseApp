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
import { checkCredentials, createUser, getUser, type Gender, type User } from '../db/users';

// Re-lock with fingerprint if the app was in the background longer than this.
// Short trips (file picker, fingerprint dialog) don't trigger a lock.
const RELOCK_AFTER_MS = 60 * 1000;

type Status = 'loading' | 'signedOut' | 'locked' | 'signedIn';

type AuthContextValue = {
  status: Status;
  user: User | null;
  signup: (input: {
    mobile: string;
    fullName: string;
    gender: Gender;
    dob: string;
    pin: string;
  }) => Promise<void>;
  login: (mobile: string, pin: string) => Promise<boolean>;
  unlock: () => void;
  logout: () => void;
  refreshUser: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const userId = getSessionUserId();
    const sessionUser = userId !== null ? getUser(userId) : null;
    if (!sessionUser) {
      setStatus('signedOut');
      return;
    }
    setUser(sessionUser);
    setStatus(sessionUser.biometricEnabled ? 'locked' : 'signedIn');
  }, []);

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
      }
    });
    return () => subscription.remove();
  }, [user, status]);

  const signup = useCallback<AuthContextValue['signup']>(async input => {
    const created = await createUser(input);
    setSessionUserId(created.id);
    setUser(created);
    setStatus('signedIn');
  }, []);

  const login = useCallback(async (mobile: string, pin: string) => {
    const found = await checkCredentials(mobile, pin);
    if (!found) {
      return false;
    }
    setSessionUserId(found.id);
    setUser(found);
    setStatus('signedIn');
    return true;
  }, []);

  const unlock = useCallback(() => setStatus('signedIn'), []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setStatus('signedOut');
  }, []);

  const refreshUser = useCallback(() => {
    setUser(current => (current ? getUser(current.id) : null));
  }, []);

  const value = useMemo(
    () => ({ status, user, signup, login, unlock, logout, refreshUser }),
    [status, user, signup, login, unlock, logout, refreshUser],
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
