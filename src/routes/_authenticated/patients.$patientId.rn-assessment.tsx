import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { FormSection, FieldLabel, TextInput, TextArea } from "@/components/app/FormSection";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { PrecautionBadge } from "@/components/app/PrecautionBadge";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/rn-assessment")({ component: RnAssessmentPage });

type TaskValue = { observed: "" | "yes" | "no" | "na"; comment: string };
type TaskMap = Record<string, TaskValue>;

const TASK_GROUPS: Array<{ heading: string; items: Array<{ key: string; label: string }> }> = [
  {
    heading: "Vital Signs & Measurements",
    items: [
      { key: "vitals_taken", label: "Vital signs taken (BP, HR, RR, Temp, SpO2)" },
      { key: "weight_checked", label: "Weight checked" },
      { key: "pain_assessed", label: "Pain assessed and documented" },
    ],
  },
  {
    heading: "Systems Review",
    items: [
      { key: "sys_respiratory", label: "Respiratory assessment performed" },
      { key: "sys_cardiovascular", label: "Cardiovascular assessment performed" },
      { key: "sys_neurological", label: "Neurological assessment performed" },
      { key: "sys_gastrointestinal", label: "GI assessment performed" },
      { key: "sys_genitourinary", label: "GU assessment performed" },
      { key: "sys_musculoskeletal", label: "Musculoskeletal assessment performed" },
      { key: "sys_integumentary", label: "Skin / integumentary review" },
      { key: "sys_psychosocial", label: "Mental / psychosocial review" },
    ],
  },
  {
    heading: "Care Plan & Safety",
    items: [
      { key: "med_reconciliation", label: "Medication reconciliation completed" },
      { key: "fall_risk_reviewed", label: "Fall-risk reviewed" },
      { key: "skin_integrity_reviewed", label: "Skin integrity reviewed" },
      { key: "infection_screening", label: "Infection / wound screening" },
      { key: "advance_directive_verified", label: "Advance directive / DNR status verified" },
      { key: "emergency_contacts_verified", label: "Emergency contacts verified" },
    ],
  },
  {
    heading: "Education & Coordination",
    items: [
      { key: "patient_education", label: "Patient / family education provided" },
      { key: "caregiver_review", label: "Caregiver performance reviewed" },
      { key: "physician_communication", label: "Communicated with physician (PRN)" },
      { key: "care_plan_updated", label: "Care plan updated as needed" },
    ],
  },
];

const ALL_KEYS = TASK_GROUPS.flatMap((g) => g.items.map((i) => i.key));
const EMPTY_TASKS: TaskMap = Object.fromEntries(ALL_KEYS.map((k) => [k, { observed: "", comment: "" }]));

async function uploadSig(sig: SignatureValue, patientId: string, kind: string): Promise<string | null> {
  if (!sig.dataUrl) return null;
  const blob = await (await fetch(sig.dataUrl)).blob();
  const path = `${patientId}/rn-assessment-${kind}-${Date.now()}.png`;
  const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
  if (error) { toast.error(error.message); return null; }
  return path;
}

