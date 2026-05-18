
-- ============================================================
-- Medications: lists + administration log
-- ============================================================
CREATE TABLE public.patient_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  name text NOT NULL,
  dose text,
  route text,
  frequency text,
  prn boolean NOT NULL DEFAULT false,
  prn_indication text,
  instructions text,
  start_date date,
  end_date date,
  active boolean NOT NULL DEFAULT true,
  prescriber text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_patient_medications_patient ON public.patient_medications(patient_id);
ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY meds_admin_rn ON public.patient_medications FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]));
CREATE POLICY meds_caregiver_select ON public.patient_medications FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY meds_patient_select ON public.patient_medications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = patient_medications.patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER trg_meds_touch BEFORE UPDATE ON public.patient_medications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_meds_audit AFTER INSERT OR UPDATE OR DELETE ON public.patient_medications
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.medication_administrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  administered_at timestamptz NOT NULL DEFAULT now(),
  administered_by uuid,
  dose_given text,
  status text NOT NULL DEFAULT 'given',  -- given | refused | held | missed
  is_prn boolean NOT NULL DEFAULT false,
  prn_reason text,
  response_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_med_admin_patient ON public.medication_administrations(patient_id, administered_at DESC);
CREATE INDEX idx_med_admin_medication ON public.medication_administrations(medication_id);
ALTER TABLE public.medication_administrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY medadmin_admin_rn ON public.medication_administrations FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]));
CREATE POLICY medadmin_caregiver_select ON public.medication_administrations FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY medadmin_caregiver_insert ON public.medication_administrations FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id) AND administered_by = auth.uid());
CREATE POLICY medadmin_patient_select ON public.medication_administrations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = medication_administrations.patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER trg_medadmin_audit AFTER INSERT OR UPDATE OR DELETE ON public.medication_administrations
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================================
-- Document versioning
-- ============================================================
ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1;

CREATE TABLE public.patient_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  version integer NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);
CREATE INDEX idx_doc_versions_doc ON public.patient_document_versions(document_id, version DESC);
ALTER TABLE public.patient_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdv_admin_rn ON public.patient_document_versions FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]));
CREATE POLICY pdv_caregiver_insert ON public.patient_document_versions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id) AND uploaded_by = auth.uid());
CREATE POLICY pdv_caregiver_select ON public.patient_document_versions FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY pdv_patient_select ON public.patient_document_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = patient_document_versions.patient_id AND p.user_id = auth.uid()));

CREATE TRIGGER trg_pdv_audit AFTER INSERT OR UPDATE OR DELETE ON public.patient_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Also audit the parent documents table for full audit trail
CREATE TRIGGER trg_pdocs_audit AFTER INSERT OR UPDATE OR DELETE ON public.patient_documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Seed version 1 row for every existing document so history is consistent
INSERT INTO public.patient_document_versions (document_id, patient_id, version, file_path, file_name, mime_type, size_bytes, uploaded_by, change_note, created_at)
SELECT id, patient_id, 1, file_path, file_name, mime_type, size_bytes, uploaded_by, 'Initial upload', created_at
FROM public.patient_documents
ON CONFLICT DO NOTHING;

-- ============================================================
-- Realtime for notifications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
