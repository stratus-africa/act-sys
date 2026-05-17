
-- ============ CARE PLAN TASKS ============
CREATE TABLE public.care_plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  title TEXT NOT NULL,
  category TEXT,
  frequency TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.care_plan_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpt_admin_rn ON public.care_plan_tasks FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));
CREATE POLICY cpt_caregiver_select ON public.care_plan_tasks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'caregiver') AND is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY cpt_patient_select ON public.care_plan_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER touch_cpt BEFORE UPDATE ON public.care_plan_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ TASK COMPLETIONS ============
CREATE TABLE public.task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.care_plan_tasks(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL,
  completed_by UUID,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tc_admin_rn ON public.task_completions FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));
CREATE POLICY tc_caregiver_select ON public.task_completions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'caregiver') AND is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY tc_caregiver_insert ON public.task_completions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'caregiver') AND is_assigned_to_patient(auth.uid(), patient_id) AND completed_by = auth.uid());
CREATE POLICY tc_patient_select ON public.task_completions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

-- ============ VISITS ============
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  staff_id UUID,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  visit_type TEXT NOT NULL DEFAULT 'routine',
  status TEXT NOT NULL DEFAULT 'scheduled',
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY visits_admin_rn ON public.visits FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));
CREATE POLICY visits_caregiver_select ON public.visits FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'caregiver') AND (staff_id = auth.uid() OR is_assigned_to_patient(auth.uid(), patient_id)));
CREATE POLICY visits_caregiver_update ON public.visits FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'caregiver') AND staff_id = auth.uid());
CREATE POLICY visits_patient_select ON public.visits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER touch_visits BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PATIENT DOCUMENTS ============
CREATE TABLE public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  category TEXT,
  uploaded_by UUID,
  signature_url TEXT,
  signature_typed TEXT,
  signed_by UUID,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdocs_admin_rn ON public.patient_documents FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));
CREATE POLICY pdocs_caregiver_select ON public.patient_documents FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'caregiver') AND is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY pdocs_caregiver_insert ON public.patient_documents FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'caregiver') AND is_assigned_to_patient(auth.uid(), patient_id) AND uploaded_by = auth.uid());
CREATE POLICY pdocs_patient_select ON public.patient_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY pdoc_storage_admin_rn_all ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'patient-documents' AND current_user_has_any_role(ARRAY['admin'::app_role, 'rn'::app_role]));
CREATE POLICY pdoc_storage_caregiver_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patient-documents' AND has_role(auth.uid(), 'caregiver') AND is_assigned_to_patient(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY pdoc_storage_caregiver_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-documents' AND has_role(auth.uid(), 'caregiver') AND is_assigned_to_patient(auth.uid(), ((storage.foldername(name))[1])::uuid));
CREATE POLICY pdoc_storage_patient_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'patient-documents' AND EXISTS (SELECT 1 FROM patients p WHERE p.id = ((storage.foldername(name))[1])::uuid AND p.user_id = auth.uid()));
