
CREATE TABLE public.patient_allergies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  allergen TEXT NOT NULL,
  category TEXT,
  reaction TEXT,
  severity TEXT NOT NULL DEFAULT 'mild',
  onset_date DATE,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY allergies_admin_rn ON public.patient_allergies
  FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]));

CREATE POLICY allergies_caregiver_select ON public.patient_allergies
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id));

CREATE POLICY allergies_patient_select ON public.patient_allergies
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = patient_allergies.patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER allergies_touch_updated_at
  BEFORE UPDATE ON public.patient_allergies
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_patient_allergies_patient ON public.patient_allergies(patient_id);
