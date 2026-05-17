## American Care Team — Phase 1 Build Plan

Scope is intentionally limited to Phase 1 from your spec. Caregiver Assessment, Home Safety, Skin, Care Plan builder, Visit workflow, and Timesheets will follow in later phases (routes will exist as "coming soon" placeholders so the nav is complete).

### Design system

Apply the "Clinical Ledger" direction verbatim to `src/styles.css`:
- Fonts: Inter (UI) + JetBrains Mono (IDs, scores, dates, vitals)
- Tokens: `--primary` teal `#0d9488`, `--alert-red` `#be123c`, `--alert-amber` `#b45309`, `--foreground` `#0f172a`, `--muted` `#64748b`, `--border` `#e2e8f0`, `--background` `#fcfcfc`
- Sharp corners, monospace data, hairline borders, sticky patient header with always-visible precaution badges
- `entrance` keyframe for section reveals

### Backend (Lovable Cloud)

Enable Lovable Cloud, then create one migration with:

**Roles & access**
- `app_role` enum: `admin | rn | caregiver | patient`
- `user_roles (id, user_id, role)` + `has_role(uuid, app_role)` security-definer fn
- `profiles (id=auth.users.id, full_name, email, phone, license_no, active)` auto-created via `on_auth_user_created` trigger
- `staff_invitations (id, email, role, invited_by, accepted_at, token)` — admin invites; user signs up via emailed link, trigger assigns role on first sign-in

**Patients & assignments**
- `patients` (full demographics, SSN encrypted-at-rest column, SOC date, DNR, general condition, insurance, primary physician, status)
- `patient_assignments (patient_id, staff_id, role)` — links RN + caregiver(s)

**Intake**
- `patient_consents` and `hipaa_authorizations` (schemas exactly as spec)

**Clinical**
- `participant_assessments` (header + JSONB blobs per body system, vitals, signatures)
- `participant_adl_status`, `patient_medications`, `participant_health_needs`
- `fall_risk_assessments` (10 scored bools + computed `total_score`, `risk_level`, signature)

**Storage**
- `signatures` bucket (private) for drawn-signature PNGs

**RLS** (server-fn middleware is primary gate; RLS is the backstop)
- Admins: full access via `has_role(auth.uid(),'admin')`
- RNs: read all patients/assessments; write assessments/consents
- Caregivers: only patients in `patient_assignments` where `staff_id = auth.uid()`
- Patients: only own row (matched by `profiles.id = patient.user_id`)
- All write paths go through `createServerFn` + `requireSupabaseAuth`; immutable audit log via Postgres trigger writing to `audit_logs`

### Frontend (TanStack Start)

**Routes**
```
src/routes/
  __root.tsx                    sidebar shell + auth listener + invalidate-on-auth-change
  index.tsx                     redirects to /dashboard or /login
  login.tsx                     email/password + invitation token flow
  _authenticated.tsx            beforeLoad guard (redirect → /login)
  _authenticated/
    dashboard.tsx               role-specific cards
    patients.index.tsx          patient registry table
    patients.$patientId.tsx     profile shell with sticky header + tabs (Outlet)
    patients.$patientId.index.tsx               Overview tab
    patients.$patientId.consent.tsx             Consent + HIPAA tab
    patients.$patientId.assessments.index.tsx   list of assessments
    patients.$patientId.assessments.new.tsx     3-page participant assessment wizard
    patients.$patientId.fall-risk.index.tsx     fall risk history + new
    patients.$patientId.fall-risk.new.tsx       fall risk form
    patients.$patientId.care-plan.tsx           placeholder (Phase 2)
    patients.$patientId.skin.tsx                placeholder
    patients.$patientId.visits.tsx              placeholder
    patients.$patientId.timesheets.tsx          placeholder
    staff.tsx                   admin-only invitations list
    settings.tsx
```

**Shared components**
- `AppSidebar` — fixed left, role chip, nav items per role
- `PatientHeader` — sticky, name + ID, precaution badges (auto-derived from latest fall risk + skin), tab strip
- `PrecautionBadge` — color-coded chip system
- `SignaturePad` — `react-signature-canvas` drawn signature with "Type instead" fallback; uploads PNG to `signatures` bucket and stores URL + typed name
- `FormSection`, `RadioCardGroup`, `CheckboxCard`, `VitalsInput`, `ScaleField` — reusable form primitives matching the ledger style
- `AssessmentWizard` — 3-page stepper with auto-save draft (localStorage + server fn every 10s)

**Server functions** (`src/lib/*.functions.ts`)
- `auth.functions.ts` — `acceptInvitation`
- `patients.functions.ts` — `listPatients`, `getPatient`, `createPatient`
- `consent.functions.ts` — `submitConsent`, `submitHipaa`, `getConsentStatus`
- `fall-risk.functions.ts` — `submitFallRisk` (computes score server-side, sets risk_level)
- `assessments.functions.ts` — `saveDraft`, `submitAssessment`, `listAssessments`
- `staff.functions.ts` — `inviteStaff`, `listStaff` (admin-only)

All protected by `requireSupabaseAuth`; admin-only ones additionally check `has_role`. Ensure `attachSupabaseAuth` is registered in `src/start.ts`.

### Business rules wired in this phase
- Care plan activation blocked until consent status = complete (UI-side until Phase 2 builds the plan)
- Fall risk score ≥ 4 → `Fall Precautions` badge auto-appears on patient header (derived from latest assessment)
- Assessment forms auto-save as draft on change
- Confirm dialog before final submit; submitted records are read-only
- Audit log trigger captures every insert/update

### Out of scope (Phase 2+)
Caregiver assessment, Home safety, Skin module, Care plan builder, Visit workflow, Timesheets, Reports. Their routes render a styled "Coming in Phase 2" panel so navigation stays consistent.

### Technical notes
- Enable Lovable Cloud first (single migration follows)
- Signatures bucket is private; signed URLs returned via server fn
- SSN field masked in UI (`***-**-1234`), stored encrypted using pgcrypto
- All forms use Zod for validation client- and server-side
- E-signature: drawn (canvas) primary, typed-name fallback toggle — both stored
