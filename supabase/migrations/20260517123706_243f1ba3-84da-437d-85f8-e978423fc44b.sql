CREATE TABLE public.caregiver_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  caregiver_id uuid,
  nurse_id uuid,
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  caregiver_name text,
  nurse_name text,
  tasks jsonb NOT NULL DEFAULT '{}'::jsonb,
  general_notes text,
  nurse_signature_typed text,
  nurse_signature_url text,
  caregiver_signature_typed text,
  caregiver_signature_url text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caregiver_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY cga_admin_rn ON public.caregiver_assessments
  FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));

CREATE POLICY cga_caregiver_self_select ON public.caregiver_assessments
  FOR SELECT TO authenticated
  USING (caregiver_id = auth.uid());

CREATE POLICY cga_patient_select ON public.caregiver_assessments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = caregiver_assessments.patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER touch_cga_updated_at BEFORE UPDATE ON public.caregiver_assessments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX cga_patient_idx ON public.caregiver_assessments(patient_id, service_date DESC);
CREATE INDEX cga_caregiver_idx ON public.caregiver_assessments(caregiver_id, service_date DESC);