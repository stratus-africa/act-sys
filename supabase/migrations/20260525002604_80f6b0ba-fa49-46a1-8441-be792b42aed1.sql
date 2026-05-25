
-- ===== Extend applicants =====
ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS middle_name text,
  ADD COLUMN IF NOT EXISTS gender_at_birth text,
  ADD COLUMN IF NOT EXISTS authorized_us boolean,
  ADD COLUMN IF NOT EXISTS over_18 boolean,
  ADD COLUMN IF NOT EXISTS preferred_schedule text,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS weekly_hours integer,
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS agency_experience boolean,
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS transportation_method text,
  ADD COLUMN IF NOT EXISTS transportation_plan text,
  ADD COLUMN IF NOT EXISTS has_vehicle boolean,
  ADD COLUMN IF NOT EXISTS has_drivers_license boolean,
  ADD COLUMN IF NOT EXISTS weekend_availability boolean,
  ADD COLUMN IF NOT EXISTS race_ethnicity text,
  ADD COLUMN IF NOT EXISTS veteran_status text,
  ADD COLUMN IF NOT EXISTS disability_status text,
  ADD COLUMN IF NOT EXISTS additional_skills text;

-- Helper to apply admin/rn RLS + updated_at trigger
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'applicant_onboarding_progress',
    'applicant_licenses',
    'applicant_education',
    'applicant_work_history',
    'applicant_references',
    'applicant_compliance',
    'applicant_policy_acks',
    'applicant_signatures',
    'applicant_traffic_violations',
    'applicant_accidents',
    'applicant_criminal_history',
    'applicant_medical_compliance_issues'
  ])
  LOOP
    NULL; -- placeholder; tables created below
  END LOOP;
END $$;

-- ===== applicant_onboarding_progress =====
CREATE TABLE IF NOT EXISTS public.applicant_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL UNIQUE,
  current_step integer NOT NULL DEFAULT 1,
  completed_steps integer[] NOT NULL DEFAULT '{}',
  draft_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  resume_token text UNIQUE,
  submitted_at timestamptz,
  last_saved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== applicant_licenses =====
CREATE TABLE IF NOT EXISTS public.applicant_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  kind text NOT NULL,                  -- drivers | nursing
  license_type text,
  state text,
  number text,
  license_class text,
  issued_on date,
  expires_on date,
  suspended boolean DEFAULT false,
  revoked boolean DEFAULT false,
  verified_by text,
  verified_at timestamptz,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== applicant_education =====
CREATE TABLE IF NOT EXISTS public.applicant_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  school_type text,
  school_name text,
  degree text,
  graduation_status text,
  graduation_year integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== applicant_work_history =====
CREATE TABLE IF NOT EXISTS public.applicant_work_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  employer text,
  position text,
  supervisor text,
  start_date date,
  end_date date,
  reason_for_leaving text,
  performance_rating jsonb DEFAULT '{}'::jsonb,
  rehire_eligible boolean,
  verified_at timestamptz,
  verified_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== applicant_references =====
CREATE TABLE IF NOT EXISTS public.applicant_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  name text NOT NULL,
  position text,
  email text,
  phone text,
  relationship text,
  contacted_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== applicant_compliance =====
CREATE TABLE IF NOT EXISTS public.applicant_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  kind text NOT NULL,                  -- tb | background_check | cpr | vaccine_hepb | vaccine_flu | certification | other
  status text NOT NULL DEFAULT 'pending', -- pending | active | expiring | expired | declined
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  file_path text,
  completed_on date,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== applicant_policy_acks =====
CREATE TABLE IF NOT EXISTS public.applicant_policy_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  policy_key text NOT NULL,            -- e.g. hipaa, ethics, non_compete, at_will, drug_alcohol
  acknowledged boolean NOT NULL DEFAULT false,
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_url text,
  signature_typed text,
  signed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (applicant_id, policy_key)
);

-- ===== applicant_signatures (audit-grade log) =====
CREATE TABLE IF NOT EXISTS public.applicant_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  context text NOT NULL,               -- which form/step
  signer_name text,
  signature_url text,
  signature_typed text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

-- ===== driving history =====
CREATE TABLE IF NOT EXISTS public.applicant_traffic_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  occurred_on date,
  location text,
  charges text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.applicant_accidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  occurred_on date,
  description text,
  fatalities integer DEFAULT 0,
  injuries integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ===== disclosures =====
CREATE TABLE IF NOT EXISTS public.applicant_criminal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  ever_arrested boolean,
  ever_convicted boolean,
  incidents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.applicant_medical_compliance_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  medicare_exclusion boolean,
  medical_disciplinary boolean,
  board_discipline boolean,
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_app_lic_app ON public.applicant_licenses (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_edu_app ON public.applicant_education (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_work_app ON public.applicant_work_history (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_ref_app ON public.applicant_references (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_comp_app ON public.applicant_compliance (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_comp_exp ON public.applicant_compliance (expires_on);
CREATE INDEX IF NOT EXISTS idx_app_ack_app ON public.applicant_policy_acks (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_sig_app ON public.applicant_signatures (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_tv_app ON public.applicant_traffic_violations (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_acc_app ON public.applicant_accidents (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_crim_app ON public.applicant_criminal_history (applicant_id);
CREATE INDEX IF NOT EXISTS idx_app_med_app ON public.applicant_medical_compliance_issues (applicant_id);

-- Enable RLS + uniform admin/rn policy + updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'applicant_onboarding_progress',
    'applicant_licenses',
    'applicant_education',
    'applicant_work_history',
    'applicant_references',
    'applicant_compliance',
    'applicant_policy_acks',
    'applicant_signatures',
    'applicant_traffic_violations',
    'applicant_accidents',
    'applicant_criminal_history',
    'applicant_medical_compliance_issues'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_rn', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.current_user_has_any_role(ARRAY[''admin''::app_role, ''rn''::app_role])) WITH CHECK (public.current_user_has_any_role(ARRAY[''admin''::app_role, ''rn''::app_role]))',
      t || '_admin_rn', t
    );
    -- updated_at trigger where the column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='updated_at'
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_touch', t);
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
        t || '_touch', t
      );
    END IF;
  END LOOP;
END $$;
