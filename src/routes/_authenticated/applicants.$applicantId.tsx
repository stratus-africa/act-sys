import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FormSection, FieldLabel, TextInput, TextArea } from "@/components/app/FormSection";
import { APPLICANT_POSITIONS, APPLICANT_STATUSES, ONBOARDING_DOCS, PCA_SKILLS, skillKey } from "@/lib/hr-constants";
import { validateUpload } from "@/lib/file-upload";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { toast } from "sonner";
import { ArrowLeft, Check, FileText, Upload, UserCheck, Trash2, Download, AlertTriangle, ChevronDown, Pencil } from "lucide-react";

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

// Online onboarding form acknowledgements (legal text shown above the signature line).
const FORM_STATEMENTS: Record<string, string> = {
  application: "I certify that the information provided in this employment application is true and complete. I understand that any false statement, omission, or misrepresentation may result in rejection of this application or termination of employment.",
  criminal_background: "I authorize the agency to perform a criminal background inquiry and to obtain any related records from law enforcement agencies. I understand the results will be used to determine my eligibility for employment.",
  background_check: "I consent to a third-party background investigation including verification of identity, employment history, references, and any records relevant to my suitability for this position.",
  lifting_agreement: "I acknowledge that this position may require lifting, pulling, transferring, and repositioning of patients. I confirm that I am physically able to perform these duties safely and in accordance with proper body mechanics training.",
  at_will: "I understand and agree that my employment with the agency is on an at-will basis, meaning that either party may terminate the employment relationship at any time, with or without cause or notice.",
  ethics: "I have received and read the Code of Ethics. I agree to abide by all professional, ethical, and legal standards while representing the agency, including respect for patient dignity, honesty, and integrity in all interactions.",
  confidentiality: "I agree to keep confidential all patient health information, agency records, and proprietary information in accordance with HIPAA and agency privacy policies. I understand that any unauthorized disclosure may result in disciplinary action and legal liability.",
  hepatitis_b: "I acknowledge that I have been informed about the risks of Hepatitis B exposure and the availability of the vaccine at no cost. I have made an informed decision regarding vaccination as recorded below.",
  tb_review: "I confirm that I have reviewed the tuberculosis symptom questionnaire and have disclosed any signs or symptoms accurately. I agree to report any future symptoms immediately.",
  health_certificate: "I attest that the health information I have provided is accurate and that I am physically and mentally fit to perform the essential duties of this position.",
  training_ack: "I acknowledge that I have completed the required orientation and training and have had the opportunity to ask questions. I agree to follow all policies and procedures presented.",
  reference_check: "I authorize the agency to contact the references I have provided and to verify my employment history.",
  w4: "Under penalties of perjury, I declare that the W-4 withholding information I provide is, to the best of my knowledge, true, correct, and complete.",
  w9: "Under penalties of perjury, I certify that the taxpayer identification information I provide is correct and that I am not subject to backup withholding.",
  contractor_agreement: "I have read and agree to the terms of the Contractor Agreement, including the scope of work, compensation, and independent contractor status.",
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
          <StageHistoryViewer history={(a.stage_history ?? []) as StageEntry[]} />
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
                <p className="text-xs text-muted-foreground mt-1">Fill out each form online with a typed signature, or upload a completed copy.</p>
              </div>
              <div className="text-xs font-mono text-muted-foreground">{completedDocs} / {ONBOARDING_DOCS.length} complete</div>
            </div>
            <Accordion type="multiple" className="divide-y divide-border">
              {ONBOARDING_DOCS.map((od) => {
                const existing = docs.find((d) => d.kind === od.kind);
                const status = existing?.status ?? "pending";
                return (
                  <AccordionItem key={od.kind} value={od.kind} className="border-0">
                    <div className="px-6 py-3 flex flex-wrap items-center gap-3">
                      <FileText className="size-4 text-muted-foreground" />
                      <div className="flex-1 min-w-60">
                        <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                          {od.label}
                          {od.required && <span className="text-[9px] font-bold uppercase text-destructive">Required</span>}
                          <span className={"text-[10px] font-bold uppercase px-2 py-0.5 " + (status === "completed" ? "bg-primary/10 text-primary" : status === "declined" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{status}</span>
                        </div>
                        {existing?.signed_at && <div className="text-[10px] font-mono text-muted-foreground mt-1">Signed {new Date(existing.signed_at).toLocaleString()}</div>}
                      </div>
                      {existing?.file_path && (
                        <button onClick={() => downloadDoc(existing.file_path!)} className="text-xs underline inline-flex items-center gap-1"><Download className="size-3" /> View file</button>
                      )}
                      <AccordionTrigger className="py-0 px-3 border border-border hover:border-primary text-[10px] font-bold uppercase tracking-widest flex-none">
                        <span className="inline-flex items-center gap-1"><Pencil className="size-3" /> Fill / View</span>
                      </AccordionTrigger>
                    </div>
                    <AccordionContent className="px-6 pb-5">
                      <OnboardingFormFiller
                        kind={od.kind}
                        label={od.label}
                        statement={FORM_STATEMENTS[od.kind] ?? "I confirm that the information provided is accurate and complete."}
                        existing={existing}
                        onSubmit={async (payload) => {
                          await upsertDoc(od.kind, payload as any);
                          toast.success(`${od.label} submitted`);
                        }}
                        onUpload={async (f) => { await uploadDocFile(od.kind, f); }}
                        onStatusChange={async (s) => { await upsertDoc(od.kind, { status: s }); }}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
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

            <Accordion type="multiple" defaultValue={[PCA_SKILLS[0]?.group]} className="space-y-2">
              {PCA_SKILLS.map((group) => {
                const rated = group.items.filter((item) => skills?.ratings?.[skillKey(group.group, item)] != null).length;
                return (
                  <AccordionItem key={group.group} value={group.group} className="border border-border">
                    <AccordionTrigger className="px-4 py-2 bg-muted text-[10px] font-bold uppercase tracking-widest hover:no-underline">
                      <span className="flex items-center gap-3">
                        {group.group}
                        <span className="text-muted-foreground font-mono normal-case tracking-normal">{rated}/{group.items.length} rated</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
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
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
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

function OnboardingFormFiller({
  kind, label, statement, existing, onSubmit, onUpload, onStatusChange,
}: {
  kind: string;
  label: string;
  statement: string;
  existing?: Doc;
  onSubmit: (payload: { data: any; signature_typed: string; status: string; signed_at: string }) => Promise<void> | void;
  onUpload: (f: File) => Promise<void> | void;
  onStatusChange: (s: string) => Promise<void> | void;
}) {
  const initialData = (existing?.data ?? {}) as any;
  const [acknowledged, setAcknowledged] = useState<boolean>(!!initialData.acknowledged);
  const [notes, setNotes] = useState<string>(initialData.notes ?? "");
  const [response, setResponse] = useState<string>(initialData.response ?? "");
  const [signature, setSignature] = useState<string>((existing as any)?.signature_typed ?? "");
  const [submitting, setSubmitting] = useState(false);
  const status = existing?.status ?? "pending";

  const handleSubmit = async () => {
    if (!acknowledged) return toast.error("You must acknowledge the statement");
    if (!signature.trim()) return toast.error("Typed signature required");
    setSubmitting(true);
    await onSubmit({
      data: { acknowledged: true, notes, response, kind },
      signature_typed: signature.trim(),
      status: "completed",
      signed_at: new Date().toISOString(),
    });
    setSubmitting(false);
  };

  return (
    <div className="space-y-4 border-l-2 border-primary/30 pl-4">
      <div className="text-xs text-muted-foreground italic leading-relaxed">{statement}</div>

      {(kind === "hepatitis_b" || kind === "tb_review") && (
        <div>
          <FieldLabel>Your Response</FieldLabel>
          <select value={response} onChange={(e) => setResponse(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
            <option value="">— Select —</option>
            {kind === "hepatitis_b" ? (
              <>
                <option value="accept">I ACCEPT the Hepatitis B vaccine</option>
                <option value="decline">I DECLINE the Hepatitis B vaccine</option>
                <option value="already_vaccinated">I am already vaccinated</option>
              </>
            ) : (
              <>
                <option value="no_symptoms">I have NO symptoms of TB</option>
                <option value="has_symptoms">I have symptoms — see notes</option>
              </>
            )}
          </select>
        </div>
      )}

      <div>
        <FieldLabel>Notes / Additional Information (optional)</FieldLabel>
        <TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any clarifying information…" />
      </div>

      <label className="flex items-start gap-2 text-xs cursor-pointer">
        <input type="checkbox" className="mt-0.5" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
        <span>I have read and acknowledge the statement above for <strong>{label}</strong>.</span>
      </label>

      <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <FieldLabel>Typed Signature *</FieldLabel>
          <TextInput value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Type your full legal name" />
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !acknowledged || !signature.trim()}
          className="bg-primary text-primary-foreground px-5 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 disabled:opacity-40"
        >
          <Check className="size-3.5" /> {submitting ? "Submitting…" : existing?.signed_at ? "Re-sign" : "Sign & Submit"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
        <label className="cursor-pointer text-xs inline-flex items-center gap-1 px-3 py-1.5 border border-border hover:border-primary">
          <Upload className="size-3" /> Upload completed copy instead
          <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }} />
        </label>
        <select value={status} onChange={(e) => onStatusChange(e.target.value)} className="border border-border bg-background text-xs px-2 py-1">
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="declined">Declined</option>
          <option value="expired">Expired</option>
        </select>
      </div>
    </div>
  );
}


function StageHistoryViewer({ history }: { history: StageEntry[] }) {
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = Array.from(new Set(history.map((h) => h.by).filter(Boolean))) as string[];
    if (!ids.length) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email || p.id.slice(0, 8); });
      setNames(map);
    })();
  }, [history]);

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stage History</h4>
        <span className="text-[10px] font-mono text-muted-foreground">{history.length} {history.length === 1 ? "transition" : "transitions"}</span>
      </div>
      {history.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic py-3 text-center border border-dashed border-border">No stage transitions yet.</div>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">When</th>
                <th className="px-3 py-2 text-left">From</th>
                <th className="px-3 py-2 text-left">To</th>
                <th className="px-3 py-2 text-left">Changed By</th>
                <th className="px-3 py-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((h, i) => (
                <tr key={i} className="hover:bg-muted/30 align-top">
                  <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-muted-foreground">{new Date(h.at).toLocaleString()}</td>
                  <td className="px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border border-border px-1.5 py-0.5">{h.from}</span></td>
                  <td className="px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40 bg-primary/5 px-1.5 py-0.5">{h.to}</span></td>
                  <td className="px-3 py-2 text-[11px]">{h.by ? (names[h.by] ?? <span className="text-muted-foreground">…</span>) : <span className="text-muted-foreground italic">system</span>}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground italic">{h.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
