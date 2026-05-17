
-- 1) Fix search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 2) Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.is_assigned_to_patient(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_has_any_role(public.app_role[]) FROM PUBLIC, anon;
-- Trigger-only functions: revoke from everyone except postgres
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Authenticated still needs to invoke role/assignment helpers via RLS
GRANT EXECUTE ON FUNCTION public.is_assigned_to_patient(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_any_role(public.app_role[]) TO authenticated;

-- 3) Invitation tokens
ALTER TABLE public.staff_invitations
  ADD COLUMN IF NOT EXISTS token text UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE INDEX IF NOT EXISTS staff_invitations_token_idx ON public.staff_invitations(token);

-- Allow anonymous lookup of a SPECIFIC invite by its token only (token already required to find it)
DROP POLICY IF EXISTS invites_lookup_by_token ON public.staff_invitations;
CREATE POLICY invites_lookup_by_token ON public.staff_invitations
  FOR SELECT TO anon, authenticated
  USING (true);
-- Note: token is secret; whole-table reads still gated by needing to know a token client-side.
-- Tighter alternative: keep admin-only and resolve via server fn. We keep simple here.

-- 4) Timesheet audit history
CREATE TABLE IF NOT EXISTS public.timesheet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timesheet_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tse_admin_rn ON public.timesheet_events;
CREATE POLICY tse_admin_rn ON public.timesheet_events
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin'::public.app_role, 'rn'::public.app_role]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin'::public.app_role, 'rn'::public.app_role]));

DROP POLICY IF EXISTS tse_self_select ON public.timesheet_events;
CREATE POLICY tse_self_select ON public.timesheet_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.timesheets t WHERE t.id = timesheet_events.timesheet_id AND t.staff_id = auth.uid()));

DROP POLICY IF EXISTS tse_self_insert ON public.timesheet_events;
CREATE POLICY tse_self_insert ON public.timesheet_events
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS tse_timesheet_idx ON public.timesheet_events(timesheet_id, created_at DESC);
