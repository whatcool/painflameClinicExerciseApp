import { cacheLibrary } from '../data/exerciseLibrary';
import { cacheDoctors, type Doctor } from '../db/doctors';
import { cacheExerciseList } from '../db/exerciseList';
import { cacheReports } from '../db/reports';
import {
  cacheExerciseDays,
  getUnsyncedDays,
  markDaySynced,
  type DayStatus,
} from '../db/tracking';
import { cachePatient, type ServerPatient } from '../db/users';
import { addDays, toDayKey } from '../utils/date';
import { publicUrl, supabase, type Client } from './supabase';

const PHOTO_URL_SECONDS = 7 * 24 * 3600;
const TRACKING_DAYS = 730;

let inFlight: Promise<void> | null = null;

/**
 * Brings the phone's cache up to date with Supabase for the signed-in patient.
 * Throws when offline; callers usually ignore that and keep showing cached data.
 */
export function syncPatient(patientId: string): Promise<void> {
  if (!inFlight) {
    inFlight = doSync(patientId).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

const must = <T>(result: { data: T | null; error: unknown }): T => {
  if (result.error) {
    throw result.error;
  }
  return result.data as T;
};

async function doSync(patientId: string) {
  // Send days recorded offline first, so the server copy below already includes them.
  await flushExerciseDays(patientId);

  const since = addDays(toDayKey(new Date()), -TRACKING_DAYS);
  const [patient, doctors, exercises, list, reports, days] = await Promise.all([
    supabase.from('patients').select('*').eq('id', patientId).single(),
    supabase.from('doctors').select('*'),
    supabase.from('exercises').select('*'),
    supabase
      .from('patient_exercises')
      .select('exercise_id, reps, hold_seconds')
      .eq('patient_id', patientId)
      .order('position'),
    supabase
      .from('reports')
      .select('id, title, report_date, doctor_id, file_path, mime_type, file_name, doctor:doctors(full_name)')
      .eq('patient_id', patientId),
    supabase.from('exercise_days').select('day, status').eq('patient_id', patientId).gte('day', since),
  ]);

  const serverPatient = must<ServerPatient>(patient);
  const photoUrl = await signedPhotoUrl(supabase, serverPatient.photo_path);
  cachePatient(serverPatient, photoUrl);

  cacheDoctors(must<ServerDoctor[]>(doctors).map(toDoctor));

  cacheLibrary(
    must<ServerExercise[]>(exercises).map(e => ({
      id: e.id,
      name: e.name,
      description: e.description ?? '',
      imageUrls: e.image_paths.map(path => publicUrl('exercise-media', path)!),
      thumbnailIndex: e.thumbnail_index,
      videoUrl: publicUrl('exercise-media', e.video_path),
      active: e.active,
    })),
  );

  cacheExerciseList(
    patientId,
    must<{ exercise_id: string; reps: number; hold_seconds: number }[]>(list).map(item => ({
      exerciseId: item.exercise_id,
      reps: item.reps,
      holdSeconds: item.hold_seconds,
    })),
  );

  cacheReports(
    patientId,
    must<ServerReport[]>(reports as never).map(r => ({
      id: r.id,
      title: r.title,
      reportDate: r.report_date,
      doctorId: r.doctor_id,
      doctorName: (Array.isArray(r.doctor) ? r.doctor[0] : r.doctor)?.full_name ?? 'Doctor',
      filePath: r.file_path,
      mimeType: r.mime_type,
      fileName: r.file_name,
    })),
  );

  cacheExerciseDays(patientId, must<{ day: string; status: DayStatus }[]>(days));
}

/** Sends exercise days recorded on this phone. Safe to call often. */
export async function flushExerciseDays(patientId: string) {
  for (const { day, status } of getUnsyncedDays(patientId)) {
    const { error } = await supabase.rpc('record_exercise_day', { p_day: day, p_status: status });
    if (error) {
      throw error;
    }
    markDaySynced(patientId, day);
  }
}

export async function signedPhotoUrl(client: Client, path: string | null) {
  if (!path) {
    return null;
  }
  const { data } = await client.storage
    .from('patient-files')
    .createSignedUrl(path, PHOTO_URL_SECONDS);
  return data?.signedUrl ?? null;
}

export type ServerDoctor = {
  id: string;
  full_name: string;
  contact: string;
  photo_path: string | null;
  start_month: number;
  start_year: number;
};

type ServerExercise = {
  id: string;
  name: string;
  description?: string; // added in migration 20261012; older servers lack it
  image_paths: string[];
  thumbnail_index: number;
  video_path: string | null;
  active: boolean;
};

type ServerReport = {
  id: string;
  title: string;
  report_date: string;
  doctor_id: string;
  file_path: string;
  mime_type: string;
  file_name: string | null;
  // A many-to-one embed is an object at runtime; the generated type says array.
  doctor: { full_name: string } | { full_name: string }[] | null;
};

export const toDoctor = (d: ServerDoctor): Doctor => ({
  id: d.id,
  fullName: d.full_name,
  contact: d.contact,
  photoUrl: publicUrl('doctor-photos', d.photo_path),
  startMonth: d.start_month,
  startYear: d.start_year,
});