function RnAssessmentPage() {
  const { patientId } = Route.useParams();
  const { hasRole, user } = useCurrentUser();
  const canCreate = hasRole("admin") || hasRole("rn");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [nurseName, setNurseName] = useState("");
  const [patientName, setPatientName] = useState("");
  const [tasks, setTasks] = useState<TaskMap>(EMPTY_TASKS);
  const [generalNotes, setGeneralNotes] = useState("");
  const [nurseSig, setNurseSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [patientSig, setPatientSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [saving, setSaving] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("rn_assessments")
      .select("*")
      .eq("patient_id", patientId)
      .order("assessment_date", { ascending: false })
      .order("created_at", { ascending: false });
    setHistory(data ?? []);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  // Prefill patient & nurse names
  useEffect(() => {
    supabase.from("patients").select("first_name, last_name").eq("id", patientId).maybeSingle().then(({ data }) => {
      if (data) setPatientName(`${data.first_name} ${data.last_name}`);
    });
  }, [patientId]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.full_name) setNurseName(data.full_name);
    });
  }, [user]);

  const setTask = (key: string, patch: Partial<TaskValue>) => {
    setTasks((s) => ({ ...s, [key]: { ...s[key], ...patch } }));
  };

  const concernCount = (t: TaskMap) => Object.values(t).filter((v) => v?.observed === "no").length;
  const completedCount = (t: TaskMap) => Object.values(t).filter((v) => !!v?.observed).length;

  const submit = async () => {
    if (!canCreate) return;
    if (!nurseSig.dataUrl && !nurseSig.typed.trim()) { toast.error("Nurse signature required"); return; }
    setSaving(true);
    const nurseUrl = await uploadSig(nurseSig, patientId, "nurse");
    const patientUrl = await uploadSig(patientSig, patientId, "patient");
    const { error } = await supabase.from("rn_assessments").insert({
      patient_id: patientId,
      nurse_id: user?.id,
      assessment_date: date,
      tasks,
      general_notes: generalNotes || null,
      nurse_name: nurseName || null,
      patient_name: patientName || null,
      nurse_signature_typed: nurseSig.typed || null,
      nurse_signature_url: nurseUrl,
      patient_signature_typed: patientSig.typed || null,
      patient_signature_url: patientUrl,
      signed_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("RN assessment saved");
    setTasks(EMPTY_TASKS);
    setGeneralNotes("");
    setNurseSig({ dataUrl: null, typed: "" });
    setPatientSig({ dataUrl: null, typed: "" });
    load();
  };

  return (
    <div className="space-y-8 animate-entrance">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Clinical</div>
          <h2 className="text-3xl font-extrabold tracking-tight">RN Assessment</h2>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
            {canCreate ? "Clinician view · create & sign" : "Read-only view"}
          </div>
        </div>
        {history[0] && (
          <PrecautionBadge
            variant={concernCount(history[0].tasks ?? {}) > 0 ? "amber" : "neutral"}
            label={`LAST RN VISIT · ${history[0].assessment_date}${concernCount(history[0].tasks ?? {}) > 0 ? ` · ${concernCount(history[0].tasks ?? {})} concerns` : ""}`}
          />
        )}
      </div>

      {canCreate && (
        <>
          <FormSection title="Assessment Header">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <FieldLabel>Assessment Date</FieldLabel>
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Nurse Name</FieldLabel>
                <TextInput value={nurseName} onChange={(e) => setNurseName(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Patient Name</FieldLabel>
                <TextInput value={patientName} onChange={(e) => setPatientName(e.target.value)} />
              </div>
            </div>
          </FormSection>

          {TASK_GROUPS.map((group) => (
            <FormSection key={group.heading} title={group.heading} description="Mark each item as Yes (performed), No (concern), or N/A.">
              <div className="space-y-3">
                {group.items.map((item) => {
                  const v = tasks[item.key] ?? { observed: "", comment: "" };
                  return (
                    <div key={item.key} className={"border p-3 " + (v.observed === "no" ? "border-destructive/60 bg-destructive/5" : "border-border")}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="text-sm font-medium flex-1 min-w-[200px]">{item.label}</div>
                        <div className="flex gap-1">
                          {(["yes", "no", "na"] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setTask(item.key, { observed: opt })}
                              className={
                                "px-3 py-1 text-[11px] font-bold uppercase tracking-wider border-2 " +
                                (v.observed === opt
                                  ? opt === "no"
                                    ? "border-destructive bg-destructive text-destructive-foreground"
                                    : "border-primary bg-primary text-primary-foreground"
                                  : "border-border text-muted-foreground hover:border-foreground")
                              }
                            >
                              {opt === "na" ? "N/A" : opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <TextInput
                        className="mt-2"
                        placeholder={v.observed === "no" ? "Describe concern…" : "Optional comment…"}
                        value={v.comment}
                        onChange={(e) => setTask(item.key, { comment: e.target.value })}
                      />
                    </div>
                  );
                })}
              </div>
            </FormSection>
          ))}

          <FormSection title="General Notes">
            <TextArea rows={4} value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)} placeholder="Plan of care, follow-up, observations…" />
          </FormSection>

          <div className="grid md:grid-cols-2 gap-6">
            <FormSection title="Nurse Signature" description="Required to save assessment.">
              <SignaturePad value={nurseSig} onChange={setNurseSig} />
            </FormSection>
            <FormSection title="Patient / Representative Signature" description="Optional.">
              <SignaturePad value={patientSig} onChange={setPatientSig} />
            </FormSection>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={saving}
              onClick={submit}
              className="px-6 py-3 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90"
            >
              {saving ? "Saving…" : "Save RN Assessment"}
            </button>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {completedCount(tasks)} / {ALL_KEYS.length} tasks completed
              {concernCount(tasks) > 0 && ` · ${concernCount(tasks)} concerns`}
            </div>
          </div>
        </>
      )}

      <FormSection title="Assessment History" description="Past RN assessments for this patient.">
        {history.length === 0 ? (
          <div className="text-xs text-muted-foreground">No RN assessments on file.</div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const taskMap = (h.tasks ?? {}) as TaskMap;
              const cc = concernCount(taskMap);
              const open = !!openIds[h.id];
              return (
                <div key={h.id} className="border border-border">
                  <button
                    type="button"
                    onClick={() => setOpenIds((s) => ({ ...s, [h.id]: !s[h.id] }))}
                    className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30"
                  >
                    {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold">{h.assessment_date}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        Nurse: {h.nurse_name ?? "—"} · {completedCount(taskMap)} / {ALL_KEYS.length} tasks
                      </div>
                    </div>
                    <PrecautionBadge variant={cc > 0 ? "amber" : "neutral"} label={cc > 0 ? `${cc} concerns` : "all clear"} />
                  </button>
                  {open && (
                    <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
                      {TASK_GROUPS.map((group) => {
                        const groupItems = group.items.map((i) => ({ ...i, v: taskMap[i.key] })).filter((x) => x.v && x.v.observed);
                        if (groupItems.length === 0) return null;
                        return (
                          <div key={group.heading}>
                            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{group.heading}</div>
                            <ul className="space-y-1">
                              {groupItems.map(({ key, label, v }) => (
                                <li key={key} className="flex items-start gap-2 text-xs">
                                  <span className={
                                    "inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase " +
                                    (v!.observed === "no" ? "bg-destructive text-destructive-foreground"
                                      : v!.observed === "yes" ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground")
                                  }>
                                    {v!.observed === "na" ? "N/A" : v!.observed}
                                  </span>
                                  <span className="flex-1">
                                    {label}
                                    {v!.comment && <span className="text-muted-foreground"> — {v!.comment}</span>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                      {h.general_notes && (
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">General Notes</div>
                          <div className="text-xs whitespace-pre-wrap">{h.general_notes}</div>
                        </div>
                      )}
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground pt-2">
                        Signed {h.signed_at ? new Date(h.signed_at).toLocaleString() : "—"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </FormSection>
    </div>
  );
}