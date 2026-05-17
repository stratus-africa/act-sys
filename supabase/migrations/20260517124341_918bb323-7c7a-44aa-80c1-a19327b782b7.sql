
-- 1. Per-user view preferences (skin Front/Back per patient, etc.)
CREATE TABLE public.user_view_preferences (
  user_id UUID NOT NULL,
  scope TEXT NOT NULL,
  entity_id UUID NOT NULL,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope, entity_id)
);
ALTER TABLE public.user_view_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY uvp_self_all ON public.user_view_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER uvp_touch BEFORE UPDATE ON public.user_view_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. RN assessments
CREATE TABLE public.rn_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  nurse_id UUID,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks JSONB NOT NULL DEFAULT '{}'::jsonb,
  general_notes TEXT,
  nurse_name TEXT,
  patient_name TEXT,
  nurse_signature_typed TEXT,
  nurse_signature_url TEXT,
  patient_signature_typed TEXT,
  patient_signature_url TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rn_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY rna_admin_rn_all ON public.rn_assessments
  FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]));

CREATE POLICY rna_caregiver_select ON public.rn_assessments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id));

CREATE POLICY rna_patient_select ON public.rn_assessments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = rn_assessments.patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER rna_touch BEFORE UPDATE ON public.rn_assessments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_rn_assessments_patient ON public.rn_assessments(patient_id);
CREATE INDEX idx_rn_assessments_nurse ON public.rn_assessments(nurse_id);
