ALTER TABLE public.fall_risk_assessments
  ADD COLUMN IF NOT EXISTS patient_signature_url text,
  ADD COLUMN IF NOT EXISTS patient_signature_typed text;