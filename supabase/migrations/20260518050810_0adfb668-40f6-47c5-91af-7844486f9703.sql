-- Fix overly-restrictive assessment_type check on fall_risk_assessments
ALTER TABLE public.fall_risk_assessments
  DROP CONSTRAINT IF EXISTS fall_risk_assessments_assessment_type_check;
ALTER TABLE public.fall_risk_assessments
  ADD CONSTRAINT fall_risk_assessments_assessment_type_check
  CHECK (assessment_type = ANY (ARRAY['initial','reassessment','post_fall','soc','recertification']));

-- Seed default role_permissions rows (idempotent)
INSERT INTO public.role_permissions (role, permissions) VALUES
  ('admin', '{"manage_staff":true,"assign_patients":true,"view_all_patients":true,"create_assessments":true,"manage_allergies_care_plans":true,"document_visits":true,"submit_timesheets":true,"approve_timesheets":true,"view_own_patient_only":false}'::jsonb),
  ('rn', '{"manage_staff":false,"assign_patients":true,"view_all_patients":true,"create_assessments":true,"manage_allergies_care_plans":true,"document_visits":true,"submit_timesheets":true,"approve_timesheets":true,"view_own_patient_only":false}'::jsonb),
  ('caregiver', '{"manage_staff":false,"assign_patients":false,"view_all_patients":false,"create_assessments":false,"manage_allergies_care_plans":false,"document_visits":true,"submit_timesheets":true,"approve_timesheets":false,"view_own_patient_only":false}'::jsonb),
  ('patient', '{"manage_staff":false,"assign_patients":false,"view_all_patients":false,"create_assessments":false,"manage_allergies_care_plans":false,"document_visits":false,"submit_timesheets":false,"approve_timesheets":false,"view_own_patient_only":true}'::jsonb)
ON CONFLICT (role) DO NOTHING;