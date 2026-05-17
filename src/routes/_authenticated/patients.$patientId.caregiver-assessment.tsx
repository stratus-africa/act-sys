import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FormSection, FieldLabel, TextInput } from "@/components/app/FormSection";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { useCurrentUser } from "@/lib/use-current-user";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/$patientId/caregiver-assessment")({ component: CaregiverAssessmentPage });

const ADL_TASKS = [
  { key: "bathing", label: "Bathing" },
  { key: "hygiene", label: "Personal Hygiene (hair, oral, nail, skin)" },
  { key: "toileting", label: "Toileting (bladder, bowel, bed pan)" },
  { key: "dressing", label: "Dressing & Changing Clothes" },
  { key: "mobility", label: "Mobility & Transfers" },
  { key: "eating", label: "Eating & Drinking" },
  { key: "medications", label: "Medications (Review MAR)" },
];
const IADL_TASKS = [
  { key: "meal_prep", label: "Meal Preparation" },
  { key: "housekeeping", label: "Light Housekeeping" },
  { key: "grocery", label: "Grocery Shopping" },
  { key: "transport", label: "Transportation / Community Travel" },
  { key: "laundry", label: "Laundry" },
  { key: "money", label: "Handling Money" },
  { key: "telephone", label: "Using the Telephone" },
  { key: "reading", label: "Reading of Specific Items" },
  { key: "equipment", label: "Wash Equipment" },
  { key: "other", label: "Other" },
];
const ALL_TASKS = [...ADL_TASKS, ...IADL_TASKS];
type TaskValue = { observed: "yes" | "no" | ""; comment: string };

async function uploadSig(sig: SignatureValue, patientId: string, who: string): Promise<string | null> {
  if (!sig.dataUrl) return null;
  const blob = await (await fetch(sig.dataUrl)).blob();
  const path = `${patientId}/caregiver-${who}-${Date.now()}.png`;
  const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
  if (error) { toast.error(error.message); return null; }
  return path;
}

