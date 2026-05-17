
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'rn', 'caregiver', 'patient');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  license_no TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_any_role(_roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles))
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  invitation_role public.app_role;
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- If this is the first user, make them admin
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;
  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    RETURN NEW;
  END IF;

  -- Check for pending invitation for this email
  SELECT role INTO invitation_role
  FROM public.staff_invitations
  WHERE email = NEW.email AND accepted_at IS NULL
  ORDER BY created_at DESC LIMIT 1;

  IF invitation_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, invitation_role);
    UPDATE public.staff_invitations
      SET accepted_at = now(), accepted_by = NEW.id
      WHERE email = NEW.email AND accepted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PATIENTS ============
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  mrn TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  dob DATE,
  ssn_last4 TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  primary_physician TEXT,
  insurance TEXT,
  start_of_care DATE,
  dnr_status BOOLEAN NOT NULL DEFAULT false,
  general_condition TEXT CHECK (general_condition IN ('improving', 'stable', 'deteriorating')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'discharged', 'on_hold')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.patient_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL CHECK (role IN ('rn', 'caregiver')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, staff_id, role)
);

CREATE OR REPLACE FUNCTION public.is_assigned_to_patient(_user_id UUID, _patient_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_assignments
    WHERE patient_id = _patient_id AND staff_id = _user_id
  )
$$;

-- ============ CONSENTS ============
CREATE TABLE public.patient_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  consent_services BOOLEAN NOT NULL DEFAULT false,
  consent_emergency BOOLEAN NOT NULL DEFAULT false,
  consent_payment BOOLEAN NOT NULL DEFAULT false,
  consent_privacy BOOLEAN NOT NULL DEFAULT false,
  advance_directive BOOLEAN NOT NULL DEFAULT false,
  start_of_care DATE,
  ssn_full TEXT,
  patient_signature_url TEXT,
  patient_signature_typed TEXT,
  agency_signature_url TEXT,
  agency_signature_typed TEXT,
  signed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hipaa_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  provider_name TEXT,
  recipient_name TEXT,
  period_type TEXT CHECK (period_type IN ('range', 'all_time')),
  start_date DATE,
  end_date DATE,
  extent TEXT CHECK (extent IN ('full', 'full_with_exceptions')),
  exclude_mental_health BOOLEAN DEFAULT false,
  exclude_communicable BOOLEAN DEFAULT false,
  exclude_substance_abuse BOOLEAN DEFAULT false,
  exclude_other TEXT,
  expiry_date DATE,
  expiry_event TEXT,
  patient_signature_url TEXT,
  patient_signature_typed TEXT,
  printed_name TEXT,
  relationship TEXT,
  signed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'revoked')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ FALL RISK ============
CREATE TABLE public.fall_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinician_id UUID REFERENCES auth.users(id),
  assessment_type TEXT NOT NULL CHECK (assessment_type IN ('soc', 'recertification')),
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  age_65 BOOLEAN NOT NULL DEFAULT false,
  multiple_diagnoses BOOLEAN NOT NULL DEFAULT false,
  prior_falls BOOLEAN NOT NULL DEFAULT false,
  incontinence BOOLEAN NOT NULL DEFAULT false,
  visual_impairment BOOLEAN NOT NULL DEFAULT false,
  mobility_impairment BOOLEAN NOT NULL DEFAULT false,
  environmental_hazards BOOLEAN NOT NULL DEFAULT false,
  polypharmacy BOOLEAN NOT NULL DEFAULT false,
  pain_affecting_function BOOLEAN NOT NULL DEFAULT false,
  cognitive_impairment BOOLEAN NOT NULL DEFAULT false,
  total_score INT NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'at_risk')),
  clinician_signature_url TEXT,
  clinician_signature_typed TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ PARTICIPANT ASSESSMENTS ============
