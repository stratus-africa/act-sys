import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FormSection, FieldLabel, TextInput, TextArea } from "@/components/app/FormSection";
import { Switch } from "@/components/ui/switch";
import { CREDENTIAL_KINDS } from "@/lib/hr-constants";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, IdCard, ShieldCheck, ClipboardList, Users as UsersIcon, Stethoscope, Lock, X, Plus, AlertTriangle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/$staffId")({ component: StaffProfilePage });

type Profile = {
  id: string; email: string | null; full_name: string | null; phone: string | null; license_no: string | null; active: boolean; created_at: string;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  dob: string | null; ssn_last4: string | null; hire_date: string | null; termination_date: string | null;
  position: string | null; department: string | null; pay_type: string | null; pay_rate: number | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null; emergency_contact_relation: string | null;
  hr_notes: string | null;
};
type RoleName = "admin" | "rn" | "caregiver" | "patient";
type Credential = { id: string; kind: string; name: string; number: string | null; issued_on: string | null; expires_on: string | null; status: string; notes: string | null };

const PERMISSION_KEYS: { key: string; label: string }[] = [
  { key: "manage_staff", label: "Manage staff & invitations" },
  { key: "assign_patients", label: "Assign patients to staff" },
  { key: "view_all_patients", label: "View all patient records" },
  { key: "create_assessments", label: "Create & edit clinical assessments" },
  { key: "manage_allergies_care_plans", label: "Add / edit allergies & care plans" },
  { key: "document_visits", label: "Document visits for assigned patients" },
  { key: "submit_timesheets", label: "Submit timesheets" },
  { key: "approve_timesheets", label: "Approve timesheets" },
  { key: "view_own_patient_only", label: "View own patient profile only" },
];