function CaregiverAssessmentPage() {
  const { patientId } = Route.useParams();
  const { hasRole, user } = useCurrentUser();
  const isClinician = hasRole("admin") || hasRole("rn");

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [nurseName, setNurseName] = useState("");
  const [caregiverName, setCaregiverName] = useState("");
  const [caregiverId, setCaregiverId] = useState("");
  const [tasks, setTasks] = useState<Record<string, TaskValue>>(
    Object.fromEntries(ALL_TASKS.map((t) => [t.key, { observed: "", comment: "" }]))
  );
  const [generalNotes, setGeneralNotes] = useState("");
  const [nurseSig, setNurseSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [cgSig, setCgSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [caregivers, setCaregivers] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [patient, setPatient] = useState<any>(null);

  const load = () => {
    supabase.from("caregiver_assessments").select("*").eq("patient_id", patientId).order("service_date", { ascending: false }).then(({ data }) => setHistory(data ?? []));
  };

  useEffect(() => {
    load();
    supabase.from("patients").select("first_name, last_name").eq("id", patientId).maybeSingle().then(({ data }) => setPatient(data));
    if (isClinician) {
      supabase.from("user_roles").select("user_id, profiles!inner(id, full_name)").eq("role", "caregiver").then(async () => {
        const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "caregiver");
        const ids = (roles ?? []).map((r) => r.user_id);
        if (!ids.length) { setCaregivers([]); return; }
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        setCaregivers(profs ?? []);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, isClinician]);

  const setTask = (key: string, patch: Partial<TaskValue>) =>
    setTasks((t) => ({ ...t, [key]: { ...t[key], ...patch } }));

  const submit = async () => {
    if (!nurseSig.dataUrl && !nurseSig.typed.trim()) { toast.error("Nurse signature required"); return; }
    setSaving(true);
    const [nurseUrl, cgUrl] = await Promise.all([
      uploadSig(nurseSig, patientId, "nurse"),
      uploadSig(cgSig, patientId, "caregiver"),
    ]);
    const { error } = await supabase.from("caregiver_assessments").insert({
      patient_id: patientId,
      caregiver_id: caregiverId || null,
      nurse_id: user?.id,
      service_date: date,
      caregiver_name: caregiverName || null,
      nurse_name: nurseName || null,
      tasks,
      general_notes: generalNotes || null,
      nurse_signature_typed: nurseSig.typed || null,
      nurse_signature_url: nurseUrl,
      caregiver_signature_typed: cgSig.typed || null,
      caregiver_signature_url: cgUrl,
      signed_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Caregiver assessment saved");
    setTasks(Object.fromEntries(ALL_TASKS.map((t) => [t.key, { observed: "", comment: "" }])));
    setGeneralNotes(""); setNurseSig({ dataUrl: null, typed: "" }); setCgSig({ dataUrl: null, typed: "" });
    load();
  };

  const renderTaskGroup = (label: string, list: typeof ADL_TASKS) => (
    <FormSection title={label}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-border">
          <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Task</th>
              <th className="px-3 py-2 text-center w-32">Observed</th>
              <th className="px-3 py-2 text-left">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((t) => {
              const v = tasks[t.key];
              return (
                <tr key={t.key}>
                  <td className="px-3 py-2 align-top">{t.label}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="inline-flex gap-1">
                      {(["yes", "no"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={!isClinician}
                          onClick={() => setTask(t.key, { observed: v.observed === opt ? "" : opt })}
                          className={"px-3 py-1 text-[10px] font-bold uppercase border-2 " + (v.observed === opt ? (opt === "yes" ? "border-primary bg-primary text-primary-foreground" : "border-destructive bg-destructive text-destructive-foreground") : "border-border text-muted-foreground hover:border-foreground")}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <TextInput
                      value={v.comment}
                      onChange={(e) => setTask(t.key, { comment: e.target.value })}
                      placeholder="Findings, training, concerns…"
                      disabled={!isClinician}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </FormSection>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">HCBS Waiver · Nurse Monitor</div>
          <h2 className="text-3xl font-extrabold tracking-tight">Caregiver Assessment</h2>
          <div className="text-xs text-muted-foreground mt-1">
            Participant: <strong>{patient ? `${patient.first_name} ${patient.last_name}` : "—"}</strong>
          </div>
        </div>
      </div>

      {!isClinician && (
        <div className="border border-border p-6 bg-muted/30 text-sm">
          Read-only view. Only RNs and admins can create caregiver assessments.
        </div>
      )}

      <FormSection title="Visit Header">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <FieldLabel>Service Date</FieldLabel>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!isClinician} />
          </div>
          <div>
            <FieldLabel>Nurse Name</FieldLabel>
            <TextInput value={nurseName} onChange={(e) => setNurseName(e.target.value)} disabled={!isClinician} />
          </div>
          <div>
            <FieldLabel>Caregiver Name</FieldLabel>
            <TextInput value={caregiverName} onChange={(e) => setCaregiverName(e.target.value)} disabled={!isClinician} />
          </div>
          {isClinician && (
            <div className="sm:col-span-3">
              <FieldLabel>Link to Staff Caregiver (optional)</FieldLabel>
              <select
                value={caregiverId}
                onChange={(e) => {
                  setCaregiverId(e.target.value);
                  const c = caregivers.find((x) => x.id === e.target.value);
                  if (c?.full_name && !caregiverName) setCaregiverName(c.full_name);
                }}
                className="w-full px-3 py-2 bg-background border border-border text-sm"
              >
                <option value="">— not linked —</option>
                {caregivers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name ?? c.id}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </FormSection>

      {renderTaskGroup("Activities of Daily Living (ADL)", ADL_TASKS)}
      {renderTaskGroup("Instrumental Activities of Daily Living (IADL)", IADL_TASKS)}

      <FormSection title="Concerns / Training Notes">
        <textarea
          value={generalNotes}
          onChange={(e) => setGeneralNotes(e.target.value)}
          rows={4}
          disabled={!isClinician}
          className="w-full px-3 py-2 bg-background border border-border text-sm font-mono disabled:opacity-50"
          placeholder="Detailed information on concerns, findings, or training…"
        />
      </FormSection>

      {isClinician && (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <FormSection title="Nurse Signature" description="Required.">
              <SignaturePad value={nurseSig} onChange={setNurseSig} />
            </FormSection>
            <FormSection title="Caregiver Signature" description="Optional but recommended.">
              <SignaturePad value={cgSig} onChange={setCgSig} />
            </FormSection>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-6 py-3 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
          >
            {saving ? "Saving…" : "Save Caregiver Assessment"}
          </button>
        </>
      )}

      <FormSection title="Assessment History">
        {history.length === 0 ? (
          <div className="text-xs text-muted-foreground">No assessments on file.</div>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const taskMap = (h.tasks ?? {}) as Record<string, TaskValue>;
              const noCount = Object.values(taskMap).filter((t) => t?.observed === "no").length;
              const yesCount = Object.values(taskMap).filter((t) => t?.observed === "yes").length;
              return (
                <details key={h.id} className="border border-border p-3">
                  <summary className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-sm font-bold">{h.service_date}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        Caregiver: {h.caregiver_name ?? "—"} · Nurse: {h.nurse_name ?? "—"}
                      </div>
                    </div>
                    <div className="flex gap-2 text-[10px] font-bold uppercase">
                      <span className="text-primary">{yesCount} yes</span>
                      <span className="text-destructive">{noCount} no</span>
                    </div>
                  </summary>
                  <div className="mt-3 grid sm:grid-cols-2 gap-1 text-xs">
                    {ALL_TASKS.map((t) => {
                      const v = taskMap[t.key];
                      if (!v?.observed && !v?.comment) return null;
                      return (
                        <div key={t.key} className="flex gap-2 border-l-2 pl-2 border-border">
                          <span className={"font-mono text-[10px] uppercase " + (v.observed === "yes" ? "text-primary" : v.observed === "no" ? "text-destructive" : "text-muted-foreground")}>{v.observed || "—"}</span>
                          <span className="flex-1"><strong>{t.label}</strong>{v.comment ? ` — ${v.comment}` : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                  {h.general_notes && (
                    <div className="mt-3 text-xs"><span className="font-mono text-[10px] uppercase text-muted-foreground">Notes</span><div>{h.general_notes}</div></div>
                  )}
                </details>
              );
            })}
          </div>
        )}
      </FormSection>
    </div>
  );
}
