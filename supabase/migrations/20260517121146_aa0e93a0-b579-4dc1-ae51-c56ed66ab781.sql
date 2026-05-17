
DROP POLICY IF EXISTS invites_lookup_by_token ON public.staff_invitations;

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE(id uuid, email text, role public.app_role, accepted_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, role, accepted_at
  FROM public.staff_invitations
  WHERE token = _token
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
