-- Version 1.2: patients sign in with Google instead of a PIN.
--
-- The clinic still creates each patient and gives them a one-time code. The first time
-- they sign in with Google, the app asks for their mobile number and that code, and the
-- link-google Edge Function links that Google account to the patient record. After that,
-- choosing the same Google account is all it takes to log in.
--
-- Rules below now ask "which patient is signed in?" through current_patient_id(), which
-- accepts both the original PIN-login account (patients.id, used by app 1.1) and the linked
-- Google account, so older app versions keep working until they update.

alter table public.patients
  add column if not exists google_user_id uuid unique references auth.users (id) on delete set null,
  add column if not exists google_email text;

-- The patient record of the signed-in user, or null. SECURITY DEFINER so that policies on
-- `patients` itself can use it without recursing into their own row level security.
create or replace function public.current_patient_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.patients
  where id = auth.uid() or google_user_id = auth.uid()
  limit 1
$$;

revoke execute on function public.current_patient_id() from public, anon;
grant execute on function public.current_patient_id() to authenticated;

-- --- Table policies --------------------------------------------------------------------

drop policy "patients read own row; clinic reads all" on public.patients;
create policy "patients read own row; clinic reads all" on public.patients
  for select to authenticated using (id = public.current_patient_id() or public.is_clinic());

drop policy "patients update own row; clinic updates all" on public.patients;
create policy "patients update own row; clinic updates all" on public.patients
  for update to authenticated
  using (id = public.current_patient_id() or public.is_clinic())
  with check (id = public.current_patient_id() or public.is_clinic());

drop policy "patients read own list; clinic reads all" on public.patient_exercises;
create policy "patients read own list; clinic reads all" on public.patient_exercises
  for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_clinic());

drop policy "patients read own reports; clinic reads all" on public.reports;
create policy "patients read own reports; clinic reads all" on public.reports
  for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_clinic());

drop policy "patients read own days; clinic reads all" on public.exercise_days;
create policy "patients read own days; clinic reads all" on public.exercise_days
  for select to authenticated
  using (patient_id = public.current_patient_id() or public.is_clinic());

-- Patients may not change which Google account is linked (only the link-google function
-- and the clinic can).
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
      or new.created_at is distinct from old.created_at
      or new.google_user_id is distinct from old.google_user_id
      or new.google_email is distinct from old.google_email then
      raise exception 'Only the clinic can change this' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- --- Functions called by the apps ----------------------------------------------------------

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
      p_patient = public.current_patient_id()
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

create or replace function public.record_exercise_day(p_day date, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient uuid := public.current_patient_id();
begin
  if v_patient is null then
    raise exception 'Only patients record exercise days' using errcode = '42501';
  end if;
  if p_day > current_date + 1 then
    raise exception 'Cannot record a future day' using errcode = '22023';
  end if;

  insert into public.exercise_days (patient_id, day, status)
  values (v_patient, p_day, p_status)
  on conflict (patient_id, day) do update
    set status = case
          when public.exercise_days.status = 'complete' then 'complete'
          else excluded.status
        end,
        updated_at = now();
end;
$$;

-- --- Storage policies ------------------------------------------------------------------------

drop policy "patients read own files; clinic reads all" on storage.objects;
create policy "patients read own files; clinic reads all" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      public.is_clinic()
      or (storage.foldername(name))[1] = public.current_patient_id()::text
    )
  );

drop policy "clinic or own profile photo: upload" on storage.objects;
create policy "clinic or own profile photo: upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'patient-files'
    and (
      public.is_clinic()
      or (
        (storage.foldername(name))[1] = public.current_patient_id()::text
        and (storage.foldername(name))[2] = 'profile'
      )
    )
  );

drop policy "clinic or own profile photo: change" on storage.objects;
create policy "clinic or own profile photo: change" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      public.is_clinic()
      or (
        (storage.foldername(name))[1] = public.current_patient_id()::text
        and (storage.foldername(name))[2] = 'profile'
      )
    )
  );

drop policy "clinic or own profile photo: delete" on storage.objects;
create policy "clinic or own profile photo: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'patient-files'
    and (
      public.is_clinic()
      or (
        (storage.foldername(name))[1] = public.current_patient_id()::text
        and (storage.foldername(name))[2] = 'profile'
      )
    )
  );
