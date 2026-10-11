-- Painflame Clinic: initial schema.
--
-- Who can do what:
--   * Patients sign in through the patient-login Edge Function and only ever see their own rows.
--   * The shared clinic login (a Supabase Auth user with app_metadata.role = 'clinic')
--     manages everything: patients, doctors, the exercise library, lists and reports.
--   * Login secrets (setup codes, failed-login counters) are readable by Edge Functions only.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- True when the request comes from the shared clinic login.
create or replace function public.is_clinic()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'clinic', false)
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  contact text not null,
  photo_path text, -- object path in the public 'doctor-photos' bucket
  start_month smallint not null check (start_month between 1 and 12),
  start_year smallint not null check (start_year between 1950 and 2100),
  created_at timestamptz not null default now()
);

-- The Exercise Library. Ids are stored in patients' lists, so never reuse one.
create table public.exercises (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null check (length(trim(name)) > 0),
  image_paths text[] not null default '{}', -- public 'exercise-media' bucket
  thumbnail_index smallint not null default 0,
  video_path text, -- 5-second clip, public 'exercise-media' bucket
  active boolean not null default true, -- inactive = hidden from "Add exercise"
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key references auth.users (id) on delete cascade,
  mobile text not null unique check (mobile ~ '^[6-9][0-9]{9}$'),
  full_name text not null check (length(trim(full_name)) > 0),
  gender text not null check (gender in ('Male', 'Female', 'Other')),
  dob date not null,
  photo_path text, -- private 'patient-files' bucket: <patient id>/profile/...
  doctor_id uuid references public.doctors (id) on delete set null,
  -- Only therapists edit exercise lists, unless they unlock it for the patient.
  can_edit_exercises boolean not null default false,
  counttill_tour_done boolean not null default false,
  consent_at timestamptz, -- DPDP consent given when the patient activated the account
  activated_at timestamptz, -- null until the patient sets a PIN with the clinic's code
  created_at timestamptz not null default now()
);

-- Login secrets. RLS is on with no policies, so only the service role (Edge Functions) can read it.
create table public.patient_secrets (
  patient_id uuid primary key references public.patients (id) on delete cascade,
  setup_code_hash text,
  setup_code_expires_at timestamptz,
  setup_attempts int not null default 0,
  failed_logins int not null default 0,
  locked_until timestamptz
);

create table public.patient_exercises (
  id bigint generated always as identity primary key,
  patient_id uuid not null references public.patients (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  position int not null,
  reps int not null check (reps between 1 and 99),
  hold_seconds int not null check (hold_seconds between 1 and 120),
  unique (patient_id, position)
);

-- A document is either one titled PDF or untitled photos (one row per photo).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  title text not null default '',
  report_date date not null,
  doctor_id uuid not null references public.doctors (id),
  file_path text not null, -- private 'patient-files' bucket: <patient id>/reports/...
  mime_type text not null,
  file_name text,
  created_at timestamptz not null default now()
);

create index reports_patient_date on public.reports (patient_id, report_date desc);

