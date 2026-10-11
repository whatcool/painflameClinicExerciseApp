import { useState, type FormEvent } from 'react';
import { supabase } from '../supabase';

/** Sign-in with the shared clinic login. Patient accounts are refused. */
export function Login({ wrongAccount }: { wrongAccount: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    wrongAccount ? 'This account is not the clinic login.' : '',
  );
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (signInError) {
      setError('Incorrect e-mail or password.');
    } else if (data.user?.app_metadata?.role !== 'clinic') {
      await supabase.auth.signOut();
      setError('This account is not the clinic login.');
    }
  };

  return (
    <div className="login card">
      <img src="/logo.png" alt="Painflame Clinic" />
      <h1>Clinic admin</h1>
      <form onSubmit={submit}>
        <label>
          E-mail
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