CREATE TABLE public.participant_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  nurse_id UUID REFERENCES auth.users(id),
  visit_type TEXT NOT NULL CHECK (visit_type IN ('initial', 'monthly', '45_day', '3_month', '4_month', 'annual')),
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  -- JSONB blobs per body system
  vitals JSONB DEFAULT '{}'::jsonb,
  weight JSONB DEFAULT '{}'::jsonb,
  diet JSONB DEFAULT '{}'::jsonb,
  change_log JSONB DEFAULT '{}'::jsonb,
  respiratory JSONB DEFAULT '{}'::jsonb,
  pain JSONB DEFAULT '{}'::jsonb,
  genitourinary JSONB DEFAULT '{}'::jsonb,
  cardiovascular JSONB DEFAULT '{}'::jsonb,
  gastrointestinal JSONB DEFAULT '{}'::jsonb,
  neurological JSONB DEFAULT '{}'::jsonb,
  sensory JSONB DEFAULT '{}'::jsonb,
  psychosocial JSONB DEFAULT '{}'::jsonb,
  musculoskeletal JSONB DEFAULT '{}'::jsonb,
  mental_health JSONB DEFAULT '{}'::jsonb,
  skin JSONB DEFAULT '{}'::jsonb,
  adl_status JSONB DEFAULT '[]'::jsonb,
  health_needs JSONB DEFAULT '[]'::jsonb,
  medications JSONB DEFAULT '[]'::jsonb,
  general_condition TEXT,
  medication_management TEXT,
  activities_of_visit JSONB DEFAULT '[]'::jsonb,
  caregiver_names TEXT,
  notes TEXT,
  rn_signature_url TEXT,
  rn_signature_typed TEXT,
  participant_signature_url TEXT,
  participant_signature_typed TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  diff JSONB
);

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, diff)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    auth.uid(),
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER audit_patients AFTER INSERT OR UPDATE OR DELETE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_consents AFTER INSERT OR UPDATE OR DELETE ON public.patient_consents FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_hipaa AFTER INSERT OR UPDATE OR DELETE ON public.hipaa_authorizations FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_fall_risk AFTER INSERT OR UPDATE OR DELETE ON public.fall_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
CREATE TRIGGER audit_assessments AFTER INSERT OR UPDATE OR DELETE ON public.participant_assessments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER touch_patients BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_assessments BEFORE UPDATE ON public.participant_assessments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hipaa_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fall_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- profiles: users can read all profiles (staff need to see names); only self can update
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: read-self + admin manage
CREATE POLICY "roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- staff_invitations: admin only
CREATE POLICY "invites_admin" ON public.staff_invitations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- patients: admin/rn = all; caregiver = assigned only; patient = self
CREATE POLICY "patients_admin_rn" ON public.patients FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','rn']::public.app_role[]));
CREATE POLICY "patients_caregiver_select" ON public.patients FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'caregiver') AND public.is_assigned_to_patient(auth.uid(), id));
CREATE POLICY "patients_self_select" ON public.patients FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- assignments: admin/rn manage; everyone sees rows for themselves
CREATE POLICY "assignments_admin_rn" ON public.patient_assignments FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','rn']::public.app_role[]));
CREATE POLICY "assignments_self" ON public.patient_assignments FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

-- consents
CREATE POLICY "consents_admin_rn" ON public.patient_consents FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','rn']::public.app_role[]));
CREATE POLICY "consents_caregiver_select" ON public.patient_consents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'caregiver') AND public.is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY "consents_patient_select" ON public.patient_consents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

CREATE POLICY "hipaa_admin_rn" ON public.hipaa_authorizations FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','rn']::public.app_role[]));
CREATE POLICY "hipaa_patient_select" ON public.hipaa_authorizations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

-- fall risk
CREATE POLICY "fallrisk_admin_rn" ON public.fall_risk_assessments FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','rn']::public.app_role[]));
CREATE POLICY "fallrisk_caregiver_select" ON public.fall_risk_assessments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'caregiver') AND public.is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY "fallrisk_patient_select" ON public.fall_risk_assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

-- participant assessments
CREATE POLICY "assessments_admin_rn" ON public.participant_assessments FOR ALL TO authenticated
  USING (public.current_user_has_any_role(ARRAY['admin','rn']::public.app_role[]));
CREATE POLICY "assessments_caregiver_select" ON public.participant_assessments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'caregiver') AND public.is_assigned_to_patient(auth.uid(), patient_id));
CREATE POLICY "assessments_patient_select" ON public.participant_assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

-- audit logs: admin only
CREATE POLICY "audit_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', false);

CREATE POLICY "signatures_authenticated_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signatures');
CREATE POLICY "signatures_authenticated_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'signatures');
