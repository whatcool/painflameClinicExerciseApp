import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SetupCodeNotice } from '../components/SetupCodeNotice';
import {
  clinicPatients,
  errorText,
  extensionOf,
  must,
  supabase,
  upload,
} from '../supabase';
import { doctorLabel } from '../doctors';
import { currentStreak, dayKey, longestStreak, monthDots } from '../tracking';
import {
  MONTHS,
  type Doctor,
  type Exercise,
  type ExerciseDay,
  type Gender,
  type ListItem,
  type Patient,
  type Report,
} from '../types';

export function PatientDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [library, setLibrary] = useState<Exercise[]>([]);
  const [error, setError] = useState('');

  const loadPatient = useCallback(async () => {
    try {
      setPatient(must(await supabase.from('patients').select('*').eq('id', id).single()) as Patient);
    } catch (e) {
      setError(errorText(e));
    }
  }, [id]);

  useEffect(() => {
    loadPatient();
    supabase
      .from('doctors')
      .select('*')
      .order('full_name')
      .then(({ data }) => setDoctors((data ?? []) as Doctor[]));
    supabase
      .from('exercises')
      .select('*')
      .order('name')
      .then(({ data }) => setLibrary((data ?? []) as Exercise[]));
  }, [loadPatient]);

  if (!patient) {
    return error ? <div className="error">{error}</div> : <p className="muted">Loading…</p>;
  }

  return (
    <>
      <p>
        <Link to="/patients">← All patients</Link>
      </p>
      <h1>{patient.full_name}</h1>
      <ProfileSection patient={patient} doctors={doctors} onSaved={loadPatient} />
      <ExerciseListSection patient={patient} library={library} onPermissionChanged={loadPatient} />
      <ReportsSection patient={patient} doctors={doctors} />
      <TrackingSection patient={patient} />
      <AccountSection
        patient={patient}
        onDeleted={() => navigate('/patients')}
        onChanged={loadPatient}
      />
    </>
  );
}

// --- Profile -----------------------------------------------------------------