-- One row per day the patient exercised. No row = nothing done (red dot).
create table public.exercise_days (
  patient_id uuid not null references public.patients (id) on delete cascade,
  day date not null,
  status text not null check (status in ('complete', 'partial')),
  updated_at timestamptz not null default now(),
  primary key (patient_id, day)
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.doctors enable row level security;
alter table public.exercises enable row level security;
alter table public.patients enable row level security;
alter table public.patient_secrets enable row level security;
alter table public.patient_exercises enable row level security;
alter table public.reports enable row level security;
alter table public.exercise_days enable row level security;

-- Doctors and the exercise library: anyone signed in reads, the clinic writes.
create policy "signed-in users read doctors" on public.doctors
  for select to authenticated using (true);
create policy "clinic manages doctors" on public.doctors
  for all to authenticated using (public.is_clinic()) with check (public.is_clinic());

create policy "signed-in users read exercises" on public.exercises
  for select to authenticated using (true);
create policy "clinic manages exercises" on public.exercises
  for all to authenticated using (public.is_clinic()) with check (public.is_clinic());

-- Patients: own row, or everything for the clinic. Rows are created and deleted
-- only by the clinic-patients Edge Function.
create policy "patients read own row; clinic reads all" on public.patients
  for select to authenticated using (id = auth.uid() or public.is_clinic());
create policy "patients update own row; clinic updates all" on public.patients
  for update to authenticated
  using (id = auth.uid() or public.is_clinic())
  with check (id = auth.uid() or public.is_clinic());

-- Exercise lists: read own / clinic. Writes go through save_exercise_list().
create policy "patients read own list; clinic reads all" on public.patient_exercises
  for select to authenticated using (patient_id = auth.uid() or public.is_clinic());

-- Reports: patients only view. Adding and deleting is clinic-only.
create policy "patients read own reports; clinic reads all" on public.reports
  for select to authenticated using (patient_id = auth.uid() or public.is_clinic());
create policy "clinic adds reports" on public.reports
  for insert to authenticated with check (public.is_clinic());
create policy "clinic edits reports" on public.reports
  for update to authenticated using (public.is_clinic()) with check (public.is_clinic());
create policy "clinic deletes reports" on public.reports
  for delete to authenticated using (public.is_clinic());

-- Tracking: read own / clinic. Patients write through record_exercise_day().
create policy "patients read own days; clinic reads all" on public.exercise_days
  for select to authenticated using (patient_id = auth.uid() or public.is_clinic());

-- Patients may edit their name, gender, date of birth, photo and tour flag, but not
-- their mobile number, doctor or the exercise-list permission.
create or replace function public.protect_patient_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated' and not public.is_clinic() then
    if new.id is distinct from old.id
      or new.mobile is distinct from old.mobile
      or new.doctor_id is distinct from old.doctor_id
      or new.can_edit_exercises is distinct from old.can_edit_exercises
      or new.activated_at is distinct from old.activated_at
      or new.consent_at is distinct from old.consent_at
      or new.created_at is distinct from old.created_at then
      raise exception 'Only the clinic can change this' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_patient_fields
  before update on public.patients
  for each row execute function public.protect_patient_fields();

-- ---------------------------------------------------------------------------
-- Functions called by the apps
-- ---------------------------------------------------------------------------

-- Replaces a patient's exercise list; the array order is the execution order.
-- Allowed for the clinic, or for the patient when the clinic has unlocked editing.
create or replace function public.save_exercise_list(p_patient uuid, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    public.is_clinic()
    or (
      p_patient = auth.uid()
      and exists (select 1 from public.patients where id = p_patient and can_edit_exercises)
    )
  ) then
    raise exception 'Not allowed to edit this exercise list' using errcode = '42501';
  end if;

  delete from public.patient_exercises where patient_id = p_patient;

  insert into public.patient_exercises (patient_id, exercise_id, position, reps, hold_seconds)
  select
    p_patient,
    item ->> 'exercise_id',
    (ord - 1)::int,
    (item ->> 'reps')::int,
    (item ->> 'hold_seconds')::int
  from jsonb_array_elements(p_items) with ordinality as e (item, ord);
end;
$$;

-- Records the signed-in patient's result for a day. A 'complete' day is never downgraded.
create or replace function public.record_exercise_day(p_day date, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.patients where id = auth.uid()) then
    raise exception 'Only patients record exercise days' using errcode = '42501';
  end if;
  if p_day > current_date + 1 then
    raise exception 'Cannot record a future day' using errcode = '22023';
  end if;

  insert into public.exercise_days (patient_id, day, status)
  values (auth.uid(), p_day, p_status)
  on conflict (patient_id, day) do update
    set status = case
          when public.exercise_days.status = 'complete' then 'complete'
          else excluded.status
        end,
        updated_at = now();
end;
$$;

revoke execute on function public.save_exercise_list(uuid, jsonb) from public, anon;
revoke execute on function public.record_exercise_day(date, text) from public, anon;
grant execute on function public.save_exercise_list(uuid, jsonb) to authenticated;
grant execute on function public.record_exercise_day(date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- File storage
-- ---------------------------------------------------------------------------

-- Exercise media and doctor photos are not sensitive: public buckets, clinic writes.
-- Patient files (reports, profile photos) are private.
insert into storage.buckets (id, name, public)
values
  ('exercise-media', 'exercise-media', true),
  ('doctor-photos', 'doctor-photos', true),
  ('patient-files', 'patient-files', false)
on conflict (id) do nothing;

create policy "clinic manages public media" on storage.objects
  for all to authenticated
  using (bucket_id in ('exercise-media', 'doctor-photos') and public.is_clinic())
  with check (bucket_id in ('exercise-media', 'doctor-photos') and public.is_clinic());

-- Patient files live under <patient id>/...; patients read their own folder.
create policy "patients read own files; clinic reads all" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'patient-files'
    and (public.is_clinic() or (storage.foldername(name))[1] = auth.uid()::text)
  );

-- The clinic uploads reports; patients may only manage their own profile photo.
create policy "clinic or own profile photo: upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'patient-files'
    and (
      public.is_clinic()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] = 'profile'
      )
    )
  );

create policy "clinic or own profile photo: change" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      public.is_clinic()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] = 'profile'
      )
    )
  );

create policy "clinic or own profile photo: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      public.is_clinic()
      or (
        (storage.foldername(name))[1] = auth.uid()::text
        and (storage.foldername(name))[2] = 'profile'
      )
    )
  );
