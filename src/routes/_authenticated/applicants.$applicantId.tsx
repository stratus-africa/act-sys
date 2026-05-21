import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FormSection, FieldLabel, TextInput, TextArea } from "@/components/app/FormSection";
import { APPLICANT_POSITIONS, APPLICANT_STATUSES, ONBOARDING_DOCS, PCA_SKILLS, skillKey } from "@/lib/hr-constants";
import { validateUpload, MAX_UPLOAD_MB } from "@/lib/file-upload";
import { toast } from "sonner";
import { ArrowLeft, Check, FileText, Upload, UserCheck, Trash2, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/applicants/$applicantId")({ component: ApplicantDetailPage });

type StageEntry = { from: string; to: string; note: string | null; at: string; by: string | null };
type Applicant = {
  id: string;
  first_name: string; last_name: string;
  email: string | null; phone: string | null;
  address: string | null; city: string | null; state: string | null; zip: string | null;
  dob: string | null; ssn_last4: string | null;
  position: string; status: string; applied_at: string;
  emergency_contact_name: string | null; emergency_contact_phone: string | null; emergency_contact_relation: string | null;
  counties_willing: string[] | null;
  pay_agreement: string | null; interviewer: string | null;
  source: string | null; notes: string | null;
  rejection_reason: string | null; hired_user_id: string | null; hired_at: string | null;
  stage_history: StageEntry[] | null;
};

const STAGE_FLOW = ["applied", "screening", "background", "interview", "offer", "hired"] as const;
const STAGE_REQUIRED_DOCS: Record<string, string[]> = {
  screening: ["application"],
  background: ["criminal_background", "background_check"],
  interview: [],
  offer: ["ethics", "confidentiality", "hepatitis_b", "tb_review"],
  hired: ["w4", "health_certificate", "training_ack"],
};

type Doc = { id: string; kind: string; status: string; data: any; file_path: string | null; signed_at: string | null; updated_at: string };
type Skills = { id: string; checklist_kind: string; ratings: Record<string, number>; rn_supervisor_name: string | null; observed_at: string | null; signed_at: string | null };

function ApplicantDetailPage() {
  const { applicantId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const navigate = useNavigate();
  const canManage = primaryRole === "admin" || primaryRole === "rn";

  const [a, setA] = useState<Applicant | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [skills, setSkills] = useState<Skills | null>(null);
  const [tab, setTab] = useState<"profile" | "documents" | "skills" | "hire">("profile");
  const [edit, setEdit] = useState<Partial<Applicant>>({});
  const [saving, setSaving] = useState(false);
  const [hireEmail, setHireEmail] = useState("");
  const [hiring, setHiring] = useState(false);
  const [stageNote, setStageNote] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: ap }, { data: ds }, { data: sk }] = await Promise.all([
      (supabase.from("applicants" as any) as any).select("*").eq("id", applicantId).maybeSingle(),
      (supabase.from("applicant_documents" as any) as any).select("*").eq("applicant_id", applicantId),
      (supabase.from("applicant_skills" as any) as any).select("*").eq("applicant_id", applicantId).maybeSingle(),
    ]);
    setA(ap as Applicant | null);
    setDocs((ds ?? []) as Doc[]);
    setSkills(sk as Skills | null);
    if (ap) {
      setEdit(ap);
      setHireEmail((ap as Applicant).email ?? "");
    }
  }, [applicantId]);
  useEffect(() => { load(); }, [load]);

  if (!canManage) return <><PageHeader eyebrow="HR" title="Applicant" /><div className="p-8 text-sm text-muted-foreground">Admin or RN access required.</div></>;
  if (!a) return <><PageHeader eyebrow="HR" title="Applicant" /><div className="p-8 text-sm text-muted-foreground">Loading…</div></>;

  const save = async () => {
    setSaving(true);
    const counties = typeof edit.counties_willing === "string" ? (edit.counties_willing as string).split(",").map((s) => s.trim()).filter(Boolean) : edit.counties_willing;
    const payload: any = { ...edit, counties_willing: counties };
    delete payload.id;
    const { error } = await (supabase.from("applicants" as any) as any).update(payload).eq("id", applicantId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Applicant saved");
    load();
  };

  const updateStatus = async (status: string) => {
    const { error } = await (supabase.from("applicants" as any) as any).update({ status }).eq("id", applicantId);
    if (error) return toast.error(error.message);
    setA((p) => p ? { ...p, status } : p);
    toast.success("Status updated");
  };

  const completedKinds = new Set(docs.filter((d) => d.status === "completed").map((d) => d.kind));
  const currentIdx = STAGE_FLOW.indexOf(a.status as any);
  const nextStage = currentIdx >= 0 && currentIdx < STAGE_FLOW.length - 1 ? STAGE_FLOW[currentIdx + 1] : null;
  const missingForNext = nextStage ? (STAGE_REQUIRED_DOCS[nextStage] ?? []).filter((k) => !completedKinds.has(k)) : [];

  const advanceStage = async (toStatus: string, note: string) => {
    if (!a) return;
    const missing = (STAGE_REQUIRED_DOCS[toStatus] ?? []).filter((k) => !completedKinds.has(k));
    if (missing.length > 0) return toast.error(`Cannot advance: missing ${missing.join(", ")}`);
    if (!note.trim()) return toast.error("A transition note is required");
    setAdvancing(true);
    const entry: StageEntry = { from: a.status, to: toStatus, note: note.trim(), at: new Date().toISOString(), by: user?.id ?? null };
    const next = [entry, ...((a.stage_history ?? []) as StageEntry[])];
    const { error } = await (supabase.from("applicants" as any) as any).update({ status: toStatus, stage_history: next }).eq("id", applicantId);
    setAdvancing(false);
    if (error) return toast.error(error.message);
    setStageNote("");
    toast.success(`Moved to ${toStatus}`);
    load();
  };

  const upsertDoc = async (kind: string, patch: Partial<Doc>) => {
    const existing = docs.find((d) => d.kind === kind);
    if (existing) {
      const { error } = await (supabase.from("applicant_documents" as any) as any).update(patch).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase.from("applicant_documents" as any) as any).insert({ applicant_id: applicantId, kind, ...patch });
      if (error) return toast.error(error.message);
    }
    load();
  };

  const uploadDocFile = async (kind: string, file: File) => {
    const err = validateUpload(file);
    if (err) return toast.error(err);
    const path = `applicants/${applicantId}/${kind}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("hr-documents").upload(path, file, { contentType: file.type || undefined });
    if (upErr) return toast.error(upErr.message);
    await upsertDoc(kind, { file_path: path, status: "completed", signed_at: new Date().toISOString() } as any);
    toast.success("File uploaded");
  };

  const downloadDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("hr-documents").createSignedUrl(path, 60);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    window.open(data.signedUrl, "_blank");
  };

  const setSkillRating = async (key: string, rating: number) => {
    const next = { ...(skills?.ratings ?? {}), [key]: rating };
    if (skills) {
      const { error } = await (supabase.from("applicant_skills" as any) as any).update({ ratings: next }).eq("id", skills.id);
      if (error) return toast.error(error.message);
      setSkills({ ...skills, ratings: next });
    } else {
      const { data, error } = await (supabase.from("applicant_skills" as any) as any)
        .insert({ applicant_id: applicantId, checklist_kind: a.position === "rn" ? "rn" : "pca", ratings: next, created_by: user?.id })
        .select("*").single();
      if (error) return toast.error(error.message);
      setSkills(data as Skills);
    }
  };

  const saveSkillsMeta = async (patch: Partial<Skills>) => {
    if (!skills) return;
    const { error } = await (supabase.from("applicant_skills" as any) as any).update(patch).eq("id", skills.id);
    if (error) return toast.error(error.message);
    setSkills({ ...skills, ...patch });
    toast.success("Saved");
  };

  const convertToStaff = async () => {
    if (!hireEmail.trim()) return toast.error("Email required to invite");
    if (!confirm(`Send invitation to ${hireEmail} as ${a.position}? The applicant will be hired once they sign up.`)) return;
    setHiring(true);
    const role = a.position === "rn" ? "rn" : "caregiver";
    const { error: invErr } = await supabase.from("staff_invitations").insert({ email: hireEmail.toLowerCase(), role, invited_by: user?.id });
    if (invErr) { setHiring(false); return toast.error(invErr.message); }
    await (supabase.from("applicants" as any) as any).update({ status: "hired", hired_at: new Date().toISOString() }).eq("id", applicantId);
    setHiring(false);
    toast.success("Invitation sent and applicant marked Hired");
    load();
  };

  const status = APPLICANT_STATUSES.find((s) => s.value === a.status);
  const completedDocs = docs.filter((d) => d.status === "completed").length;
  const requiredDocs = ONBOARDING_DOCS.filter((d) => d.required).length;

  return (
    <>
      <PageHeader
        eyebrow={`Applicant · ${APPLICANT_POSITIONS.find((p) => p.value === a.position)?.label ?? a.position}`}
        title={`${a.first_name} ${a.last_name}`}
        description={a.email ?? a.phone ?? ""}
        actions={
          <select value={a.status} onChange={(e) => updateStatus(e.target.value)} className={"px-3 py-2 border text-xs font-bold uppercase " + (status?.tone === "primary" ? "border-primary text-primary" : status?.tone === "destructive" ? "border-destructive text-destructive" : "border-border")}>
            {APPLICANT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        }
      />
      <div className="p-6 lg:p-8 space-y-6">
        <Link to="/applicants" className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Back to applicants
        </Link>

        <div className="border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest">Onboarding Pipeline</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Move the applicant through each stage. A transition note is required and missing documents will block progress.</p>
            </div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Current: <span className="text-foreground font-bold">{a.status}</span></div>
          </div>
          <ol className="flex flex-wrap items-center gap-1">
            {STAGE_FLOW.map((s, i) => {
              const isDone = i < currentIdx || a.status === "hired";
              const isCurrent = i === currentIdx;
              return (
                <li key={s} className="flex items-center gap-1">
                  <span className={"px-3 py-1 text-[10px] font-bold uppercase tracking-widest border " + (isCurrent ? "bg-primary text-primary-foreground border-primary" : isDone ? "border-primary/40 text-primary" : "border-border text-muted-foreground")}>{s}</span>
                  {i < STAGE_FLOW.length - 1 && <span className="text-muted-foreground">→</span>}
                </li>
              );
            })}
          </ol>
          {nextStage && a.status !== "rejected" && a.status !== "withdrawn" && (
            <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end pt-3 border-t border-border">
              <div>
                <FieldLabel>Transition note (required) — advancing to <span className="text-foreground">{nextStage}</span></FieldLabel>
                <TextArea rows={2} value={stageNote} onChange={(e) => setStageNote(e.target.value)} placeholder={`Why is the applicant moving to ${nextStage}?`} />
                {missingForNext.length > 0 && (
                  <div className="text-[11px] text-destructive mt-1.5 flex items-start gap-1">
                    <AlertTriangle className="size-3 mt-0.5" /> Missing required docs for <strong>{nextStage}</strong>: {missingForNext.map((k) => ONBOARDING_DOCS.find((d) => d.kind === k)?.label ?? k).join(", ")}
                  </div>
                )}
              </div>
              <button
                onClick={() => advanceStage(nextStage, stageNote)}
                disabled={advancing || missingForNext.length > 0 || !stageNote.trim()}
                className="bg-primary text-primary-foreground px-5 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-40"
              >
                {advancing ? "Advancing…" : `Advance → ${nextStage}`}
              </button>
            </div>
          )}
          {(a.stage_history ?? []).length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground font-mono uppercase tracking-widest text-[10px]">Stage History ({(a.stage_history ?? []).length})</summary>
              <ul className="mt-2 space-y-1.5 border-t border-border pt-2">
                {(a.stage_history ?? []).map((h, i) => (
                  <li key={i} className="text-[11px] flex flex-wrap gap-x-2">
                    <span className="font-mono text-muted-foreground">{new Date(h.at).toLocaleString()}</span>
                    <span><strong>{h.from}</strong> → <strong>{h.to}</strong></span>
                    {h.note && <span className="text-muted-foreground italic">"{h.note}"</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>



        <div className="flex gap-1 border-b border-border">
          {[
            { id: "profile", label: "Profile" },
            { id: "documents", label: `Onboarding Forms (${completedDocs}/${requiredDocs})` },
            { id: "skills", label: "Skills Checklist" },
            { id: "hire", label: "Hire & Convert" },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={"px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 -mb-px " + (tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="border border-border bg-card p-6 space-y-6">
            <FormSection title="Personal Data">
              <div className="grid md:grid-cols-2 gap-3">
                <div><FieldLabel>First Name</FieldLabel><TextInput value={edit.first_name ?? ""} onChange={(e) => setEdit((s) => ({ ...s, first_name: e.target.value }))} /></div>
                <div><FieldLabel>Last Name</FieldLabel><TextInput value={edit.last_name ?? ""} onChange={(e) => setEdit((s) => ({ ...s, last_name: e.target.value }))} /></div>
                <div><FieldLabel>Email</FieldLabel><TextInput type="email" value={edit.email ?? ""} onChange={(e) => setEdit((s) => ({ ...s, email: e.target.value }))} /></div>
                <div><FieldLabel>Phone</FieldLabel><TextInput value={edit.phone ?? ""} onChange={(e) => setEdit((s) => ({ ...s, phone: e.target.value }))} /></div>
                <div className="md:col-span-2"><FieldLabel>Address</FieldLabel><TextInput value={edit.address ?? ""} onChange={(e) => setEdit((s) => ({ ...s, address: e.target.value }))} /></div>
                <div><FieldLabel>City</FieldLabel><TextInput value={edit.city ?? ""} onChange={(e) => setEdit((s) => ({ ...s, city: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><FieldLabel>State</FieldLabel><TextInput value={edit.state ?? ""} onChange={(e) => setEdit((s) => ({ ...s, state: e.target.value }))} /></div>
                  <div><FieldLabel>ZIP</FieldLabel><TextInput value={edit.zip ?? ""} onChange={(e) => setEdit((s) => ({ ...s, zip: e.target.value }))} /></div>
                </div>
                <div><FieldLabel>Date of Birth</FieldLabel><TextInput type="date" value={edit.dob ?? ""} onChange={(e) => setEdit((s) => ({ ...s, dob: e.target.value }))} /></div>
                <div><FieldLabel>SSN (last 4)</FieldLabel><TextInput maxLength={4} value={edit.ssn_last4 ?? ""} onChange={(e) => setEdit((s) => ({ ...s, ssn_last4: e.target.value }))} /></div>
                <div>
                  <FieldLabel>Position</FieldLabel>
                  <select value={edit.position} onChange={(e) => setEdit((s) => ({ ...s, position: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-sm">
                    {APPLICANT_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div><FieldLabel>Source / Referred By</FieldLabel><TextInput value={edit.source ?? ""} onChange={(e) => setEdit((s) => ({ ...s, source: e.target.value }))} /></div>
              </div>
            </FormSection>

            <FormSection title="Emergency Contact">
              <div className="grid md:grid-cols-3 gap-3">
                <div><FieldLabel>Name</FieldLabel><TextInput value={edit.emergency_contact_name ?? ""} onChange={(e) => setEdit((s) => ({ ...s, emergency_contact_name: e.target.value }))} /></div>
                <div><FieldLabel>Phone</FieldLabel><TextInput value={edit.emergency_contact_phone ?? ""} onChange={(e) => setEdit((s) => ({ ...s, emergency_contact_phone: e.target.value }))} /></div>
                <div><FieldLabel>Relationship</FieldLabel><TextInput value={edit.emergency_contact_relation ?? ""} onChange={(e) => setEdit((s) => ({ ...s, emergency_contact_relation: e.target.value }))} /></div>
              </div>
            </FormSection>

            <FormSection title="Availability & Hiring">
              <div className="grid md:grid-cols-2 gap-3">
                <div><FieldLabel>Counties Willing to Work (comma separated)</FieldLabel>
                  <TextInput value={Array.isArray(edit.counties_willing) ? edit.counties_willing.join(", ") : (edit.counties_willing as any) ?? ""}
                    onChange={(e) => setEdit((s) => ({ ...s, counties_willing: e.target.value as any }))} />
                </div>
                <div><FieldLabel>Pay Agreement</FieldLabel><TextInput value={edit.pay_agreement ?? ""} onChange={(e) => setEdit((s) => ({ ...s, pay_agreement: e.target.value }))} /></div>
                <div><FieldLabel>Interviewer</FieldLabel><TextInput value={edit.interviewer ?? ""} onChange={(e) => setEdit((s) => ({ ...s, interviewer: e.target.value }))} /></div>
                <div><FieldLabel>Applied Date</FieldLabel><TextInput type="date" value={edit.applied_at ?? ""} onChange={(e) => setEdit((s) => ({ ...s, applied_at: e.target.value }))} /></div>
                <div className="md:col-span-2"><FieldLabel>HR Notes</FieldLabel><TextArea rows={4} value={edit.notes ?? ""} onChange={(e) => setEdit((s) => ({ ...s, notes: e.target.value }))} /></div>
              </div>
            </FormSection>

            <button onClick={save} disabled={saving} className="bg-primary text-primary-foreground px-5 py-2 text-xs font-bold uppercase tracking-wider disabled:opacity-40">
              {saving ? "Saving…" : "Save Profile"}
            </button>
          </div>
        )}

        {tab === "documents" && (
          <div className="border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest">Onboarding Forms</h3>
                <p className="text-xs text-muted-foreground mt-1">Track and upload each required onboarding document.</p>
              </div>
              <div className="text-xs font-mono text-muted-foreground">{completedDocs} / {ONBOARDING_DOCS.length} complete</div>
            </div>
            <ul className="divide-y divide-border">
              {ONBOARDING_DOCS.map((od) => {
                const existing = docs.find((d) => d.kind === od.kind);
                const status = existing?.status ?? "pending";
                return (
                  <li key={od.kind} className="px-6 py-4 flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-60">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <FileText className="size-4 text-muted-foreground" />
                        {od.label}
                        {od.required && <span className="text-[9px] font-bold uppercase text-destructive">Required</span>}
                      </div>
                      {existing?.signed_at && <div className="text-[10px] font-mono text-muted-foreground mt-1">Updated {new Date(existing.signed_at).toLocaleString()}</div>}
                    </div>
                    <span className={"text-[10px] font-bold uppercase px-2 py-0.5 " + (status === "completed" ? "bg-primary/10 text-primary" : status === "declined" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{status}</span>
                    {existing?.file_path && (
                      <button onClick={() => downloadDoc(existing.file_path!)} className="text-xs underline inline-flex items-center gap-1"><Download className="size-3" /> View</button>
                    )}
                    <label className="cursor-pointer text-xs inline-flex items-center gap-1 px-3 py-1.5 border border-border hover:border-primary">
                      <Upload className="size-3" /> Upload
                      <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDocFile(od.kind, f); e.currentTarget.value = ""; }} />
                    </label>
                    <select value={status} onChange={(e) => upsertDoc(od.kind, { status: e.target.value })} className="border border-border bg-background text-xs px-2 py-1">
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="declined">Declined</option>
                      <option value="expired">Expired</option>
                    </select>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {tab === "skills" && (
          <div className="border border-border bg-card p-6 space-y-6">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-2">PCA Skills Checklist</h3>
              <p className="text-xs text-muted-foreground">
                Rate each skill: <strong>1</strong> = No knowledge · <strong>2</strong> = Understands but never performed · <strong>3</strong> = Performed infrequently (needs supervision) · <strong>4</strong> = Performs independently
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div><FieldLabel>RN Supervisor Name</FieldLabel><TextInput value={skills?.rn_supervisor_name ?? ""} onBlur={(e) => saveSkillsMeta({ rn_supervisor_name: e.target.value })} onChange={(e) => setSkills((s) => s ? { ...s, rn_supervisor_name: e.target.value } : s)} /></div>
              <div><FieldLabel>Date Observed</FieldLabel><TextInput type="date" value={skills?.observed_at ?? ""} onBlur={(e) => saveSkillsMeta({ observed_at: e.target.value })} onChange={(e) => setSkills((s) => s ? { ...s, observed_at: e.target.value } : s)} /></div>
              <div className="flex items-end">
                <button onClick={() => saveSkillsMeta({ signed_at: new Date().toISOString() })} className="w-full bg-primary text-primary-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-1">
                  <Check className="size-3.5" /> Mark Reviewed
                </button>
              </div>
            </div>

            {PCA_SKILLS.map((group) => (
              <div key={group.group} className="border border-border">
                <div className="px-4 py-2 bg-muted text-[10px] font-bold uppercase tracking-widest">{group.group}</div>
                <ul className="divide-y divide-border">
                  {group.items.map((item) => {
                    const key = skillKey(group.group, item);
                    const rating = skills?.ratings?.[key];
                    return (
                      <li key={key} className="px-4 py-2.5 flex items-center justify-between gap-4">
                        <span className="text-sm flex-1">{item}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((r) => (
                            <button key={r} onClick={() => setSkillRating(key, r)}
                              className={"size-8 text-xs font-bold border " + (rating === r ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary text-muted-foreground")}>
                              {r}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        {tab === "hire" && (
          <div className="border border-border bg-card p-6 space-y-6">
            <FormSection title="Convert Applicant to Staff" description="Sends an invitation; applicant becomes a Caregiver or RN once they sign up with this email. Status will be set to Hired.">
              {a.hired_at ? (
                <div className="border border-primary bg-primary/5 p-4 text-sm">
                  <div className="font-bold flex items-center gap-2"><UserCheck className="size-4 text-primary" /> Hired on {new Date(a.hired_at).toLocaleDateString()}</div>
                  {a.hired_user_id && <Link to="/staff/$staffId" params={{ staffId: a.hired_user_id }} className="text-xs underline mt-2 inline-block">View staff profile →</Link>}
                </div>
              ) : (
                <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
                  <div><FieldLabel>Invite Email</FieldLabel><TextInput type="email" value={hireEmail} onChange={(e) => setHireEmail(e.target.value)} /></div>
                  <button onClick={convertToStaff} disabled={hiring} className="bg-primary text-primary-foreground px-5 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 disabled:opacity-50">
                    <UserCheck className="size-3.5" /> {hiring ? "Sending…" : `Hire as ${a.position === "rn" ? "RN" : "Caregiver"}`}
                  </button>
                </div>
              )}
            </FormSection>

            <FormSection title="Reject Applicant">
              <TextArea rows={3} placeholder="Reason for rejection (internal)" value={edit.rejection_reason ?? ""} onChange={(e) => setEdit((s) => ({ ...s, rejection_reason: e.target.value }))} />
              <button onClick={async () => {
                await (supabase.from("applicants" as any) as any).update({ status: "rejected", rejection_reason: edit.rejection_reason }).eq("id", applicantId);
                toast.success("Applicant rejected");
                load();
              }} className="text-xs font-bold uppercase tracking-widest text-destructive border border-destructive px-4 py-2 inline-flex items-center gap-1">
                <Trash2 className="size-3.5" /> Reject Applicant
              </button>
            </FormSection>
          </div>
        )}
      </div>
    </>
  );
}
