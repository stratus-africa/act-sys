-- Per-patient timesheet support + form-shape fields
ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS patient_id uuid,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS employee_name text,
  ADD COLUMN IF NOT EXISTS comments text,
  ADD COLUMN IF NOT EXISTS days jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tasks jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS availability jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS employee_signature_url text,
  ADD COLUMN IF NOT EXISTS employee_signature_typed text,
  ADD COLUMN IF NOT EXISTS employee_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_signature_url text,
  ADD COLUMN IF NOT EXISTS client_signature_typed text,
  ADD COLUMN IF NOT EXISTS client_signed_at timestamptz;

-- Replace unique (staff,week) with (staff,week,patient)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timesheets_staff_id_week_start_key'
  ) THEN
    ALTER TABLE public.timesheets DROP CONSTRAINT timesheets_staff_id_week_start_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS timesheets_staff_week_patient_uidx
  ON public.timesheets (staff_id, week_start, COALESCE(patient_id, '00000000-0000-0000-0000-000000000000'::uuid));
