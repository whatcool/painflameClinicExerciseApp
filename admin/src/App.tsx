import { useEffect, useState } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { isConfigured, supabase } from './supabase';
import { Login } from './pages/Login';
import { Patients } from './pages/Patients';
import { PatientDetail } from './pages/PatientDetail';
import { Exercises } from './pages/Exercises';
import { Doctors } from './pages/Doctors';

const isClinic = (session: Session | null) => session?.user.app_metadata?.role === 'clinic';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) {
    return (
      <main>
        <div className="card">
          <h1>Admin panel not configured</h1>
          <p>
            Copy <code>.env.example</code> to <code>.env</code> and fill in the Supabase URL and
            key, then restart.
          </p>
        </div>
      </main>
    );
  }
  if (session === undefined) {
    return null;
  }
  if (!isClinic(session)) {
    return <Login wrongAccount={session !== null} />;
  }

  return (
    // HashRouter: works on any static host without extra routing setup.
    <HashRouter>
      <header className="topbar">
        <img src="/logo.png" alt="Painflame Clinic" />
        <nav>
          <NavLink to="/patients">Patients</NavLink>
          <NavLink to="/exercises">Exercise Library</NavLink>
          <NavLink to="/doctors">Doctors</NavLink>
        </nav>
        <button className="secondary" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>
      <main>
        <Routes>
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="*" element={<Navigate to="/patients" replace />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
