
-- Extend profiles with HR fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS ssn_last4 text,
  ADD COLUMN IF NOT EXISTS hire_date date,
  ADD COLUMN IF NOT EXISTS termination_date date,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS pay_type text,
  ADD COLUMN IF NOT EXISTS pay_rate numeric,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text,
  ADD COLUMN IF NOT EXISTS counties_willing text[],
  ADD COLUMN IF NOT EXISTS availability jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hr_notes text;

-- Staff credentials (certs, TB, Hep B, physical, etc.)
CREATE TABLE IF NOT EXISTS public.staff_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  kind text NOT NULL, -- 'license', 'tb_test', 'hepatitis_b', 'physical', 'cpr', 'bls', 'driver_license', 'auto_insurance', 'other'
  name text NOT NULL,
  number text,
  issued_on date,
  expires_on date,
  status text NOT NULL DEFAULT 'active', -- active, expired, declined
  file_path text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY sc_admin_all ON public.staff_credentials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY sc_self_select ON public.staff_credentials FOR SELECT TO authenticated
  USING (staff_id = auth.uid());
CREATE TRIGGER sc_touch BEFORE UPDATE ON public.staff_credentials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS sc_staff_idx ON public.staff_credentials(staff_id);

-- Applicants (hiring pipeline)
CREATE TABLE IF NOT EXISTS public.applicants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  dob date,
  ssn_last4 text,
  position text NOT NULL, -- 'rn', 'pca', 'caregiver', 'other'
  source text,
  applied_at date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'applied', -- applied, screening, background, interview, offer, hired, rejected, withdrawn
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  counties_willing text[],
  availability jsonb DEFAULT '{}'::jsonb,
  pay_agreement text,
  interviewer text,
  hired_user_id uuid, -- profiles.id once converted to staff
  hired_at timestamptz,
  rejection_reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY appl_admin_rn ON public.applicants FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));
CREATE TRIGGER appl_touch BEFORE UPDATE ON public.applicants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Applicant onboarding documents (each form: criminal bg, lifting, ethics, confidentiality, hep b, tb, training, refs)
CREATE TABLE IF NOT EXISTS public.applicant_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  kind text NOT NULL, -- 'application', 'criminal_background', 'lifting_agreement', 'at_will', 'ethics', 'confidentiality', 'hepatitis_b', 'tb_review', 'health_certificate', 'training_ack', 'reference_check', 'w4', 'w9', 'contractor_agreement', 'background_check', 'other'
  status text NOT NULL DEFAULT 'pending', -- pending, completed, declined, expired
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  signature_url text,
  signature_typed text,
  signed_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.applicant_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY ad_admin_rn ON public.applicant_documents FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));
CREATE TRIGGER ad_touch BEFORE UPDATE ON public.applicant_documents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS ad_applicant_idx ON public.applicant_documents(applicant_id);

-- Applicant skills checklist (PCA skills with 1-4 ratings)
CREATE TABLE IF NOT EXISTS public.applicant_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  checklist_kind text NOT NULL DEFAULT 'pca', -- 'pca', 'rn'
  ratings jsonb NOT NULL DEFAULT '{}'::jsonb, -- { skill_key: 1|2|3|4 }
  rn_supervisor_name text,
  observed_at date,
  signature_url text,
  signature_typed text,
  signed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.applicant_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY as_admin_rn ON public.applicant_skills FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));
CREATE TRIGGER as_touch BEFORE UPDATE ON public.applicant_skills FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS as_applicant_idx ON public.applicant_skills(applicant_id);

-- Storage bucket for HR / applicant files
INSERT INTO storage.buckets (id, name, public)
VALUES ('hr-documents', 'hr-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY hr_docs_admin_rn_all ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'hr-documents' AND public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]))
  WITH CHECK (bucket_id = 'hr-documents' AND public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));
