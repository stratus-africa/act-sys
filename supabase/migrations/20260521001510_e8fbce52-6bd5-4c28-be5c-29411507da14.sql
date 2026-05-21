ALTER TABLE public.participant_assessments DROP CONSTRAINT IF EXISTS participant_assessments_visit_type_check;
ALTER TABLE public.participant_assessments ADD CONSTRAINT participant_assessments_visit_type_check
  CHECK (visit_type = ANY (ARRAY[
    'initial','monthly','45_day','3_month','4_month','annual',
    'SOC','Recertification','Resumption','Routine','Discharge'
  ]));