
CREATE TABLE public.skin_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  clinician_id uuid,
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'normal',
  pressure_areas jsonb NOT NULL DEFAULT '{}'::jsonb,
  markings jsonb NOT NULL DEFAULT '[]'::jsonb,
  general_notes text,
  clinician_signature_typed text,
  clinician_signature_url text,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skin_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY skin_admin_rn ON public.skin_assessments FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]));
CREATE POLICY skin_caregiver_select ON public.skin_assessments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY skin_patient_select ON public.skin_assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = skin_assessments.patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER skin_assessments_touch BEFORE UPDATE ON public.skin_assessments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.skin_assessment_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skin_assessment_id uuid NOT NULL REFERENCES public.skin_assessments(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  noted_at timestamptz NOT NULL DEFAULT now(),
  remarks text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skin_assessment_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY skinnotes_admin_rn ON public.skin_assessment_notes FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]));
CREATE POLICY skinnotes_caregiver_select ON public.skin_assessment_notes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY skinnotes_caregiver_insert ON public.skin_assessment_notes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id) AND created_by = auth.uid());
CREATE POLICY skinnotes_patient_select ON public.skin_assessment_notes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = skin_assessment_notes.patient_id AND p.user_id = auth.uid()));
