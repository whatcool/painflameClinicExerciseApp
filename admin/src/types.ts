export type Gender = 'Male' | 'Female' | 'Other';

export type Patient = {
  id: string;
  mobile: string;
  full_name: string;
  gender: Gender;
  dob: string;
  photo_path: string | null;
  doctor_id: string | null;
  can_edit_exercises: boolean;
  counttill_tour_done: boolean;
  consent_at: string | null;
  activated_at: string | null;
  google_email: string | null; // Google account linked in app 1.2+
  google_user_id: string | null;
  created_at: string;
};

export type Doctor = {
  id: string;
  full_name: string;
  contact: string;
  photo_path: string | null;
  start_month: number;
  start_year: number;
};

export type Exercise = {
  id: string;
  name: string;
  description: string;
  image_paths: string[];
  thumbnail_index: number;
  video_path: string | null;
  active: boolean;
};

export type ListItem = { exercise_id: string; reps: number; hold_seconds: number };

export type Report = {
  id: string;
  title: string;
  report_date: string;
  doctor_id: string;
  file_path: string;
  mime_type: string;
  file_name: string | null;
};

export type ExerciseDay = { day: string; status: 'complete' | 'partial' };

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
