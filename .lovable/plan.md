# Plan: Major restructure + feature additions

This bundles 10 distinct changes. Confirming the plan before I touch files since several change navigation and routing.

## 1. HIPAA → Tabbed (Consent + Authorization)
Refactor `patients.$patientId.consent.tsx` into a tabbed page: **Consent** and **HIPAA Authorization**. Keep the existing consent form on tab 1; move/build the HIPAA authorization form (already-backed `hipaa_authorizations` table) on tab 2.

## 2. Patient Overview enhancements
On `patients.$patientId.index.tsx`:
- Add **Insurance Details** section (carrier, policy #, group #, plan type, subscriber). New columns on `patients` (or a separate `patient_insurance` table — I'll use new columns: `insurance_carrier`, `insurance_policy`, `insurance_group`, `insurance_plan_type`, `insurance_subscriber`).
- Add **Patient Photo** upload/edit. New column `photo_url`. Reuse existing `patient-documents` bucket under `photos/{patientId}.jpg` path, or new public `patient-photos` bucket.
- Layout: form on the left, **saved patient details card** on the right (photo + summary).

## 3. Staff role permissions — editable + persisted
New table `role_permissions(role app_role PK, permissions jsonb)`. RLS: admin can write, all authenticated can read. On `staff.$staffId.tsx`, replace the static PERMISSION_MATRIX read with DB-backed read, and add an admin-only edit UI (checkbox per permission key) that saves to Supabase.

## 4. Dashboard alert acknowledge/resolve/dismiss per user
New table `user_alert_states(user_id, alert_key text, status text, updated_at)` with RLS `user_id = auth.uid()`. Update `dashboard.tsx` to read/write status per alert (acknowledge / resolve / dismiss) — replacing the current in-memory `resolveAlert` ephemeral logic for dismissal & ack state.

## 5. Allergy activity history
New table `patient_allergy_events(allergy_id, patient_id, action, actor_id, before jsonb, after jsonb, created_at)`. Insert rows from the client on add/edit/toggle/remove. Show a "History" section on the allergies page with actor name + timestamp.

## 6. Staff profile — patient assignment controls
On `staff.$staffId.tsx` (caregiver/RN only): list current `patient_assignments`, add an "Assign patient" combobox of unassigned patients, and "Remove" button per row. Uses existing `patient_assignments` table + RLS (admin/RN ALL).

## 7. New top-level **Assessments** module
- New layout route `src/routes/_authenticated/assessments.tsx` with sub-nav: **Participant Assessment**, **RN Assessment**, **Skin Tracking**, **Caregiver Assessment**.
- Sub-routes: `assessments.participant.tsx`, `assessments.rn.tsx`, `assessments.skin.tsx`, `assessments.caregiver.tsx`. Each shows a cross-patient list with patient filter + date filter, and links into the existing per-patient assessment page to create/edit.
- Add "Assessments" item to `AppSidebar.tsx`.

## 8. Patient card cleanup
On `patients.$patientId.tsx`:
- Remove individual tabs: Assessment, Caregiver Assessment, RN Assessment, Skin.
- Add a single **Assessments** tab that lists this patient's assessments across all four types with type/date/status filters; each row links to the existing per-patient route to view/edit.
- Keep existing route files (still reachable by direct URL and from the new Assessments module).

## 9. Fall risk layout
On `patients.$patientId.fall-risk.tsx`: switch to two-column grid (`lg:grid-cols-[2fr_1fr]`) — form left, history right.

## 10. Migration & types
One migration covering: new patient columns, `role_permissions`, `user_alert_states`, `patient_allergy_events`, optional `patient-photos` storage bucket + policies. Seed `role_permissions` with current PERMISSION_MATRIX defaults.

---

### Technical notes
- All new tables get RLS. `role_permissions` readable by all authenticated; writable by admin. `user_alert_states` scoped to `auth.uid()`. `patient_allergy_events` follows the same admin/rn/caregiver/patient pattern as `patient_allergies`.
- I'll keep existing per-patient assessment routes (so the per-patient Assessments tab and the global module both deep-link into them).
- No business-logic changes to the actual assessment forms — this is reorganization + new shells.

### Files (new)
- `supabase/migrations/<ts>_assessments_perms_alerts.sql`
- `src/routes/_authenticated/assessments.tsx` (+ 4 children)
- `src/routes/_authenticated/patients.$patientId.hipaa.tsx` *(or extend consent.tsx with tabs in-place — I'll do in-place)*

### Files (edited)
- `src/routes/_authenticated/patients.$patientId.consent.tsx`
- `src/routes/_authenticated/patients.$patientId.index.tsx`
- `src/routes/_authenticated/patients.$patientId.tsx` (tab cleanup)
- `src/routes/_authenticated/patients.$patientId.fall-risk.tsx`
- `src/routes/_authenticated/patients.$patientId.allergies.tsx`
- `src/routes/_authenticated/staff.$staffId.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/components/app/AppSidebar.tsx`

Approve and I'll ship it in one pass (migration first, then code).