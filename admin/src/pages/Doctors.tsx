import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { errorText, extensionOf, must, publicUrl, supabase, upload } from '../supabase';
import { MONTHS, type Doctor } from '../types';

export function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [editing, setEditing] = useState<Doctor | 'new' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setDoctors(must(await supabase.from('doctors').select('*').order('full_name')) as Doctor[]);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (doctor: Doctor) => {
    if (!confirm(`Delete ${doctor.full_name}?`)) {
      return;
    }
    const { error: deleteError } = await supabase.from('doctors').delete().eq('id', doctor.id);
    if (deleteError) {
      setError(
        deleteError.code === '23503'
          ? `${doctor.full_name} issued reports, so they can't be deleted.`
          : deleteError.message,
      );
      return;
    }
    if (doctor.photo_path) {
      await supabase.storage.from('doctor-photos').remove([doctor.photo_path]);
    }
    load();
  };

  if (editing) {
    return (
      <DoctorForm
        doctor={editing === 'new' ? null : editing}
        onDone={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <>
      <div className="row">
        <h1>Doctors</h1>
        <span className="spacer" />
        <button onClick={() => setEditing('new')}>+ New doctor</button>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th />
              <th>Name</th>
              <th>Contact</th>
              <th>At Painflame since</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {doctors.map(d => (
              <tr key={d.id}>
                <td>
                  {d.photo_path ? (
                    <img className="avatar" src={publicUrl('doctor-photos', d.photo_path)!} alt="" />
                  ) : (
                    <div className="avatar" />
                  )}
                </td>
                <td>
                  <strong>{d.full_name}</strong>
                </td>
                <td>{d.contact}</td>
                <td>
                  {MONTHS[d.start_month - 1]} {d.start_year}
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="link" onClick={() => setEditing(d)}>
                    Edit
                  </button>
                  <button className="link" onClick={() => remove(d)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {doctors.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  No doctors yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DoctorForm({ doctor, onDone }: { doctor: Doctor | null; onDone: () => void }) {
  const now = new Date();
  const [form, setForm] = useState({
    full_name: doctor?.full_name ?? '',
    contact: doctor?.contact ?? '',
    start_month: doctor?.start_month ?? now.getMonth() + 1,
    start_year: doctor?.start_year ?? now.getFullYear(),
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\+?\d{10,13}$/.test(form.contact.replace(/\s/g, ''))) {
      setStatus('Enter a valid contact number.');
      return;
    }
    setStatus('Saving…');
    try {
      const fields: Record<string, unknown> = { ...form, full_name: form.full_name.trim() };
      if (photo) {
        fields.photo_path = await upload('doctor-photos', `${Date.now()}.${extensionOf(photo)}`, photo);
      }
      must(
        doctor
          ? await supabase.from('doctors').update(fields).eq('id', doctor.id)
          : await supabase.from('doctors').insert(fields),
      );
      onDone();
    } catch (e) {
      setStatus(errorText(e));
    }
  };

  const preview = photo
    ? URL.createObjectURL(photo)
    : publicUrl('doctor-photos', doctor?.photo_path ?? null);

  return (
    <form className="card" onSubmit={save}>
      <h1>{doctor ? doctor.full_name : 'New doctor'}</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        {preview ? <img className="avatar" src={preview} alt="" /> : <div className="avatar" />}
        <label>
          Photo
          <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
        </label>
      </div>
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
          Contact number
          <input
            value={form.contact}
            onChange={e => setForm({ ...form, contact: e.target.value })}
            required
          />
        </label>
        <label>
          Working at Painflame since (month)
          <select
            value={form.start_month}
            onChange={e => setForm({ ...form, start_month: Number(e.target.value) })}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <input
            type="number"
            min={1950}
            max={now.getFullYear()}
            value={form.start_year}
            onChange={e => setForm({ ...form, start_year: Number(e.target.value) })}
            style={{ width: 120 }}
          />
        </label>
      </div>
      {status && <div className="error">{status}</div>}
      <div className="row" style={{ marginTop: 16 }}>
        <button>Save doctor</button>
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
