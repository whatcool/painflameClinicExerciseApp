import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { clinicPatients, errorText, must, supabase } from '../supabase';
import type { Doctor, Gender, Patient } from '../types';
import { SetupCodeNotice } from '../components/SetupCodeNotice';
import { doctorLabel } from '../doctors';

const MOBILE = /^[6-9]\d{9}$/;

export function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [lastDays, setLastDays] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, d, days] = await Promise.all([
        supabase.from('patients').select('*').order('full_name'),
        supabase.from('doctors').select('*').order('full_name'),
        supabase.from('exercise_days').select('patient_id, day').order('day', { ascending: false }),
      ]);
      setPatients(must(p) as Patient[]);
      setDoctors(must(d) as Doctor[]);
      const latest: Record<string, string> = {};
      for (const row of must(days) as { patient_id: string; day: string }[]) {
        latest[row.patient_id] ??= row.day;
      }
      setLastDays(latest);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doctorName = useMemo(
    () => Object.fromEntries(doctors.map(d => [d.id, doctorLabel(d, doctors)])),
    [doctors],
  );
  const shown = patients.filter(
    p =>
      p.full_name.toLowerCase().includes(search.trim().toLowerCase()) ||
      p.mobile.includes(search.trim()),
  );

  return (
    <>
      <div className="row">
        <h1>Patients</h1>
        <span className="spacer" />
        <input
          placeholder="Search name or mobile"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button onClick={() => setCreating(true)}>+ New patient</button>
      </div>
      {error && <div className="error">{error}</div>}

      {creating && (
        <NewPatient
          doctors={doctors}
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Doctor</th>
              <th>Account</th>
              <th>List editing</th>
              <th>Last exercised</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(p => (
              <tr key={p.id} className="clickable" onClick={() => navigate(`/patients/${p.id}`)}>
                <td>
                  <strong>{p.full_name}</strong>
                </td>
                <td>{p.mobile}</td>
                <td>{p.doctor_id ? doctorName[p.doctor_id] ?? '—' : <span className="muted">—</span>}</td>
                <td>
                  {p.activated_at ? (
                    <span className="badge green">Active</span>
                  ) : (
                    <span className="badge orange">Waiting for code</span>
                  )}
                </td>
                <td>{p.can_edit_exercises ? <span className="badge">Patient can edit</span> : 'Therapist only'}</td>
                <td>{lastDays[p.id] ?? <span className="muted">Never</span>}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No patients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function NewPatient({ doctors, onDone }: { doctors: Doctor[]; onDone: () => void }) {
  const [form, setForm] = useState({
    full_name: '',
    mobile: '',
    gender: 'Male' as Gender,
    dob: '',
    doctor_id: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ setup_code: string; expires_at: string } | null>(null);

  const set = (field: keyof typeof form) => (value: string) =>
    setForm(current => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!MOBILE.test(form.mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setResult(await clinicPatients({ action: 'create', ...form }));
    } catch (e) {
      const message = errorText(e);
      setError(
        message === 'mobile_exists' ? 'A patient with this mobile number already exists.' : message,
      );
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <div className="card">
        <h2>Patient created: {form.full_name}</h2>
        <SetupCodeNotice code={result.setup_code} expiresAt={result.expires_at} mobile={form.mobile} />
        <button onClick={onDone}>Done</button>
      </div>
    );
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>New patient</h2>
      <div className="grid2">
        <label>
          Full name
          <input value={form.full_name} onChange={e => set('full_name')(e.target.value)} required />
        </label>
        <label>
          Mobile number
          <input
            value={form.mobile}
            onChange={e => set('mobile')(e.target.value.replace(/\D/g, '').slice(0, 10))}
            required
          />
        </label>
        <label>
          Gender
          <select value={form.gender} onChange={e => set('gender')(e.target.value)}>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </label>
        <label>
          Date of birth
          <input
            type="date"
            value={form.dob}
            max={new Date(new Date().getFullYear() - 5, new Date().getMonth(), new Date().getDate())
              .toISOString()
              .slice(0, 10)}
            onChange={e => set('dob')(e.target.value)}
            required
          />
        </label>
        <label>
          Doctor
          <select value={form.doctor_id} onChange={e => set('doctor_id')(e.target.value)}>
            <option value="">— none yet —</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {doctorLabel(d, doctors)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="row" style={{ marginTop: 16 }}>
        <button disabled={busy}>{busy ? 'Creating…' : 'Create patient'}</button>
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
