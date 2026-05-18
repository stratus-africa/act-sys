
-- Patients: insurance details + photo
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS insurance_carrier text,
  ADD COLUMN IF NOT EXISTS insurance_policy text,
  ADD COLUMN IF NOT EXISTS insurance_group text,
  ADD COLUMN IF NOT EXISTS insurance_plan_type text,
  ADD COLUMN IF NOT EXISTS insurance_subscriber text,
  ADD COLUMN IF NOT EXISTS photo_url text;

-- Role permissions: admin-editable, all authenticated read
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role PRIMARY KEY,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY rp_read_all ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY rp_admin_write ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed defaults (one row per role; key=permission slug, value=bool)
INSERT INTO public.role_permissions (role, permissions) VALUES
  ('admin', '{"manage_staff":true,"assign_patients":true,"view_all_patients":true,"clinical_assessments":true,"manage_allergies_care":true,"document_visits":true,"submit_timesheets":true,"approve_timesheets":true,"view_own_patient":false}'::jsonb),
  ('rn', '{"manage_staff":false,"assign_patients":true,"view_all_patients":true,"clinical_assessments":true,"manage_allergies_care":true,"document_visits":true,"submit_timesheets":true,"approve_timesheets":true,"view_own_patient":false}'::jsonb),
  ('caregiver', '{"manage_staff":false,"assign_patients":false,"view_all_patients":false,"clinical_assessments":false,"manage_allergies_care":false,"document_visits":true,"submit_timesheets":true,"approve_timesheets":false,"view_own_patient":false}'::jsonb),
  ('patient', '{"manage_staff":false,"assign_patients":false,"view_all_patients":false,"clinical_assessments":false,"manage_allergies_care":false,"document_visits":false,"submit_timesheets":false,"approve_timesheets":false,"view_own_patient":true}'::jsonb)
ON CONFLICT (role) DO NOTHING;

-- Per-user alert acknowledgement state
CREATE TABLE IF NOT EXISTS public.user_alert_states (
  user_id uuid NOT NULL,
  alert_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('acknowledged','dismissed','resolved')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, alert_key)
);
ALTER TABLE public.user_alert_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY uas_self_all ON public.user_alert_states FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Allergy activity history
CREATE TABLE IF NOT EXISTS public.patient_allergy_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allergy_id uuid,
  patient_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_allergy_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY pae_admin_rn ON public.patient_allergy_events FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin'::public.app_role,'rn'::public.app_role]))
  WITH CHECK (public.current_user_has_any_role(ARRAY['admin'::public.app_role,'rn'::public.app_role]));
CREATE POLICY pae_caregiver_select ON public.patient_allergy_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'caregiver'::public.app_role) AND public.is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY pae_patient_select ON public.patient_allergy_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_allergy_events.patient_id AND p.user_id = auth.uid()));

-- Public bucket for patient photos
INSERT INTO storage.buckets (id, name, public) VALUES ('patient-photos','patient-photos', true)
ON CONFLICT (id) DO NOTHING;
CREATE POLICY "patient_photos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'patient-photos');
CREATE POLICY "patient_photos_staff_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'patient-photos' AND public.current_user_has_any_role(ARRAY['admin'::public.app_role,'rn'::public.app_role]));
CREATE POLICY "patient_photos_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'patient-photos' AND public.current_user_has_any_role(ARRAY['admin'::public.app_role,'rn'::public.app_role]));
CREATE POLICY "patient_photos_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'patient-photos' AND public.current_user_has_any_role(ARRAY['admin'::public.app_role,'rn'::public.app_role]));
