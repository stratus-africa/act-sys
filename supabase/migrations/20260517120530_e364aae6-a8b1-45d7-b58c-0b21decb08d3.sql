-- Document signatures audit trail
CREATE TABLE public.document_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.patient_documents(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  signer_role text NOT NULL,
  signer_id uuid,
  signer_name text,
  signature_url text,
  signature_typed text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_docsig_doc ON public.document_signatures(document_id);
CREATE INDEX idx_docsig_patient ON public.document_signatures(patient_id);

ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY docsig_admin_rn ON public.document_signatures FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]));

CREATE POLICY docsig_caregiver_select ON public.document_signatures FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id));

CREATE POLICY docsig_caregiver_insert ON public.document_signatures FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'caregiver'::app_role) AND is_assigned_to_patient(auth.uid(), patient_id) AND signer_id = auth.uid());

CREATE POLICY docsig_patient_select ON public.document_signatures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM patients p WHERE p.id = document_signatures.patient_id AND p.user_id = auth.uid()));

-- Required signers and lock on documents
ALTER TABLE public.patient_documents
  ADD COLUMN IF NOT EXISTS required_signers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

-- Timesheets
CREATE TABLE public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  week_start date NOT NULL,
  hours numeric(6,2) NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_id, week_start)
);
CREATE INDEX idx_timesheets_staff ON public.timesheets(staff_id);
CREATE INDEX idx_timesheets_status ON public.timesheets(status);

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY ts_admin_rn ON public.timesheets FOR ALL TO authenticated
  USING (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]))
  WITH CHECK (current_user_has_any_role(ARRAY['admin'::app_role,'rn'::app_role]));

CREATE POLICY ts_self_select ON public.timesheets FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

CREATE POLICY ts_self_insert ON public.timesheets FOR INSERT TO authenticated
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY ts_self_update ON public.timesheets FOR UPDATE TO authenticated
  USING (staff_id = auth.uid() AND status IN ('draft','rejected'));

CREATE TRIGGER trg_timesheets_touch BEFORE UPDATE ON public.timesheets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();