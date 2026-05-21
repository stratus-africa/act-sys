
-- 1) Audit trail for staff_credentials
DROP TRIGGER IF EXISTS staff_credentials_audit ON public.staff_credentials;
CREATE TRIGGER staff_credentials_audit
AFTER INSERT OR UPDATE OR DELETE ON public.staff_credentials
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- 2) Applicant stage history
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS stage_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3) Tighten EXECUTE on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_has_any_role(app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_assigned_to_patient(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
-- get_invitation_by_token must remain callable by anon (used on accept-invite before signup)
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_any_role(app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_assigned_to_patient(uuid, uuid) TO authenticated;
