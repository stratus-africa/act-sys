
-- Visits enhancements
ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS start_miles numeric,
  ADD COLUMN IF NOT EXISTS end_miles numeric,
  ADD COLUMN IF NOT EXISTS caregiver_signature_url text,
  ADD COLUMN IF NOT EXISTS caregiver_signature_typed text,
  ADD COLUMN IF NOT EXISTS patient_signature_url text,
  ADD COLUMN IF NOT EXISTS patient_signature_typed text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Owner can view + update (mark read) + delete
CREATE POLICY notif_owner_select ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_owner_update ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY notif_owner_delete ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Any authenticated user (caregiver / RN / patient) can insert notifications
-- targeted at any user. The application code controls who is targeted.
CREATE POLICY notif_insert_any ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_notifications_user_unread
  ON public.notifications(user_id, read_at)
  WHERE read_at IS NULL;
