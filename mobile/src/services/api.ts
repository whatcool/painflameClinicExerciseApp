// Writes to Supabase, followed by an update of the phone's cache.
// `clinic` arguments are the short-lived clinic client from the therapist password gate.
import { cacheDoctor, cacheDoctors, type Doctor } from '../db/doctors';
import { cacheExerciseList, type PatientExercise } from '../db/exerciseList';
import { removeCachedReport, type Report } from '../db/reports';
import { updateCachedPatient, type Gender } from '../db/users';
import type { PickedFile } from './files';
import { fileExtension, supabase, uploadFile, type Client } from './supabase';
import { signedPhotoUrl, syncPatient, toDoctor, type ServerDoctor } from './sync';

const check = ({ error }: { error: unknown }) => {
  if (error) {
    throw error;
  }
};

// --- Patient (own account) ---

export async function updateProfile(
  patientId: string,
  changes: { full_name: string; gender: Gender; dob: string },
) {
  check(await supabase.from('patients').update(changes).eq('id', patientId));
  updateCachedPatient(patientId, changes);
}

export async function uploadProfilePhoto(patientId: string, file: PickedFile, oldPath: string | null) {
  const path = `${patientId}/profile/${Date.now()}.${fileExtension(file.name, file.mimeType)}`;
  await uploadFile(supabase, 'patient-files', path, file.uri, file.mimeType);
  check(await supabase.from('patients').update({ photo_path: path }).eq('id', patientId));
  if (oldPath) {
    await supabase.storage.from('patient-files').remove([oldPath]); // best effort
  }
  updateCachedPatient(patientId, {
    photo_path: path,
    photo_url: await signedPhotoUrl(supabase, path),
  });
}

export async function markTourDone(patientId: string) {
  updateCachedPatient(patientId, { counttill_tour_done: true });
  await supabase.from('patients').update({ counttill_tour_done: true }).eq('id', patientId);
}

/** A short-lived link to open a report (PDF or photo). */
export async function reportUrl(report: Report) {
  const { data, error } = await supabase.storage
    .from('patient-files')
    .createSignedUrl(report.filePath, 3600);
  if (error || !data) {
    throw error ?? new Error('No link');
  }
  return data.signedUrl;
}

// --- Exercise list ---

/** Saves with the patient's client (when unlocked) or the clinic client. */
export async function saveExerciseList(client: Client, patientId: string, items: PatientExercise[]) {
  check(
    await client.rpc('save_exercise_list', {
      p_patient: patientId,
      p_items: items.map(item => ({
        exercise_id: item.exerciseId,
        reps: item.reps,
        hold_seconds: item.holdSeconds,
      })),
    }),
  );
  cacheExerciseList(patientId, items);
}

export async function setPatientCanEdit(clinic: Client, patientId: string, canEdit: boolean) {
  check(await clinic.from('patients').update({ can_edit_exercises: canEdit }).eq('id', patientId));
  updateCachedPatient(patientId, { can_edit_exercises: canEdit });
}

// --- Doctors (clinic) ---

export async function fetchDoctors(client: Client): Promise<Doctor[]> {
  const { data, error } = await client.from('doctors').select('*').order('full_name');
  if (error) {
    throw error;
  }
  const doctors = (data as ServerDoctor[]).map(toDoctor);
  cacheDoctors(doctors);
  return doctors;
}

export type DoctorDraft = {
  id: string | null;
  fullName: string;
  contact: string;
  startMonth: number;
  startYear: number;
  newPhoto: PickedFile | null;
};

export async function saveDoctor(clinic: Client, draft: DoctorDraft): Promise<Doctor> {
  const fields: Record<string, unknown> = {
    full_name: draft.fullName,
    contact: draft.contact,
    start_month: draft.startMonth,
    start_year: draft.startYear,
  };
  if (draft.newPhoto) {
    const path = `${Date.now()}.${fileExtension(draft.newPhoto.name, draft.newPhoto.mimeType)}`;
    fields.photo_path = await uploadFile(
      clinic,
      'doctor-photos',
      path,
      draft.newPhoto.uri,
      draft.newPhoto.mimeType,
    );
  }
  const query = draft.id
    ? clinic.from('doctors').update(fields).eq('id', draft.id)
    : clinic.from('doctors').insert(fields);
  const { data, error } = await query.select('*').single();
  if (error) {
    throw error;
  }
  const doctor = toDoctor(data as ServerDoctor);
  cacheDoctor(doctor);
  return doctor;
}

export async function setPatientDoctor(clinic: Client, patientId: string, doctorId: string) {
  check(await clinic.from('patients').update({ doctor_id: doctorId }).eq('id', patientId));
  updateCachedPatient(patientId, { doctor_id: doctorId });
}

// --- Reports (clinic) ---

export async function addReports(
  clinic: Client,
  patientId: string,
  input: { files: PickedFile[]; title: string; reportDate: string; doctorId: string },
) {
  const stamp = Date.now();
  const rows = [];
  for (const [i, file] of input.files.entries()) {
    const path = `${patientId}/reports/${stamp}-${i}.${fileExtension(file.name, file.mimeType)}`;
    await uploadFile(clinic, 'patient-files', path, file.uri, file.mimeType);
    rows.push({
      patient_id: patientId,
      title: input.title,
      report_date: input.reportDate,
      doctor_id: input.doctorId,
      file_path: path,
      mime_type: file.mimeType,
      file_name: file.name,
    });
  }
  check(await clinic.from('reports').insert(rows));
  await syncPatient(patientId).catch(() => {});
}

export async function deleteReport(clinic: Client, report: Report) {
  check(await clinic.from('reports').delete().eq('id', report.id));
  await clinic.storage.from('patient-files').remove([report.filePath]); // best effort
  removeCachedReport(report.id);
}
