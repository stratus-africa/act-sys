import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FormSection, FieldLabel, TextInput, TextArea, CheckboxRow, RadioGroup } from "@/components/app/FormSection";
import { SignaturePad } from "@/components/app/SignaturePad";
import { Progress } from "@/components/ui/progress";
import { validateUpload } from "@/lib/file-upload";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Save, Check, Upload, FileText, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/applicants/$applicantId/onboarding")({
  component: OnboardingWizardPage,
});

// ---------- Step config ----------
const STEPS = [
  { n: 1, title: "Welcome", desc: "Privacy notice & required documents" },
  { n: 2, title: "Personal Info", desc: "Identity, address, demographics" },
  { n: 3, title: "Licenses", desc: "Professional & driver licenses" },
  { n: 4, title: "Education", desc: "Schools & degrees" },
  { n: 5, title: "Work History", desc: "Past employment" },
  { n: 6, title: "References", desc: "Professional references" },
  { n: 7, title: "Compliance", desc: "TB, vaccines, health" },
  { n: 8, title: "Policies", desc: "Acknowledgements" },
  { n: 9, title: "Disclosures", desc: "Driving & criminal" },
  { n: 10, title: "Signatures", desc: "Final signatures" },
  { n: 11, title: "Review", desc: "Submit application" },
] as const;

const REQUIRED_UPLOADS = [
  { kind: "drivers_license", label: "Driver's License" },
  { kind: "auto_insurance", label: "Auto Insurance" },
  { kind: "ssn_card", label: "Social Security Card" },
  { kind: "professional_license", label: "Professional License (if applicable)" },
  { kind: "cpr_card", label: "CPR / BLS Certification" },
  { kind: "tb_test_doc", label: "TB Test Results" },
  { kind: "resume", label: "Résumé" },
];

const POLICY_LIST = [
  { key: "code_of_ethics", label: "Code of Ethics" },
  { key: "confidentiality", label: "Confidentiality / HIPAA" },
  { key: "at_will", label: "At-Will Employment" },
  { key: "lifting_safety", label: "Lifting & Body Mechanics" },
  { key: "infection_control", label: "Infection Control" },
  { key: "abuse_reporting", label: "Mandatory Abuse Reporting" },
  { key: "drug_free", label: "Drug-Free Workplace" },
];

const COMPLIANCE_ITEMS = [
  { kind: "tb_screening", label: "TB Screening" },
  { kind: "hep_b", label: "Hepatitis B Vaccine" },
  { kind: "flu_shot", label: "Influenza Vaccine" },
  { kind: "covid_vaccine", label: "COVID-19 Vaccine" },
  { kind: "background_check", label: "Background Check" },
  { kind: "physical_exam", label: "Physical Exam" },
];

// ---------- Types ----------
type Draft = Record<string, any>;
type Progress = { id: string; current_step: number; completed_steps: number[]; draft_data: Draft; last_saved_at: string };

