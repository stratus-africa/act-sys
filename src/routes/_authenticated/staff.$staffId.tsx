import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FormSection, FieldLabel, TextInput } from "@/components/app/FormSection";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, IdCard, ShieldCheck, ClipboardList, Users as UsersIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/$staffId")({ component: StaffProfilePage });

type Profile = { id: string; email: string | null; full_name: string | null; phone: string | null; license_no: string | null; active: boolean; created_at: string };
const ROLES = ["admin", "rn", "caregiver", "patient"] as const;
type RoleName = (typeof ROLES)[number];

function StaffProfilePage() {
  const { staffId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const isAdmin = primaryRole === "admin";
  const isSelf = user?.id === staffId;
  const canEdit = isAdmin || isSelf;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<RoleName[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [cgAssessments, setCgAssessments] = useState<any[]>([]);
  const [edit, setEdit] = useState({ full_name: "", phone: "", license_no: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: r }, { data: a }, { data: v }, { data: ts }, { data: cga }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", staffId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", staffId),
      supabase.from("patient_assignments").select("*, patients:patient_id(id, first_name, last_name)").eq("staff_id", staffId),
      supabase.from("visits").select("id, scheduled_date, scheduled_time, status, patient_id, patients:patient_id(first_name, last_name)").eq("staff_id", staffId).order("scheduled_date", { ascending: false }).limit(10),
      supabase.from("timesheets").select("id, week_start, hours, status").eq("staff_id", staffId).order("week_start", { ascending: false }).limit(8),
      supabase.from("caregiver_assessments").select("id, service_date, patient_id, patients:patient_id(first_name, last_name), tasks").eq("caregiver_id", staffId).order("service_date", { ascending: false }).limit(8),
    ]);
    setProfile(p as Profile | null);
    setRoles(((r ?? []) as Array<{ role: RoleName }>).map((x) => x.role));
    setAssignments(a ?? []);
    setVisits(v ?? []);
    setTimesheets(ts ?? []);
    setCgAssessments(cga ?? []);
    if (p) setEdit({ full_name: p.full_name ?? "", phone: p.phone ?? "", license_no: p.license_no ?? "" });
  }, [staffId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: edit.full_name || null,
      phone: edit.phone || null,
      license_no: edit.license_no || null,
    }).eq("id", staffId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
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

  return (
    <>
      <PageHeader eyebrow="Staff Profile" title={profile.full_name ?? profile.email ?? "Unnamed"} />
      <div className="p-8 space-y-8 max-w-5xl">
        <Link to="/staff" className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Back to directory
        </Link>

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-6">
            <FormSection title="Identity" description={canEdit ? "Update profile details." : "Read-only view."}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Full Name</FieldLabel>
                  <TextInput value={edit.full_name} disabled={!canEdit} onChange={(e) => setEdit((s) => ({ ...s, full_name: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <TextInput value={profile.email ?? ""} disabled />
                </div>
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <TextInput value={edit.phone} disabled={!canEdit} onChange={(e) => setEdit((s) => ({ ...s, phone: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>License Number</FieldLabel>
                  <TextInput value={edit.license_no} disabled={!canEdit} onChange={(e) => setEdit((s) => ({ ...s, license_no: e.target.value }))} />
                </div>
              </div>
              {canEdit && (
                <button type="button" onClick={save} disabled={saving} className="mt-4 px-5 py-2 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-40">
                  {saving ? "Saving…" : "Save Profile"}
                </button>
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
                <div><div className="text-2xl font-extrabold">{cgAssessments.length}</div><div className="text-[9px] font-mono uppercase text-muted-foreground">CG Assess</div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