function StaffProfilePage() {
  const { staffId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const isAdmin = primaryRole === "admin";
  const isSelf = user?.id === staffId;
  const canEdit = isAdmin || isSelf;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [allPatients, setAllPatients] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [cgAssessments, setCgAssessments] = useState<any[]>([]);
  const [rnAssessments, setRnAssessments] = useState<any[]>([]);
  const [edit, setEdit] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);
  const [permsByRole, setPermsByRole] = useState<Record<string, Record<string, boolean>>>({});
  const [assignRole, setAssignRole] = useState<"caregiver" | "rn">("caregiver");
  const [assignPatientId, setAssignPatientId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [newCred, setNewCred] = useState<Partial<Credential>>({ kind: "license", name: "", status: "active" });

  const load = useCallback(async () => {
    const [{ data: p }, { data: r }, { data: a }, { data: v }, { data: ts }, { data: cga }, { data: rna }, { data: rp }, { data: pats }, { data: creds }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", staffId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", staffId),
      supabase.from("patient_assignments").select("*, patients:patient_id(id, first_name, last_name)").eq("staff_id", staffId),
      supabase.from("visits").select("id, scheduled_date, scheduled_time, status, patient_id, patients:patient_id(first_name, last_name)").eq("staff_id", staffId).order("scheduled_date", { ascending: false }).limit(10),
      supabase.from("timesheets").select("id, week_start, hours, status").eq("staff_id", staffId).order("week_start", { ascending: false }).limit(8),
      supabase.from("caregiver_assessments").select("id, service_date, patient_id, patients:patient_id(first_name, last_name), tasks").eq("caregiver_id", staffId).order("service_date", { ascending: false }).limit(8),
      supabase.from("rn_assessments").select("id, assessment_date, patient_id, patients:patient_id(first_name, last_name), tasks").eq("nurse_id", staffId).order("assessment_date", { ascending: false }).limit(8),
      supabase.from("role_permissions").select("role, permissions"),
      supabase.from("patients").select("id, first_name, last_name").eq("status", "active").order("last_name"),
      (supabase.from("staff_credentials" as any) as any).select("*").eq("staff_id", staffId).order("expires_on", { ascending: true }),
    ]);
    setProfile(p as Profile | null);
    setRoles(((r ?? []) as Array<{ role: RoleName }>).map((x) => x.role));
    setAssignments(a ?? []);
    setVisits(v ?? []);
    setTimesheets(ts ?? []);
    setCgAssessments(cga ?? []);
    setRnAssessments(rna ?? []);
    setAllPatients(pats ?? []);
    setCredentials((creds ?? []) as Credential[]);
    const map: Record<string, Record<string, boolean>> = {};
    (rp ?? []).forEach((row: any) => { map[row.role] = (row.permissions ?? {}) as Record<string, boolean>; });
    setPermsByRole(map);
    if (p) setEdit(p as Profile);
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  const assignedIds = useMemo(() => new Set(assignments.map((a) => a.patient_id)), [assignments]);
  const unassigned = useMemo(() => allPatients.filter((p) => !assignedIds.has(p.id)), [allPatients, assignedIds]);

  const save = async () => {
    setSaving(true);
    const payload: Record<string, any> = {
      full_name: edit.full_name || null,
      phone: edit.phone || null,
      license_no: edit.license_no || null,
    };
    if (isAdmin) {
      Object.assign(payload, {
        address: edit.address || null,
        city: edit.city || null,
        state: edit.state || null,
        zip: edit.zip || null,
        dob: edit.dob || null,
        ssn_last4: edit.ssn_last4 || null,
        hire_date: edit.hire_date || null,
        termination_date: edit.termination_date || null,
        position: edit.position || null,
        department: edit.department || null,
        pay_type: edit.pay_type || null,
        pay_rate: edit.pay_rate ?? null,
        emergency_contact_name: edit.emergency_contact_name || null,
        emergency_contact_phone: edit.emergency_contact_phone || null,
        emergency_contact_relation: edit.emergency_contact_relation || null,
        hr_notes: edit.hr_notes || null,
      });
    }
    const { error } = await supabase.from("profiles").update(payload).eq("id", staffId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    load();
  };

  const togglePerm = async (role: RoleName, key: string, value: boolean) => {
    if (!isAdmin) return;
    const next = { ...(permsByRole[role] ?? {}), [key]: value };
    setPermsByRole((s) => ({ ...s, [role]: next }));
    const { error } = await supabase.from("role_permissions").upsert({ role, permissions: next, updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: "role" });
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const addAssignment = async () => {
    if (!assignPatientId) return;
    setAssigning(true);
    const { error } = await supabase.from("patient_assignments").insert({ staff_id: staffId, patient_id: assignPatientId, role: assignRole });
    setAssigning(false);
    if (error) return toast.error(error.message);
    setAssignPatientId("");
    toast.success("Patient assigned");
    load();
  };
  const removeAssignment = async (id: string) => {
    const { error } = await supabase.from("patient_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Assignment removed");
    load();
  };

  if (!profile) {
    return (
      <>
        <PageHeader eyebrow="Staff" title="Staff Profile" />
        <div className="p-8 text-sm text-muted-foreground">Loading…</div>
      </>
    );
  }

  const editableRoles: RoleName[] = roles.length > 0 ? roles.filter((r) => r !== "patient" || roles.length === 1) : [];

  return (
    <>
      <PageHeader eyebrow="Staff Profile" title={profile.full_name ?? profile.email ?? "Unnamed"} />
      <div className="p-6 lg:p-8 space-y-8">
        <Link to="/staff" className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Back to directory
        </Link>

        <div className="grid xl:grid-cols-[1fr_340px] gap-8">
          <div className="space-y-6 min-w-0">
            <FormSection title="Identity" description={canEdit ? "Update profile details." : "Read-only view."}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><FieldLabel>Full Name</FieldLabel><TextInput value={edit.full_name ?? ""} disabled={!canEdit} onChange={(e) => setEdit((s) => ({ ...s, full_name: e.target.value }))} /></div>
                <div><FieldLabel>Email</FieldLabel><TextInput value={profile.email ?? ""} disabled /></div>
                <div><FieldLabel>Phone</FieldLabel><TextInput value={edit.phone ?? ""} disabled={!canEdit} onChange={(e) => setEdit((s) => ({ ...s, phone: e.target.value }))} /></div>
                <div><FieldLabel>License Number</FieldLabel><TextInput value={edit.license_no ?? ""} disabled={!canEdit} onChange={(e) => setEdit((s) => ({ ...s, license_no: e.target.value }))} /></div>
              </div>
              {canEdit && (
                <button type="button" onClick={save} disabled={saving} className="mt-4 px-5 py-2 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-40">
                  {saving ? "Saving…" : "Save Profile"}
                </button>
              )}
            </FormSection>

            {isAdmin && (
              <FormSection title="HR Information" description="Address, hire details, emergency contact.">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2"><FieldLabel>Address</FieldLabel><TextInput value={edit.address ?? ""} onChange={(e) => setEdit((s) => ({ ...s, address: e.target.value }))} /></div>
                  <div><FieldLabel>City</FieldLabel><TextInput value={edit.city ?? ""} onChange={(e) => setEdit((s) => ({ ...s, city: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><FieldLabel>State</FieldLabel><TextInput value={edit.state ?? ""} onChange={(e) => setEdit((s) => ({ ...s, state: e.target.value }))} /></div>
                    <div><FieldLabel>ZIP</FieldLabel><TextInput value={edit.zip ?? ""} onChange={(e) => setEdit((s) => ({ ...s, zip: e.target.value }))} /></div>
                  </div>
                  <div><FieldLabel>Date of Birth</FieldLabel><TextInput type="date" value={edit.dob ?? ""} onChange={(e) => setEdit((s) => ({ ...s, dob: e.target.value }))} /></div>
                  <div><FieldLabel>SSN (last 4)</FieldLabel><TextInput maxLength={4} value={edit.ssn_last4 ?? ""} onChange={(e) => setEdit((s) => ({ ...s, ssn_last4: e.target.value }))} /></div>
                  <div><FieldLabel>Hire Date</FieldLabel><TextInput type="date" value={edit.hire_date ?? ""} onChange={(e) => setEdit((s) => ({ ...s, hire_date: e.target.value }))} /></div>
                  <div><FieldLabel>Termination Date</FieldLabel><TextInput type="date" value={edit.termination_date ?? ""} onChange={(e) => setEdit((s) => ({ ...s, termination_date: e.target.value }))} /></div>
                  <div><FieldLabel>Position</FieldLabel><TextInput value={edit.position ?? ""} onChange={(e) => setEdit((s) => ({ ...s, position: e.target.value }))} /></div>
                  <div><FieldLabel>Department</FieldLabel><TextInput value={edit.department ?? ""} onChange={(e) => setEdit((s) => ({ ...s, department: e.target.value }))} /></div>
                  <div>
                    <FieldLabel>Pay Type</FieldLabel>
                    <select value={edit.pay_type ?? ""} onChange={(e) => setEdit((s) => ({ ...s, pay_type: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-sm">
                      <option value="">—</option><option value="hourly">Hourly</option><option value="salary">Salary</option><option value="contractor">Contractor</option>
                    </select>
                  </div>
                  <div><FieldLabel>Pay Rate</FieldLabel><TextInput type="number" step="0.01" value={edit.pay_rate ?? ""} onChange={(e) => setEdit((s) => ({ ...s, pay_rate: e.target.value === "" ? null : Number(e.target.value) }))} /></div>
                  <div><FieldLabel>Emergency Contact Name</FieldLabel><TextInput value={edit.emergency_contact_name ?? ""} onChange={(e) => setEdit((s) => ({ ...s, emergency_contact_name: e.target.value }))} /></div>
                  <div><FieldLabel>Emergency Contact Phone</FieldLabel><TextInput value={edit.emergency_contact_phone ?? ""} onChange={(e) => setEdit((s) => ({ ...s, emergency_contact_phone: e.target.value }))} /></div>
                  <div><FieldLabel>Relationship</FieldLabel><TextInput value={edit.emergency_contact_relation ?? ""} onChange={(e) => setEdit((s) => ({ ...s, emergency_contact_relation: e.target.value }))} /></div>
                  <div className="md:col-span-2"><FieldLabel>HR Notes</FieldLabel><TextArea rows={3} value={edit.hr_notes ?? ""} onChange={(e) => setEdit((s) => ({ ...s, hr_notes: e.target.value }))} /></div>
                </div>
              </FormSection>
            )}

            {isAdmin && (
              <FormSection title="Credentials & Expirations" description="Licenses, certifications, TB / Hep B status, etc.">
                <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end pb-4 mb-4 border-b border-border">
                  <div>
                    <FieldLabel>Type</FieldLabel>
                    <select value={newCred.kind} onChange={(e) => setNewCred((s) => ({ ...s, kind: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-sm">
                      {CREDENTIAL_KINDS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div><FieldLabel>Name / Description</FieldLabel><TextInput value={newCred.name ?? ""} onChange={(e) => setNewCred((s) => ({ ...s, name: e.target.value }))} /></div>
                  <div><FieldLabel>Expires On</FieldLabel><TextInput type="date" value={newCred.expires_on ?? ""} onChange={(e) => setNewCred((s) => ({ ...s, expires_on: e.target.value }))} /></div>
                  <button onClick={async () => {
                    if (!newCred.name?.trim()) return toast.error("Name required");
                    const { error } = await (supabase.from("staff_credentials" as any) as any).insert({ staff_id: staffId, kind: newCred.kind, name: newCred.name, expires_on: newCred.expires_on || null, created_by: user?.id });
                    if (error) return toast.error(error.message);
                    setNewCred({ kind: "license", name: "", status: "active" });
                    load();
                  }} className="bg-primary text-primary-foreground px-3 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1"><Plus className="size-3.5" /> Add</button>
                </div>
                {credentials.length === 0 ? <div className="text-xs text-muted-foreground">No credentials on file.</div> : (
                  <ul className="divide-y divide-border">
                    {credentials.map((c) => {
                      const exp = c.expires_on ? new Date(c.expires_on) : null;
                      const expiringSoon = exp && exp.getTime() - Date.now() < 30 * 86400000;
                      const expired = exp && exp.getTime() < Date.now();
                      return (
                        <li key={c.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                          <div className="flex-1">
                            <div className="font-semibold">{c.name} <span className="text-[10px] font-mono uppercase text-muted-foreground ml-1">{CREDENTIAL_KINDS.find((k) => k.value === c.kind)?.label ?? c.kind}</span></div>
                            {c.expires_on && <div className={"text-[11px] font-mono " + (expired ? "text-destructive" : expiringSoon ? "text-amber-600" : "text-muted-foreground")}>
                              {expired ? "Expired" : expiringSoon ? "Expires soon" : "Expires"} {c.expires_on}
                              {(expired || expiringSoon) && <AlertTriangle className="size-3 inline ml-1" />}
                            </div>}
                          </div>
                          <button onClick={async () => {
                            await (supabase.from("staff_credentials" as any) as any).delete().eq("id", c.id);
                            load();
                          }} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </FormSection>
            )}

            {(roles.includes("caregiver") || roles.includes("rn")) && (
              <FormSection title="Patient Assignments" description={isAdmin ? "Manage which patients are assigned to this staff member." : "Patients currently assigned."}>
                {isAdmin && (
                  <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-border">
                    <div>
                      <FieldLabel>Role</FieldLabel>
                      <select value={assignRole} onChange={(e) => setAssignRole(e.target.value as any)} className="px-3 py-2 border border-border bg-background text-sm">
                        {roles.includes("caregiver") && <option value="caregiver">Caregiver</option>}
                        {roles.includes("rn") && <option value="rn">RN</option>}
                      </select>
                    </div>
                    <div className="flex-1 min-w-60">
                      <FieldLabel>Assign patient</FieldLabel>
                      <select value={assignPatientId} onChange={(e) => setAssignPatientId(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                        <option value="">Select a patient…</option>
                        {unassigned.map((p) => (
                          <option key={p.id} value={p.id}>{p.last_name}, {p.first_name}</option>
                        ))}
                      </select>
                    </div>
                    <button onClick={addAssignment} disabled={!assignPatientId || assigning} className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-40">
                      {assigning ? "Adding…" : "Add"}
                    </button>
                  </div>
                )}
                {assignments.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No patients assigned.</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {assignments.map((a) => (
                      <li key={a.id} className="py-2 flex items-center justify-between text-sm">
                        <div>
                          <Link to="/patients/$patientId" params={{ patientId: a.patient_id }} className="font-bold hover:underline">
                            {a.patients?.last_name}, {a.patients?.first_name}
                          </Link>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground ml-2">{a.role}</span>
                        </div>
                        {isAdmin && (
                          <button onClick={() => removeAssignment(a.id)} className="text-[10px] font-bold uppercase tracking-widest text-destructive hover:underline inline-flex items-center gap-1">
                            <X className="size-3" /> Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </FormSection>
            )}

            <FormSection title="Role Permissions" description={isAdmin ? "Toggle capabilities for each role this staff member has. Changes apply globally to the role." : "Capabilities granted by this staff member's role(s)."}>
              {editableRoles.length === 0 ? (
                <div className="text-xs text-muted-foreground">No roles assigned.</div>
              ) : (
                <div className="space-y-6">
                  {editableRoles.map((role) => {
                    const perms = permsByRole[role] ?? {};
                    return (
                      <div key={role} className="border border-border">
                        <div className="px-4 py-2 border-b border-border bg-muted/40 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                          <ShieldCheck className="size-3 text-primary" /> {role}
                          {!isAdmin && <Lock className="size-3 text-muted-foreground ml-auto" />}
                        </div>
                        <ul className="divide-y divide-border">
                          {PERMISSION_KEYS.map((p) => (
                            <li key={p.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                              <span className={perms[p.key] ? "" : "text-muted-foreground"}>{p.label}</span>
                              <Switch checked={!!perms[p.key]} disabled={!isAdmin} onCheckedChange={(v) => togglePerm(role, p.key, !!v)} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </FormSection>

            <FormSection title="Recent Visits">
              {visits.length === 0 ? <div className="text-xs text-muted-foreground">No visits.</div> : (
                <ul className="divide-y divide-border">
                  {visits.map((v) => (
                    <li key={v.id} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <Link to="/patients/$patientId" params={{ patientId: v.patient_id }} className="font-bold hover:underline">
                          {v.patients?.first_name} {v.patients?.last_name}
                        </Link>
                        <span className="text-[11px] font-mono text-muted-foreground ml-2">{v.scheduled_date} {v.scheduled_time ?? ""}</span>
                      </div>
                      <span className={"text-[10px] font-bold uppercase " + (v.status === "completed" ? "text-primary" : "text-muted-foreground")}>{v.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>

            <FormSection title="Recent Timesheets">
              {timesheets.length === 0 ? <div className="text-xs text-muted-foreground">No timesheets.</div> : (
                <ul className="divide-y divide-border">
                  {timesheets.map((t) => (
                    <li key={t.id} className="py-2 flex items-center justify-between text-sm">
                      <div className="font-mono text-xs">Week of {t.week_start}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs">{Number(t.hours).toFixed(1)} hrs</span>
                        <span className={"text-[10px] font-bold uppercase " + (t.status === "approved" ? "text-primary" : t.status === "rejected" ? "text-destructive" : "text-muted-foreground")}>{t.status}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>

            {roles.includes("caregiver") && (
              <FormSection title="Caregiver Assessments Received">
                {cgAssessments.length === 0 ? <div className="text-xs text-muted-foreground">No assessments on file.</div> : (
                  <ul className="divide-y divide-border">
                    {cgAssessments.map((a) => {
                      const taskMap = (a.tasks ?? {}) as Record<string, { observed?: string }>;
                      const noCount = Object.values(taskMap).filter((t) => t?.observed === "no").length;
                      return (
                        <li key={a.id} className="py-2 flex items-center justify-between text-sm">
                          <Link to="/patients/$patientId/caregiver-assessment" params={{ patientId: a.patient_id }} className="hover:underline">
                            <div className="font-bold">{a.patients?.first_name} {a.patients?.last_name}</div>
                            <div className="text-[11px] font-mono text-muted-foreground">{a.service_date}</div>
                          </Link>
                          <span className={"text-[10px] font-bold uppercase " + (noCount > 0 ? "text-destructive" : "text-primary")}>{noCount > 0 ? `${noCount} concern${noCount > 1 ? "s" : ""}` : "all clear"}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </FormSection>
            )}

            {(roles.includes("rn") || roles.includes("admin") || rnAssessments.length > 0) && (
              <FormSection title="RN Assessments Performed">
                {rnAssessments.length === 0 ? <div className="text-xs text-muted-foreground">No RN assessments on file.</div> : (
                  <ul className="divide-y divide-border">
                    {rnAssessments.map((a) => {
                      const taskMap = (a.tasks ?? {}) as Record<string, { observed?: string }>;
                      const noCount = Object.values(taskMap).filter((t) => t?.observed === "no").length;
                      const completed = Object.values(taskMap).filter((t) => !!t?.observed).length;
                      return (
                        <li key={a.id} className="py-2 flex items-center justify-between text-sm">
                          <Link to="/patients/$patientId/rn-assessment" params={{ patientId: a.patient_id }} className="hover:underline">
                            <div className="font-bold flex items-center gap-2"><Stethoscope className="size-3.5 text-primary" />{a.patients?.first_name} {a.patients?.last_name}</div>
                            <div className="text-[11px] font-mono text-muted-foreground">{a.assessment_date} · {completed} tasks</div>
                          </Link>
                          <span className={"text-[10px] font-bold uppercase " + (noCount > 0 ? "text-destructive" : "text-primary")}>{noCount > 0 ? `${noCount} concern${noCount > 1 ? "s" : ""}` : "all clear"}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </FormSection>
            )}
          </div>

          <div className="space-y-6">
            <div className="border border-border p-5 bg-card space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Status</div>
              <div className={"text-xs font-bold uppercase " + (profile.active ? "text-primary" : "text-muted-foreground")}>
                {profile.active ? "Active" : "Inactive"}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-4">Roles</div>
              <div className="flex flex-wrap gap-1">
                {roles.length === 0 && <span className="text-[10px] text-muted-foreground">None assigned</span>}
                {roles.map((r) => (
                  <span key={r} className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-2 py-0.5 inline-flex items-center gap-1">
                    <ShieldCheck className="size-3" />{r}
                  </span>
                ))}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-4">Member Since</div>
              <div className="text-xs font-mono">{new Date(profile.created_at).toLocaleDateString()}</div>
            </div>

            <div className="border border-border p-5 bg-card space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Contact</div>
              <div className="text-xs flex items-center gap-2"><Mail className="size-3.5 text-muted-foreground" />{profile.email ?? "—"}</div>
              <div className="text-xs flex items-center gap-2"><Phone className="size-3.5 text-muted-foreground" />{profile.phone ?? "—"}</div>
              <div className="text-xs flex items-center gap-2"><IdCard className="size-3.5 text-muted-foreground" />{profile.license_no ?? "—"}</div>
            </div>

            <div className="border border-border p-5 bg-card space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1"><UsersIcon className="size-3" /> Assigned Patients ({assignments.length})</div>
              {assignments.length === 0 ? (
                <div className="text-xs text-muted-foreground">No assignments.</div>
              ) : (
                <ul className="space-y-1">
                  {assignments.map((a) => (
                    <li key={a.id} className="text-xs">
                      <Link to="/patients/$patientId" params={{ patientId: a.patient_id }} className="hover:underline">
                        {a.patients?.first_name} {a.patients?.last_name}
                      </Link>
                      <span className="text-[10px] font-mono text-muted-foreground ml-2">{a.role}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-border p-5 bg-card space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1"><ClipboardList className="size-3" /> Activity Summary</div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><div className="text-2xl font-extrabold">{visits.length}</div><div className="text-[9px] font-mono uppercase text-muted-foreground">Visits</div></div>
                <div><div className="text-2xl font-extrabold">{timesheets.length}</div><div className="text-[9px] font-mono uppercase text-muted-foreground">Timesheets</div></div>
                <div><div className="text-2xl font-extrabold">{cgAssessments.length + rnAssessments.length}</div><div className="text-[9px] font-mono uppercase text-muted-foreground">Assessments</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