function ProfileSection({
  patient,
  doctors,
  onSaved,
}: {
  patient: Patient;
  doctors: Doctor[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: patient.full_name,
    gender: patient.gender,
    dob: patient.dob,
    doctor_id: patient.doctor_id ?? '',
  });
  const [status, setStatus] = useState('');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setStatus('Saving…');
    try {
      must(
        await supabase
          .from('patients')
          .update({ ...form, doctor_id: form.doctor_id || null })
          .eq('id', patient.id),
      );
      setStatus('Saved');
      onSaved();
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  return (
    <form className="card" onSubmit={save}>
      <h2>Profile</h2>
      <div className="grid2">
        <label>
          Full name
          <input
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            required
          />
        </label>
        <label>
          Mobile number
          <input value={patient.mobile} disabled />
        </label>
        <label>
          Gender
          <select
            value={form.gender}
            onChange={e => setForm({ ...form, gender: e.target.value as Gender })}>
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
            onChange={e => setForm({ ...form, dob: e.target.value })}
            required
          />
        </label>
        <label>
          Doctor
          <select
            value={form.doctor_id}
            onChange={e => setForm({ ...form, doctor_id: e.target.value })}>
            <option value="">— none —</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {doctorLabel(d, doctors)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <button>Save profile</button>
        <span className="muted">{status}</span>
      </div>
    </form>
  );
}

// --- Exercise list -------------------------------------------------------------

function ExerciseListSection({
  patient,
  library,
  onPermissionChanged,
}: {
  patient: Patient;
  library: Exercise[];
  onPermissionChanged: () => void;
}) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [saved, setSaved] = useState<ListItem[]>([]);
  const [adding, setAdding] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('patient_exercises')
      .select('exercise_id, reps, hold_seconds')
      .eq('patient_id', patient.id)
      .order('position');
    setItems((data ?? []) as ListItem[]);
    setSaved((data ?? []) as ListItem[]);
  }, [patient.id]);

  useEffect(() => {
    load();
  }, [load]);

  const names = useMemo(() => Object.fromEntries(library.map(e => [e.id, e])), [library]);
  const dirty = JSON.stringify(items) !== JSON.stringify(saved);

  const move = (index: number, delta: number) =>
    setItems(current => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  const change = (index: number, field: 'reps' | 'hold_seconds', value: number) =>
    setItems(current => current.map((item, i) => (i === index ? { ...item, [field]: value } : item)));

  const save = async () => {
    setStatus('Saving…');
    try {
      must(await supabase.rpc('save_exercise_list', { p_patient: patient.id, p_items: items }));
      setSaved(items);
      setStatus('Saved');
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  const togglePermission = async (allow: boolean) => {
    try {
      must(
        await supabase.from('patients').update({ can_edit_exercises: allow }).eq('id', patient.id),
      );
      onPermissionChanged();
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  return (
    <div className="card">
      <div className="row">
        <h2>Exercise list</h2>
        <span className="spacer" />
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={patient.can_edit_exercises}
            onChange={e => togglePermission(e.target.checked)}
          />
          Patient can edit this list in the app
        </label>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Exercise</th>
            <th>Reps</th>
            <th>Hold (s)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={`${item.exercise_id}-${i}`}>
              <td>{i + 1}</td>
              <td>
                {names[item.exercise_id]?.name ?? item.exercise_id}
                {names[item.exercise_id] && !names[item.exercise_id].active && (
                  <span className="badge orange" style={{ marginLeft: 8 }}>
                    inactive
                  </span>
                )}
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={item.reps}
                  onChange={e => change(i, 'reps', Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={item.hold_seconds}
                  onChange={e => change(i, 'hold_seconds', Number(e.target.value))}
                />
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="link" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button
                  className="link"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}>
                  ↓
                </button>
                <button
                  className="link"
                  onClick={() => setItems(current => current.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No exercises yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 12 }}>
        <select value={adding} onChange={e => setAdding(e.target.value)}>
          <option value="">Add exercise…</option>
          {library
            .filter(e => e.active && !items.some(i => i.exercise_id === e.id))
            .map(e => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
        </select>
        <button
          className="secondary"
          disabled={!adding}
          onClick={() => {
            setItems(current => [...current, { exercise_id: adding, reps: 10, hold_seconds: 10 }]);
            setAdding('');
          }}>
          Add
        </button>
        <span className="spacer" />
        <span className="muted">{status}</span>
        <button disabled={!dirty} onClick={save}>
          Save list
        </button>
      </div>
    </div>
  );
}

// --- Reports -------------------------------------------------------------------

function ReportsSection({ patient, doctors }: { patient: Patient; doctors: Doctor[] }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [kind, setKind] = useState<'pdf' | 'photos'>('pdf');
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dayKey(new Date()));
  const [doctorId, setDoctorId] = useState(patient.doctor_id ?? '');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reports')
      .select('*')
      .eq('patient_id', patient.id)
      .order('report_date', { ascending: false });
    setReports((data ?? []) as Report[]);
  }, [patient.id]);

  useEffect(() => {
    load();
  }, [load]);

  const doctorName = (doctorIdValue: string) => {
    const doctor = doctors.find(d => d.id === doctorIdValue);
    return doctor ? doctorLabel(doctor, doctors) : 'Doctor';
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!files.length || !doctorId || (kind === 'pdf' && !title.trim())) {
      setStatus('Choose the file(s), the doctor and (for a PDF) a title.');
      return;
    }
    setStatus('Uploading…');
    try {
      const stamp = Date.now();
      const rows = [];
      for (const [i, file] of files.entries()) {
        const path = `${patient.id}/reports/${stamp}-${i}.${extensionOf(file)}`;
        await upload('patient-files', path, file);
        rows.push({
          patient_id: patient.id,
          title: kind === 'pdf' ? title.trim() : '',
          report_date: date,
          doctor_id: doctorId,
          file_path: path,
          mime_type: file.type || 'application/octet-stream',
          file_name: file.name,
        });
      }
      must(await supabase.from('reports').insert(rows));
      setFiles([]);
      setTitle('');
      setStatus('Added');
      load();
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  const open = async (report: Report) => {
    const { data } = await supabase.storage
      .from('patient-files')
      .createSignedUrl(report.file_path, 600);
    if (data) {
      window.open(data.signedUrl, '_blank', 'noopener');
    }
  };

  const remove = async (report: Report) => {
    if (!confirm(`Delete ${report.title || 'this photo'}?`)) {
      return;
    }
    try {
      must(await supabase.from('reports').delete().eq('id', report.id));
      await supabase.storage.from('patient-files').remove([report.file_path]);
      load();
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  return (
    <div className="card">
      <h2>Reports</h2>
      <form onSubmit={add} className="notice">
        <div className="row">
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={kind === 'pdf'} onChange={() => setKind('pdf')} /> One PDF
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <input type="radio" checked={kind === 'photos'} onChange={() => setKind('photos')} />{' '}
            Photos (no title)
          </label>
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <label>
            {kind === 'pdf' ? 'PDF file' : 'Photos'}
            <input
              type="file"
              accept={kind === 'pdf' ? 'application/pdf' : 'image/*'}
              multiple={kind === 'photos'}
              onChange={e => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          {kind === 'pdf' && (
            <label>
              Title
              <input value={title} onChange={e => setTitle(e.target.value)} />
            </label>
          )}
          <label>
            Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label>
            Issuing doctor
            <select value={doctorId} onChange={e => setDoctorId(e.target.value)}>
              <option value="">— choose —</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>
                  {doctorLabel(d, doctors)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button>Add to patient</button>
          <span className="muted">{status}</span>
        </div>
      </form>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Doctor</th>
            <th>Document</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id}>
              <td>{r.report_date}</td>
              <td>{doctorName(r.doctor_id)}</td>
              <td>
                <button className="link" onClick={() => open(r)}>
                  {r.mime_type.startsWith('image/') ? `Photo (${r.file_name ?? 'image'})` : r.title}
                </button>
              </td>
              <td>
                <button className="link" onClick={() => remove(r)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {reports.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No reports yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- Tracking ------------------------------------------------------------------

function TrackingSection({ patient }: { patient: Patient }) {
  const now = new Date();
  const [month, setMonth] = useState({ year: now.getFullYear(), index: now.getMonth() });
  const [days, setDays] = useState<ExerciseDay[]>([]);

  useEffect(() => {
    supabase
      .from('exercise_days')
      .select('day, status')
      .eq('patient_id', patient.id)
      .then(({ data }) => setDays((data ?? []) as ExerciseDay[]));
  }, [patient.id]);

  const today = dayKey(now);
  const signupDay = dayKey(new Date(patient.created_at));
  const set = new Set(days.map(d => d.day));
  const { cells, exercised, counted, leading } = monthDots(
    month.year,
    month.index,
    days,
    signupDay,
    today,
  );
  const shift = (delta: number) => {
    const total = month.year * 12 + month.index + delta;
    setMonth({ year: Math.floor(total / 12), index: total % 12 });
  };

  return (
    <div className="card">
      <h2>Tracking</h2>
      <div className="row">
        <span className="badge">Current streak: {currentStreak(set, today)} days</span>
        <span className="badge">Best streak: {longestStreak(set)} days</span>
        <span className="badge">
          {exercised} of {counted} days in {MONTHS[month.index]}
        </span>
      </div>
      <div className="row" style={{ margin: '12px 0' }}>
        <button className="link" onClick={() => shift(-1)}>
          ←
        </button>
        <strong>
          {MONTHS[month.index]} {month.year}
        </strong>
        <button
          className="link"
          onClick={() => shift(1)}
          disabled={month.year === now.getFullYear() && month.index === now.getMonth()}>
          →
        </button>
      </div>
      <div className="calendar">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="muted">
            {d}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {cells.map(cell => (
          <div key={cell.day}>
            {cell.day}
            <span className="dot" style={{ background: cell.color ?? 'transparent' }} />
          </div>
        ))}
      </div>
      <p className="muted">Green: all done · Orange: some skipped · Red: none</p>
    </div>
  );
}

// --- Account -------------------------------------------------------------------

function AccountSection({
  patient,
  onDeleted,
  onChanged,
}: {
  patient: Patient;
  onDeleted: () => void;
  onChanged: () => void;
}) {
  const [code, setCode] = useState<{ setup_code: string; expires_at: string } | null>(null);
  const [status, setStatus] = useState('');

  const newCode = async () => {
    if (
      patient.activated_at &&
      !confirm(
        'Create a new code? The patient uses it to link a new Google account (for example on a new phone).',
      )
    ) {
      return;
    }
    try {
      setCode(await clinicPatients({ action: 'new-code', patient_id: patient.id }));
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  /** Removes the Google link; the patient then needs a new code to link an account again. */
  const unlinkGoogle = async () => {
    if (!confirm(`Unlink ${patient.google_email ?? 'the Google account'} from ${patient.full_name}?`)) {
      return;
    }
    try {
      must(
        await supabase
          .from('patients')
          .update({ google_user_id: null, google_email: null })
          .eq('id', patient.id),
      );
      onChanged();
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  const remove = async () => {
    const typed = prompt(
      `This permanently deletes ${patient.full_name}'s account, exercise history and reports.\nType the mobile number to confirm:`,
    );
    if (typed !== patient.mobile) {
      return;
    }
    try {
      await clinicPatients({ action: 'delete', patient_id: patient.id });
      onDeleted();
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  return (
    <div className="card">
      <h2>Account</h2>
      <p>
        {patient.activated_at
          ? `Activated on ${new Date(patient.activated_at).toLocaleDateString()}. Consent given ${
              patient.consent_at ? new Date(patient.consent_at).toLocaleDateString() : '—'
            }.`
          : 'Not activated yet: the patient still needs to enter the setup code in the app.'}
      </p>
      <p>
        Google account:{' '}
        {patient.google_email ? (
          <>
            <strong>{patient.google_email}</strong>{' '}
            <button className="link" onClick={unlinkGoogle}>
              Unlink
            </button>
          </>
        ) : (
          <span className="muted">not linked yet</span>
        )}
      </p>
      {code && (
        <SetupCodeNotice code={code.setup_code} expiresAt={code.expires_at} mobile={patient.mobile} />
      )}
      <div className="row">
        <button className="secondary" onClick={newCode}>
          {patient.activated_at ? 'New phone / Google account: create new code' : 'Create new setup code'}
        </button>
        <span className="spacer" />
        <button className="danger" onClick={remove}>
          Delete patient
        </button>
      </div>
      {status && <div className="error">{status}</div>}
    </div>
  );
}
