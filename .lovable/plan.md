## Plan: Five Major Modules

I'll ship these in one migration + one code pass per module, in this order so each module's data is available to the next.

### 1. Visits page UI (`/visits` + per-patient visits tab)
- Schedule visit modal (date/time/type/patient/staff)
- Clock-in / Clock-out buttons that stamp `check_in_at` / `check_out_at` + capture start/end mileage
- On checkout: caregiver + patient signature capture via existing `SignaturePad`, upload to `signatures` bucket, set `verified_at`
- List view filtered by status (scheduled/in-progress/completed) with role-based controls (caregivers only see own/assigned)

### 2. Notifications bell
- New `<NotificationsBell />` in sidebar header
- Popover lists 20 most recent unread `notifications` with title/body/link/timestamp
- "Mark all read" + per-row mark-read (sets `read_at`)
- Realtime subscription on `notifications` for the current user; unread count badge

### 3. Medications module
- **New tables**: `patient_medications` (name, dose, route, frequency, prn flag, start/stop, instructions, active), `medication_administrations` (med_id, patient_id, administered_at, administered_by, dose_given, prn_reason, response_note, signature)
- RLS: Admin/RN full CRUD on meds; Caregivers can read assigned + insert administrations; Patient can read own
- New per-patient tab `/patients/$patientId/medications`: med list (active/discontinued), add/edit, administration log timeline, PRN-specific "Record PRN" flow with reason+response

### 4. Document management upgrade
- **New table**: `patient_document_versions` (document_id, version, file_path, size_bytes, mime_type, uploaded_by, uploaded_at, change_note); audit via existing `audit_trigger`
- Add `category` enum-like values (id_card, insurance, physician_order, advance_directive, other), `current_version`, `latest_version_id` to existing `patient_documents`
- Per-patient `/patients/$patientId/documents`: upload (creates v1), re-upload to existing doc creates new version, category filter, version history dropdown showing who/when/note, download any version
- Audit log view (admin/RN) listing every insert/update from `audit_logs` filtered to `patient_documents`

### 5. Admin PDF exports (`/reports`)
- New `src/lib/admin-pdf.ts` using `jspdf` + `jspdf-autotable`
- Reports:
  - **Patient summary**: demographics, latest assessments (RN/skin/fall-risk/participant/caregiver) with dates+signed status, care plan goals + recent progress, recent visits with mileage and verification, allergies, consents
  - **Visit log report** (date range): all visits with staff, hours, mileage, signed status
  - **Compliance snapshot**: patient list with missing consents/HIPAA/assessments flagged
- Each report has filter UI + "Export PDF" button (admin/RN only)

### Technical notes
- One migration creates: `patient_medications`, `medication_administrations`, `patient_document_versions`, adds `category`/`current_version` columns to `patient_documents`, attaches `audit_trigger` to `patient_documents` + `patient_medications` + `medication_administrations`, enables realtime on `notifications`
- All RLS follows existing pattern: `current_user_has_any_role(['admin','rn'])` for management, `has_role(...,'caregiver') AND is_assigned_to_patient(...)` for caregivers, `EXISTS patients.user_id = auth.uid()` for patients
- All UI uses existing semantic tokens + page-wide layout (no `max-w` caps)
- Notifications fired from: visit checkout (notify admins/RNs), PRN medication given (notify RNs), document uploaded (notify admins/RNs), care plan goal met (already exists)