// ---------- Page ----------
function OnboardingWizardPage() {
  const { applicantId } = Route.useParams();
  const { primaryRole } = useCurrentUser();
  const canManage = primaryRole === "admin" || primaryRole === "rn";

  const [applicant, setApplicant] = useState<any>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [step, setStep] = useState<number>(1);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: ap }, { data: pr }] = await Promise.all([
      (supabase.from("applicants" as any) as any).select("*").eq("id", applicantId).maybeSingle(),
      (supabase.from("applicant_onboarding_progress" as any) as any).select("*").eq("applicant_id", applicantId).maybeSingle(),
    ]);
    setApplicant(ap);
    if (pr) {
      setProgress(pr as Progress);
      setStep(pr.current_step ?? 1);
      setDraft((pr.draft_data as Draft) ?? {});
    } else {
      // create initial row
      const { data: created } = await (supabase.from("applicant_onboarding_progress" as any) as any)
        .insert({ applicant_id: applicantId, current_step: 1, completed_steps: [], draft_data: {} })
        .select().single();
      setProgress(created as Progress);
    }
    setLoading(false);
  }, [applicantId]);
  useEffect(() => { load(); }, [load]);

  // Autosave draft (debounced)
  useEffect(() => {
    if (!progress) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      setSaving(true);
      await (supabase.from("applicant_onboarding_progress" as any) as any)
        .update({ draft_data: draft, current_step: step, last_saved_at: new Date().toISOString() })
        .eq("id", progress.id);
      setSaving(false);
    }, 800);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [draft, step, progress]);

  const setField = (path: string, value: any) => setDraft((d) => ({ ...d, [path]: value }));

  const markStepComplete = async (n: number, nextStep: number) => {
    if (!progress) return;
    const completed = Array.from(new Set([...(progress.completed_steps ?? []), n]));
    const { error } = await (supabase.from("applicant_onboarding_progress" as any) as any)
      .update({ completed_steps: completed, current_step: nextStep, draft_data: draft })
      .eq("id", progress.id);
    if (error) return toast.error(error.message);
    setProgress({ ...progress, completed_steps: completed, current_step: nextStep });
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step commit: persists step data to the proper tables before advancing.
  const commitAndAdvance = async () => {
    if (!progress) return;
    try {
      if (step === 2) await persistPersonal(applicantId, draft);
      if (step === 3) await persistLicenses(applicantId, draft);
      if (step === 4) await persistEducation(applicantId, draft);
      if (step === 5) await persistWorkHistory(applicantId, draft);
      if (step === 6) await persistReferences(applicantId, draft);
      if (step === 7) await persistCompliance(applicantId, draft);
      if (step === 8) await persistPolicies(applicantId, draft);
      if (step === 9) await persistDisclosures(applicantId, draft);
      if (step === 10) await persistSignatures(applicantId, draft);
      if (step === 11) {
        await (supabase.from("applicant_onboarding_progress" as any) as any)
          .update({ submitted_at: new Date().toISOString() }).eq("id", progress.id);
        toast.success("Onboarding submitted");
        return;
      }
      await markStepComplete(step, Math.min(step + 1, 11));
      toast.success(`Step ${step} saved`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save step");
    }
  };

  if (!canManage) return <><PageHeader eyebrow="HR" title="Onboarding" /><div className="p-8 text-sm text-muted-foreground">Admin or RN access required.</div></>;
  if (loading || !applicant) return <><PageHeader eyebrow="HR" title="Onboarding" /><div className="p-8 text-sm text-muted-foreground">Loading…</div></>;

  const completed = progress?.completed_steps ?? [];
  const pct = Math.round((completed.length / 11) * 100);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        eyebrow="HR · Contractor Onboarding"
        title={`${applicant.first_name} ${applicant.last_name}`}
        description="Multi-step onboarding wizard. Progress is auto-saved — you can resume anytime."
        actions={
          <Link to="/applicants/$applicantId" params={{ applicantId }} className="inline-flex items-center gap-2 text-xs font-mono uppercase border border-border px-3 py-2 hover:border-primary">
            <ArrowLeft className="size-3" /> Back to applicant
          </Link>
        }
      />

      {/* Sticky stepper */}
      <div className="sticky top-0 z-10 -mx-6 px-6 py-4 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase text-muted-foreground">Step {step} of 11 · {STEPS[step - 1].title}</span>
          <span className="text-xs font-mono text-muted-foreground flex items-center gap-2">
            {saving ? <><Save className="size-3 animate-pulse" /> Saving…</> : <>Saved {progress?.last_saved_at ? new Date(progress.last_saved_at).toLocaleTimeString() : ""}</>}
          </span>
        </div>
        <Progress value={pct} />
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {STEPS.map((s) => {
            const isCompleted = completed.includes(s.n);
            const isCurrent = step === s.n;
            return (
              <button
                key={s.n}
                onClick={() => setStep(s.n)}
                className={"flex-shrink-0 text-[10px] font-mono uppercase px-2 py-1 border " +
                  (isCurrent ? "bg-primary text-primary-foreground border-primary" :
                   isCompleted ? "bg-primary/10 border-primary/40 text-primary" :
                   "border-border text-muted-foreground hover:border-primary/50")}
              >
                {isCompleted ? <Check className="inline size-3 mr-1" /> : `${s.n}.`} {s.title}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-card border border-border p-6 space-y-6">
        {step === 1 && <Step1Welcome applicantId={applicantId} draft={draft} setField={setField} />}
        {step === 2 && <Step2Personal draft={draft} setField={setField} />}
        {step === 3 && <Step3Licenses draft={draft} setField={setField} />}
        {step === 4 && <Step4Education draft={draft} setField={setField} />}
        {step === 5 && <Step5WorkHistory draft={draft} setField={setField} />}
        {step === 6 && <Step6References draft={draft} setField={setField} />}
        {step === 7 && <Step7Compliance draft={draft} setField={setField} />}
        {step === 8 && <Step8Policies draft={draft} setField={setField} />}
        {step === 9 && <Step9Disclosures draft={draft} setField={setField} />}
        {step === 10 && <Step10Signatures draft={draft} setField={setField} />}
        {step === 11 && <Step11Review draft={draft} applicant={applicant} />}

        <div className="flex items-center justify-between border-t border-border pt-6">
          <button
            disabled={step === 1}
            onClick={() => setStep(Math.max(1, step - 1))}
            className="inline-flex items-center gap-2 text-xs font-mono uppercase border border-border px-4 py-2 hover:border-primary disabled:opacity-40"
          >
            <ArrowLeft className="size-3" /> Back
          </button>
          <button
            onClick={commitAndAdvance}
            className="inline-flex items-center gap-2 text-xs font-mono uppercase bg-primary text-primary-foreground px-4 py-2 hover:opacity-90"
          >
            {step === 11 ? "Submit Application" : "Save & Continue"} <ArrowRight className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ====================== STEPS ======================

function Step1Welcome({ applicantId, draft, setField }: any) {
  const [docs, setDocs] = useState<any[]>([]);
  const reload = useCallback(async () => {
    const { data } = await (supabase.from("applicant_documents" as any) as any)
      .select("*").eq("applicant_id", applicantId);
    setDocs(data ?? []);
  }, [applicantId]);
  useEffect(() => { reload(); }, [reload]);

  const upload = async (kind: string, file: File) => {
    const err = validateUpload(file);
    if (err) return toast.error(err);
    const path = `applicants/${applicantId}/${kind}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("hr-documents").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const existing = docs.find((d) => d.kind === kind);
    if (existing) {
      await (supabase.from("applicant_documents" as any) as any).update({ file_path: path, status: "uploaded" }).eq("id", existing.id);
    } else {
      await (supabase.from("applicant_documents" as any) as any).insert({ applicant_id: applicantId, kind, file_path: path, status: "uploaded" });
    }
    toast.success(`${kind} uploaded`);
    reload();
  };

  return (
    <>
      <FormSection title="Welcome" description="Estimated completion time: 30–45 minutes. Progress auto-saves so you can resume later.">
        <div className="bg-muted/40 border border-border p-4 text-sm space-y-2">
          <p className="font-bold">Privacy Notice</p>
          <p className="text-muted-foreground text-xs">The information you provide will be used solely for employment verification and onboarding. Sensitive data (SSN, license numbers, vaccination records) is encrypted at rest, restricted to HR & nursing staff, and never disclosed to third parties without your written consent.</p>
        </div>
        <CheckboxRow label="I have read and acknowledge the Privacy Notice." checked={!!draft.privacy_ack} onChange={(v) => setField("privacy_ack", v)} />
      </FormSection>

      <FormSection title="Required Documents" description="Upload clear photos or PDFs (max 10 MB each).">
        <div className="space-y-2">
          {REQUIRED_UPLOADS.map((u) => {
            const d = docs.find((x) => x.kind === u.kind);
            return (
              <div key={u.kind} className="flex items-center justify-between gap-3 p-3 border border-border">
                <div className="flex items-center gap-3">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="text-sm">{u.label}</span>
                  {d?.file_path && <span className="text-[10px] font-mono uppercase text-primary">Uploaded</span>}
                </div>
                <label className="inline-flex items-center gap-2 text-[10px] font-mono uppercase border border-border px-3 py-1 cursor-pointer hover:border-primary">
                  <Upload className="size-3" /> {d?.file_path ? "Replace" : "Upload"}
                  <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(u.kind, e.target.files[0])} />
                </label>
              </div>
            );
          })}
        </div>
      </FormSection>
    </>
  );
}

function Step2Personal({ draft, setField }: any) {
  const p = draft.personal ?? {};
  const set = (k: string, v: any) => setField("personal", { ...p, [k]: v });
  return (
    <FormSection title="Personal Information">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><FieldLabel>First Name *</FieldLabel><TextInput value={p.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} /></div>
        <div><FieldLabel>Middle Name</FieldLabel><TextInput value={p.middle_name ?? ""} onChange={(e) => set("middle_name", e.target.value)} /></div>
        <div><FieldLabel>Last Name *</FieldLabel><TextInput value={p.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} /></div>
        <div><FieldLabel>Date of Birth</FieldLabel><TextInput type="date" value={p.dob ?? ""} onChange={(e) => set("dob", e.target.value)} /></div>
        <div><FieldLabel>SSN (last 4)</FieldLabel><TextInput maxLength={4} value={p.ssn_last4 ?? ""} onChange={(e) => set("ssn_last4", e.target.value)} /></div>
        <div><FieldLabel>Gender at Birth</FieldLabel><TextInput value={p.gender_at_birth ?? ""} onChange={(e) => set("gender_at_birth", e.target.value)} /></div>
        <div className="md:col-span-2"><FieldLabel>Email *</FieldLabel><TextInput type="email" value={p.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
        <div><FieldLabel>Phone</FieldLabel><TextInput value={p.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
        <div className="md:col-span-3"><FieldLabel>Address</FieldLabel><TextInput value={p.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
        <div><FieldLabel>City</FieldLabel><TextInput value={p.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
        <div><FieldLabel>State</FieldLabel><TextInput value={p.state ?? ""} onChange={(e) => set("state", e.target.value)} /></div>
        <div><FieldLabel>ZIP</FieldLabel><TextInput value={p.zip ?? ""} onChange={(e) => set("zip", e.target.value)} /></div>
      </div>

      <h4 className="text-xs font-bold uppercase tracking-widest mt-6">Demographics (optional, EEO)</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><FieldLabel>Race / Ethnicity</FieldLabel><TextInput value={p.race_ethnicity ?? ""} onChange={(e) => set("race_ethnicity", e.target.value)} /></div>
        <div><FieldLabel>Veteran Status</FieldLabel><TextInput value={p.veteran_status ?? ""} onChange={(e) => set("veteran_status", e.target.value)} /></div>
        <div><FieldLabel>Disability Status</FieldLabel><TextInput value={p.disability_status ?? ""} onChange={(e) => set("disability_status", e.target.value)} /></div>
      </div>

      <h4 className="text-xs font-bold uppercase tracking-widest mt-6">Emergency Contact</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><FieldLabel>Name</FieldLabel><TextInput value={p.emergency_contact_name ?? ""} onChange={(e) => set("emergency_contact_name", e.target.value)} /></div>
        <div><FieldLabel>Phone</FieldLabel><TextInput value={p.emergency_contact_phone ?? ""} onChange={(e) => set("emergency_contact_phone", e.target.value)} /></div>
        <div><FieldLabel>Relationship</FieldLabel><TextInput value={p.emergency_contact_relation ?? ""} onChange={(e) => set("emergency_contact_relation", e.target.value)} /></div>
      </div>

      <h4 className="text-xs font-bold uppercase tracking-widest mt-6">Eligibility & Transportation</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CheckboxRow label="Authorized to work in the U.S." checked={!!p.authorized_us} onChange={(v) => set("authorized_us", v)} />
        <CheckboxRow label="Over 18 years of age" checked={!!p.over_18} onChange={(v) => set("over_18", v)} />
        <CheckboxRow label="Has valid driver's license" checked={!!p.has_drivers_license} onChange={(v) => set("has_drivers_license", v)} />
        <CheckboxRow label="Owns a vehicle" checked={!!p.has_vehicle} onChange={(v) => set("has_vehicle", v)} />
        <div className="md:col-span-2"><FieldLabel>Transportation Method</FieldLabel><TextInput value={p.transportation_method ?? ""} onChange={(e) => set("transportation_method", e.target.value)} /></div>
      </div>
    </FormSection>
  );
}

function RepeaterCard({ children, onRemove, title }: any) {
  return (
    <div className="border border-border p-4 space-y-3 relative">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest">{title}</span>
        {onRemove && <button onClick={onRemove} className="text-destructive hover:opacity-70"><Trash2 className="size-3" /></button>}
      </div>
      {children}
    </div>
  );
}

function Step3Licenses({ draft, setField }: any) {
  const rows = (draft.licenses ?? []) as any[];
  const update = (i: number, k: string, v: any) => setField("licenses", rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const add = () => setField("licenses", [...rows, { kind: "professional_license" }]);
  const remove = (i: number) => setField("licenses", rows.filter((_, idx) => idx !== i));

  return (
    <FormSection title="Professional & Driver's Licenses" description="Add each license you hold.">
      <div className="space-y-3">
        {rows.map((r, i) => (
          <RepeaterCard key={i} title={`License #${i + 1}`} onRemove={() => remove(i)}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><FieldLabel>Type</FieldLabel><TextInput placeholder="RN / LPN / CNA / Driver's" value={r.license_type ?? ""} onChange={(e) => update(i, "license_type", e.target.value)} /></div>
              <div><FieldLabel>State</FieldLabel><TextInput value={r.state ?? ""} onChange={(e) => update(i, "state", e.target.value)} /></div>
              <div><FieldLabel>License Number</FieldLabel><TextInput value={r.number ?? ""} onChange={(e) => update(i, "number", e.target.value)} /></div>
              <div><FieldLabel>Class / Specialty</FieldLabel><TextInput value={r.license_class ?? ""} onChange={(e) => update(i, "license_class", e.target.value)} /></div>
              <div><FieldLabel>Issued On</FieldLabel><TextInput type="date" value={r.issued_on ?? ""} onChange={(e) => update(i, "issued_on", e.target.value)} /></div>
              <div><FieldLabel>Expires</FieldLabel><TextInput type="date" value={r.expires_on ?? ""} onChange={(e) => update(i, "expires_on", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <CheckboxRow label="Active" checked={r.active !== false} onChange={(v) => update(i, "active", v)} />
              <CheckboxRow label="Suspended" checked={!!r.suspended} onChange={(v) => update(i, "suspended", v)} />
              <CheckboxRow label="Revoked" checked={!!r.revoked} onChange={(v) => update(i, "revoked", v)} />
            </div>
          </RepeaterCard>
        ))}
        <button onClick={add} className="inline-flex items-center gap-2 text-xs font-mono uppercase border border-dashed border-border px-3 py-2 hover:border-primary"><Plus className="size-3" /> Add license</button>
      </div>
    </FormSection>
  );
}

function Step4Education({ draft, setField }: any) {
  const rows = (draft.education ?? []) as any[];
  const update = (i: number, k: string, v: any) => setField("education", rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const add = () => setField("education", [...rows, { school_type: "high_school" }]);
  const remove = (i: number) => setField("education", rows.filter((_, idx) => idx !== i));

  return (
    <FormSection title="Education History">
      <div className="space-y-3">
        {rows.map((r, i) => (
          <RepeaterCard key={i} title={`Education #${i + 1}`} onRemove={() => remove(i)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><FieldLabel>School Type</FieldLabel>
                <RadioGroup name={`stype-${i}`} value={r.school_type} onChange={(v) => update(i, "school_type", v)} options={[
                  { value: "high_school", label: "High School" },
                  { value: "college", label: "College" },
                  { value: "vocational", label: "Vocational" },
                  { value: "nursing", label: "Nursing" },
                ]} />
              </div>
              <div><FieldLabel>School Name</FieldLabel><TextInput value={r.school_name ?? ""} onChange={(e) => update(i, "school_name", e.target.value)} /></div>
              <div><FieldLabel>Degree / Certificate</FieldLabel><TextInput value={r.degree ?? ""} onChange={(e) => update(i, "degree", e.target.value)} /></div>
              <div><FieldLabel>Graduation Year</FieldLabel><TextInput type="number" value={r.graduation_year ?? ""} onChange={(e) => update(i, "graduation_year", parseInt(e.target.value) || null)} /></div>
              <div><FieldLabel>Status</FieldLabel>
                <RadioGroup name={`gs-${i}`} value={r.graduation_status} onChange={(v) => update(i, "graduation_status", v)} options={[
                  { value: "graduated", label: "Graduated" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "did_not_finish", label: "Did Not Finish" },
                ]} />
              </div>
            </div>
          </RepeaterCard>
        ))}
        <button onClick={add} className="inline-flex items-center gap-2 text-xs font-mono uppercase border border-dashed border-border px-3 py-2 hover:border-primary"><Plus className="size-3" /> Add education</button>
      </div>
    </FormSection>
  );
}

function Step5WorkHistory({ draft, setField }: any) {
  const rows = (draft.work_history ?? []) as any[];
  const update = (i: number, k: string, v: any) => setField("work_history", rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const add = () => setField("work_history", [...rows, {}]);
  const remove = (i: number) => setField("work_history", rows.filter((_, idx) => idx !== i));

  return (
    <FormSection title="Work History" description="List employment for the past 7 years.">
      <div className="space-y-3">
        {rows.map((r, i) => (
          <RepeaterCard key={i} title={`Employer #${i + 1}`} onRemove={() => remove(i)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><FieldLabel>Employer</FieldLabel><TextInput value={r.employer ?? ""} onChange={(e) => update(i, "employer", e.target.value)} /></div>
              <div><FieldLabel>Position</FieldLabel><TextInput value={r.position ?? ""} onChange={(e) => update(i, "position", e.target.value)} /></div>
              <div><FieldLabel>Supervisor</FieldLabel><TextInput value={r.supervisor ?? ""} onChange={(e) => update(i, "supervisor", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>Start</FieldLabel><TextInput type="date" value={r.start_date ?? ""} onChange={(e) => update(i, "start_date", e.target.value)} /></div>
                <div><FieldLabel>End</FieldLabel><TextInput type="date" value={r.end_date ?? ""} onChange={(e) => update(i, "end_date", e.target.value)} /></div>
              </div>
              <div className="md:col-span-2"><FieldLabel>Reason for Leaving</FieldLabel><TextArea rows={2} value={r.reason_for_leaving ?? ""} onChange={(e) => update(i, "reason_for_leaving", e.target.value)} /></div>
              <CheckboxRow label="Eligible for rehire" checked={!!r.rehire_eligible} onChange={(v) => update(i, "rehire_eligible", v)} />
            </div>
          </RepeaterCard>
        ))}
        <button onClick={add} className="inline-flex items-center gap-2 text-xs font-mono uppercase border border-dashed border-border px-3 py-2 hover:border-primary"><Plus className="size-3" /> Add employer</button>
      </div>
    </FormSection>
  );
}

function Step6References({ draft, setField }: any) {
  const rows = (draft.references ?? []) as any[];
  const update = (i: number, k: string, v: any) => setField("references", rows.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const add = () => setField("references", [...rows, {}]);
  const remove = (i: number) => setField("references", rows.filter((_, idx) => idx !== i));

  return (
    <FormSection title="Professional References" description="Provide at least three references — supervisors preferred.">
      <div className="space-y-3">
        {rows.map((r, i) => (
          <RepeaterCard key={i} title={`Reference #${i + 1}`} onRemove={() => remove(i)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><FieldLabel>Name *</FieldLabel><TextInput value={r.name ?? ""} onChange={(e) => update(i, "name", e.target.value)} /></div>
              <div><FieldLabel>Position</FieldLabel><TextInput value={r.position ?? ""} onChange={(e) => update(i, "position", e.target.value)} /></div>
              <div><FieldLabel>Email</FieldLabel><TextInput type="email" value={r.email ?? ""} onChange={(e) => update(i, "email", e.target.value)} /></div>
              <div><FieldLabel>Phone</FieldLabel><TextInput value={r.phone ?? ""} onChange={(e) => update(i, "phone", e.target.value)} /></div>
              <div><FieldLabel>Relationship</FieldLabel><TextInput value={r.relationship ?? ""} onChange={(e) => update(i, "relationship", e.target.value)} /></div>
              <div className="md:col-span-2"><FieldLabel>Notes</FieldLabel><TextArea rows={2} value={r.notes ?? ""} onChange={(e) => update(i, "notes", e.target.value)} /></div>
            </div>
          </RepeaterCard>
        ))}
        <button onClick={add} className="inline-flex items-center gap-2 text-xs font-mono uppercase border border-dashed border-border px-3 py-2 hover:border-primary"><Plus className="size-3" /> Add reference</button>
      </div>
    </FormSection>
  );
}

function Step7Compliance({ draft, setField }: any) {
  const items = draft.compliance ?? {};
  const set = (kind: string, k: string, v: any) => setField("compliance", { ...items, [kind]: { ...(items[kind] ?? {}), [k]: v } });
  return (
    <FormSection title="Health & Compliance" description="Record dates for each requirement.">
      <div className="space-y-3">
        {COMPLIANCE_ITEMS.map((it) => {
          const v = items[it.kind] ?? {};
          return (
            <div key={it.kind} className="border border-border p-4 space-y-3">
              <div className="font-bold text-sm">{it.label}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><FieldLabel>Status</FieldLabel>
                  <RadioGroup name={`s-${it.kind}`} value={v.status} onChange={(x) => set(it.kind, "status", x)} options={[
                    { value: "complete", label: "Completed" },
                    { value: "pending", label: "Pending" },
                    { value: "declined", label: "Declined" },
                  ]} />
                </div>
                <div><FieldLabel>Completed On</FieldLabel><TextInput type="date" value={v.completed_on ?? ""} onChange={(e) => set(it.kind, "completed_on", e.target.value)} /></div>
                <div><FieldLabel>Expires On</FieldLabel><TextInput type="date" value={v.expires_on ?? ""} onChange={(e) => set(it.kind, "expires_on", e.target.value)} /></div>
              </div>
              <div><FieldLabel>Notes</FieldLabel><TextArea rows={2} value={v.notes ?? ""} onChange={(e) => set(it.kind, "notes", e.target.value)} /></div>
            </div>
          );
        })}
      </div>
    </FormSection>
  );
}

function Step8Policies({ draft, setField }: any) {
  const acks = draft.policies ?? {};
  const set = (k: string, patch: any) => setField("policies", { ...acks, [k]: { ...(acks[k] ?? {}), ...patch } });
  return (
    <FormSection title="Policy Acknowledgements" description="Review and acknowledge each policy. A typed name serves as your electronic signature.">
      <div className="space-y-3">
        {POLICY_LIST.map((p) => {
          const v = acks[p.key] ?? {};
          return (
            <div key={p.key} className="border border-border p-4 space-y-2">
              <div className="font-bold text-sm">{p.label}</div>
              <p className="text-xs text-muted-foreground">I have received, read, and agree to comply with the agency's {p.label} policy. I understand that failure to comply may result in disciplinary action up to and including termination.</p>
              <CheckboxRow label="I acknowledge this policy" checked={!!v.acknowledged} onChange={(x) => set(p.key, { acknowledged: x })} />
              <div><FieldLabel>Typed Signature</FieldLabel><TextInput placeholder="Full legal name" value={v.signature_typed ?? ""} onChange={(e) => set(p.key, { signature_typed: e.target.value })} className="font-serif italic" /></div>
            </div>
          );
        })}
      </div>
    </FormSection>
  );
}

function Step9Disclosures({ draft, setField }: any) {
  const d = draft.disclosures ?? {};
  const set = (k: string, v: any) => setField("disclosures", { ...d, [k]: v });
  const traffic = (d.traffic ?? []) as any[];
  const accidents = (d.accidents ?? []) as any[];
  const criminal = (d.criminal ?? []) as any[];
  const upd = (key: string, arr: any[]) => set(key, arr);

  return (
    <>
      <FormSection title="Driving History">
        <CheckboxRow label="I have had a traffic violation in the past 5 years" checked={!!d.had_violation} onChange={(v) => set("had_violation", v)} />
        {d.had_violation && (
          <div className="space-y-2">
            {traffic.map((t, i) => (
              <RepeaterCard key={i} title={`Violation #${i + 1}`} onRemove={() => upd("traffic", traffic.filter((_, idx) => idx !== i))}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><FieldLabel>Date</FieldLabel><TextInput type="date" value={t.occurred_on ?? ""} onChange={(e) => upd("traffic", traffic.map((x, idx) => idx === i ? { ...x, occurred_on: e.target.value } : x))} /></div>
                  <div><FieldLabel>Location</FieldLabel><TextInput value={t.location ?? ""} onChange={(e) => upd("traffic", traffic.map((x, idx) => idx === i ? { ...x, location: e.target.value } : x))} /></div>
                  <div><FieldLabel>Charges</FieldLabel><TextInput value={t.charges ?? ""} onChange={(e) => upd("traffic", traffic.map((x, idx) => idx === i ? { ...x, charges: e.target.value } : x))} /></div>
                </div>
              </RepeaterCard>
            ))}
            <button onClick={() => upd("traffic", [...traffic, {}])} className="text-xs font-mono uppercase border border-dashed border-border px-3 py-2"><Plus className="inline size-3" /> Add violation</button>
          </div>
        )}
      </FormSection>

      <FormSection title="Accidents">
        <CheckboxRow label="I have been in a motor vehicle accident in the past 5 years" checked={!!d.had_accident} onChange={(v) => set("had_accident", v)} />
        {d.had_accident && (
          <div className="space-y-2">
            {accidents.map((t, i) => (
              <RepeaterCard key={i} title={`Accident #${i + 1}`} onRemove={() => upd("accidents", accidents.filter((_, idx) => idx !== i))}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div><FieldLabel>Date</FieldLabel><TextInput type="date" value={t.occurred_on ?? ""} onChange={(e) => upd("accidents", accidents.map((x, idx) => idx === i ? { ...x, occurred_on: e.target.value } : x))} /></div>
                  <div><FieldLabel>Injuries</FieldLabel><TextInput type="number" value={t.injuries ?? 0} onChange={(e) => upd("accidents", accidents.map((x, idx) => idx === i ? { ...x, injuries: parseInt(e.target.value) || 0 } : x))} /></div>
                  <div><FieldLabel>Fatalities</FieldLabel><TextInput type="number" value={t.fatalities ?? 0} onChange={(e) => upd("accidents", accidents.map((x, idx) => idx === i ? { ...x, fatalities: parseInt(e.target.value) || 0 } : x))} /></div>
                  <div className="md:col-span-4"><FieldLabel>Description</FieldLabel><TextArea rows={2} value={t.description ?? ""} onChange={(e) => upd("accidents", accidents.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} /></div>
                </div>
              </RepeaterCard>
            ))}
            <button onClick={() => upd("accidents", [...accidents, {}])} className="text-xs font-mono uppercase border border-dashed border-border px-3 py-2"><Plus className="inline size-3" /> Add accident</button>
          </div>
        )}
      </FormSection>

      <FormSection title="Criminal History">
        <CheckboxRow label="Have you ever been arrested?" checked={!!d.ever_arrested} onChange={(v) => set("ever_arrested", v)} />
        <CheckboxRow label="Have you ever been convicted of a crime?" checked={!!d.ever_convicted} onChange={(v) => set("ever_convicted", v)} />
        {(d.ever_arrested || d.ever_convicted) && (
          <div className="space-y-2">
            {criminal.map((t, i) => (
              <RepeaterCard key={i} title={`Incident #${i + 1}`} onRemove={() => upd("criminal", criminal.filter((_, idx) => idx !== i))}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div><FieldLabel>Date</FieldLabel><TextInput type="date" value={t.date ?? ""} onChange={(e) => upd("criminal", criminal.map((x, idx) => idx === i ? { ...x, date: e.target.value } : x))} /></div>
                  <div className="md:col-span-2"><FieldLabel>Charge</FieldLabel><TextInput value={t.charge ?? ""} onChange={(e) => upd("criminal", criminal.map((x, idx) => idx === i ? { ...x, charge: e.target.value } : x))} /></div>
                  <div className="md:col-span-3"><FieldLabel>Disposition</FieldLabel><TextArea rows={2} value={t.disposition ?? ""} onChange={(e) => upd("criminal", criminal.map((x, idx) => idx === i ? { ...x, disposition: e.target.value } : x))} /></div>
                </div>
              </RepeaterCard>
            ))}
            <button onClick={() => upd("criminal", [...criminal, {}])} className="text-xs font-mono uppercase border border-dashed border-border px-3 py-2"><Plus className="inline size-3" /> Add incident</button>
          </div>
        )}
      </FormSection>

      <FormSection title="Medical / Compliance">
        <CheckboxRow label="Excluded from Medicare/Medicaid programs" checked={!!d.medicare_exclusion} onChange={(v) => set("medicare_exclusion", v)} />
        <CheckboxRow label="Subject to board discipline" checked={!!d.board_discipline} onChange={(v) => set("board_discipline", v)} />
        <CheckboxRow label="Subject to medical disciplinary action" checked={!!d.medical_disciplinary} onChange={(v) => set("medical_disciplinary", v)} />
        <div><FieldLabel>Details (if any)</FieldLabel><TextArea rows={3} value={d.details ?? ""} onChange={(e) => set("details", e.target.value)} /></div>
      </FormSection>
    </>
  );
}

function Step10Signatures({ draft, setField }: any) {
  const sigs = draft.signatures ?? {};
  const set = (k: string, v: any) => setField("signatures", { ...sigs, [k]: v });
  const contexts = [
    { key: "application_certification", label: "Application Certification", text: "I certify that all information provided in this application is true, complete, and accurate to the best of my knowledge. I understand that any misrepresentation may result in rejection or termination." },
    { key: "background_consent", label: "Background Check Consent", text: "I authorize the agency and its third-party providers to conduct a complete background investigation, including criminal records, driving history, employment verification, and references." },
    { key: "drug_screen_consent", label: "Drug Screen Consent", text: "I consent to pre-employment and ongoing drug screening as a condition of employment." },
    { key: "final_attestation", label: "Final Attestation", text: "I have read all preceding sections of this onboarding application and affirm that my responses are truthful and complete." },
  ];

  return (
    <FormSection title="Signatures" description="Provide a typed or drawn signature for each statement.">
      <div className="space-y-4">
        {contexts.map((c) => (
          <div key={c.key} className="border border-border p-4 space-y-3">
            <div className="font-bold text-sm">{c.label}</div>
            <p className="text-xs text-muted-foreground">{c.text}</p>
            <SignaturePad label={c.label} value={sigs[c.key]} onChange={(v) => set(c.key, v)} />
          </div>
        ))}
      </div>
    </FormSection>
  );
}

function Step11Review({ draft, applicant }: any) {
  const sections: { label: string; data: any }[] = [
    { label: "Personal", data: draft.personal },
    { label: "Licenses", data: draft.licenses },
    { label: "Education", data: draft.education },
    { label: "Work History", data: draft.work_history },
    { label: "References", data: draft.references },
    { label: "Compliance", data: draft.compliance },
    { label: "Policies", data: Object.keys(draft.policies ?? {}) },
    { label: "Disclosures", data: draft.disclosures },
    { label: "Signatures", data: Object.keys(draft.signatures ?? {}) },
  ];
  return (
    <FormSection title="Review & Submit" description="Verify each section before submitting. Once submitted, HR will review.">
      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.label} className="border border-border p-3 flex items-start justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-widest">{s.label}</span>
            <span className="text-xs text-muted-foreground font-mono">{summarize(s.data)}</span>
          </div>
        ))}
      </div>
      <div className="bg-primary/5 border border-primary/30 p-4 text-sm">
        Submitting will lock the wizard and notify HR. You can still update individual items afterwards through the applicant detail page.
      </div>
    </FormSection>
  );
}

function summarize(data: any): string {
  if (!data) return "Not started";
  if (Array.isArray(data)) return `${data.length} item${data.length === 1 ? "" : "s"}`;
  if (typeof data === "object") return `${Object.keys(data).length} field${Object.keys(data).length === 1 ? "" : "s"}`;
  return String(data);
}

// ====================== PERSIST HELPERS ======================
async function persistPersonal(applicantId: string, draft: Draft) {
  const p = draft.personal;
  if (!p) return;
  const { error } = await (supabase.from("applicants" as any) as any).update(p).eq("id", applicantId);
  if (error) throw error;
}

async function replaceChildren(table: string, applicantId: string, rows: any[]) {
  await (supabase.from(table as any) as any).delete().eq("applicant_id", applicantId);
  if (rows.length === 0) return;
  const { error } = await (supabase.from(table as any) as any).insert(rows.map((r) => ({ ...r, applicant_id: applicantId })));
  if (error) throw error;
}

async function persistLicenses(applicantId: string, draft: Draft) {
  const rows = (draft.licenses ?? []).map((r: any) => ({
    kind: r.kind ?? "professional_license",
    license_type: r.license_type ?? null,
    state: r.state ?? null,
    number: r.number ?? null,
    license_class: r.license_class ?? null,
    issued_on: r.issued_on || null,
    expires_on: r.expires_on || null,
    active: r.active !== false,
    suspended: !!r.suspended,
    revoked: !!r.revoked,
  }));
  await replaceChildren("applicant_licenses", applicantId, rows);
}

async function persistEducation(applicantId: string, draft: Draft) {
  const rows = (draft.education ?? []).map((r: any) => ({
    school_type: r.school_type ?? null,
    school_name: r.school_name ?? null,
    degree: r.degree ?? null,
    graduation_year: r.graduation_year ?? null,
    graduation_status: r.graduation_status ?? null,
  }));
  await replaceChildren("applicant_education", applicantId, rows);
}

async function persistWorkHistory(applicantId: string, draft: Draft) {
  const rows = (draft.work_history ?? []).map((r: any) => ({
    employer: r.employer ?? null,
    position: r.position ?? null,
    supervisor: r.supervisor ?? null,
    start_date: r.start_date || null,
    end_date: r.end_date || null,
    reason_for_leaving: r.reason_for_leaving ?? null,
    rehire_eligible: !!r.rehire_eligible,
  }));
  await replaceChildren("applicant_work_history", applicantId, rows);
}

async function persistReferences(applicantId: string, draft: Draft) {
  const rows = (draft.references ?? []).filter((r: any) => r.name).map((r: any) => ({
    name: r.name, position: r.position ?? null, email: r.email ?? null, phone: r.phone ?? null,
    relationship: r.relationship ?? null, notes: r.notes ?? null,
  }));
  await replaceChildren("applicant_references", applicantId, rows);
}

async function persistCompliance(applicantId: string, draft: Draft) {
  const items = draft.compliance ?? {};
  const rows = Object.entries(items).map(([kind, v]: any) => ({
    kind, status: v.status ?? "pending",
    completed_on: v.completed_on || null,
    expires_on: v.expires_on || null,
    details: { notes: v.notes ?? null },
  }));
  await replaceChildren("applicant_compliance", applicantId, rows);
}

async function persistPolicies(applicantId: string, draft: Draft) {
  const acks = draft.policies ?? {};
  await (supabase.from("applicant_policy_acks" as any) as any).delete().eq("applicant_id", applicantId);
  const rows = Object.entries(acks).map(([policy_key, v]: any) => ({
    applicant_id: applicantId,
    policy_key,
    acknowledged: !!v.acknowledged,
    signature_typed: v.signature_typed ?? null,
    signed_at: v.acknowledged ? new Date().toISOString() : null,
    responses: {},
  }));
  if (rows.length) {
    const { error } = await (supabase.from("applicant_policy_acks" as any) as any).insert(rows);
    if (error) throw error;
  }
}

async function persistDisclosures(applicantId: string, draft: Draft) {
  const d = draft.disclosures ?? {};
  await replaceChildren("applicant_traffic_violations", applicantId, (d.traffic ?? []).map((t: any) => ({
    occurred_on: t.occurred_on || null, location: t.location ?? null, charges: t.charges ?? null,
  })));
  await replaceChildren("applicant_accidents", applicantId, (d.accidents ?? []).map((t: any) => ({
    occurred_on: t.occurred_on || null, injuries: t.injuries ?? 0, fatalities: t.fatalities ?? 0, description: t.description ?? null,
  })));
  await (supabase.from("applicant_criminal_history" as any) as any).delete().eq("applicant_id", applicantId);
  await (supabase.from("applicant_criminal_history" as any) as any).insert({
    applicant_id: applicantId,
    ever_arrested: !!d.ever_arrested,
    ever_convicted: !!d.ever_convicted,
    incidents: d.criminal ?? [],
  });
  await (supabase.from("applicant_medical_compliance_issues" as any) as any).delete().eq("applicant_id", applicantId);
  await (supabase.from("applicant_medical_compliance_issues" as any) as any).insert({
    applicant_id: applicantId,
    medicare_exclusion: !!d.medicare_exclusion,
    board_discipline: !!d.board_discipline,
    medical_disciplinary: !!d.medical_disciplinary,
    details: d.details ?? null,
  });
}

async function persistSignatures(applicantId: string, draft: Draft) {
  const sigs = draft.signatures ?? {};
  await (supabase.from("applicant_signatures" as any) as any).delete().eq("applicant_id", applicantId);
  const rows = Object.entries(sigs).map(([context, v]: any) => ({
    applicant_id: applicantId,
    context,
    signer_name: v?.typed ?? null,
    signature_typed: v?.typed ?? null,
    signature_url: v?.dataUrl ?? null,
    signed_at: new Date().toISOString(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  }));
  if (rows.length) {
    const { error } = await (supabase.from("applicant_signatures" as any) as any).insert(rows);
    if (error) throw error;
  }
}
