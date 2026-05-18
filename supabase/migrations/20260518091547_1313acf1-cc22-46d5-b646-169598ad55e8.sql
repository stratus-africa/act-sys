
-- Goals
CREATE TABLE public.care_plan_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  priority text NOT NULL DEFAULT 'medium',
  target_date date,
  status text NOT NULL DEFAULT 'active',
  source_assessment_type text,
  source_assessment_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.care_plan_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpg_admin_rn ON public.care_plan_goals
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));

CREATE POLICY cpg_caregiver_select ON public.care_plan_goals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'caregiver'::app_role) AND public.is_assigned_to_patient(auth.uid(), patient_id));

CREATE POLICY cpg_patient_select ON public.care_plan_goals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = care_plan_goals.patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER care_plan_goals_touch BEFORE UPDATE ON public.care_plan_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_cpg_patient ON public.care_plan_goals(patient_id);

-- Interventions
CREATE TABLE public.care_plan_interventions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.care_plan_goals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  description text NOT NULL,
  frequency text,
  assigned_role text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.care_plan_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpi_admin_rn ON public.care_plan_interventions
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));

CREATE POLICY cpi_caregiver_select ON public.care_plan_interventions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'caregiver'::app_role) AND public.is_assigned_to_patient(auth.uid(), patient_id));

CREATE POLICY cpi_patient_select ON public.care_plan_interventions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = care_plan_interventions.patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER care_plan_interventions_touch BEFORE UPDATE ON public.care_plan_interventions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_cpi_goal ON public.care_plan_interventions(goal_id);
CREATE INDEX idx_cpi_patient ON public.care_plan_interventions(patient_id);

-- Progress
CREATE TABLE public.care_plan_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.care_plan_goals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  note text NOT NULL,
  status text NOT NULL DEFAULT 'progressing',
  recorded_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.care_plan_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpp_admin_rn ON public.care_plan_progress
  FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));

CREATE POLICY cpp_caregiver_select ON public.care_plan_progress
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'caregiver'::app_role) AND public.is_assigned_to_patient(auth.uid(), patient_id));

CREATE POLICY cpp_caregiver_insert ON public.care_plan_progress
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'caregiver'::app_role) AND public.is_assigned_to_patient(auth.uid(), patient_id) AND recorded_by = auth.uid());

CREATE POLICY cpp_patient_select ON public.care_plan_progress
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = care_plan_progress.patient_id AND p.user_id = auth.uid()));

CREATE INDEX idx_cpp_goal ON public.care_plan_progress(goal_id);
CREATE INDEX idx_cpp_patient ON public.care_plan_progress(patient_id);
