-- Instructions the clinic writes for each exercise, shown to patients between the exercise
-- name and the video during a session. Only the clinic can edit it (existing exercises policies).
alter table public.exercises
  add column if not exists description text not null default '';
