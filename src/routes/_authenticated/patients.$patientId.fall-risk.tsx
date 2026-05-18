import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { FormSection, CheckboxRow, FieldLabel, TextInput } from "@/components/app/FormSection";
import { PrecautionBadge } from "@/components/app/PrecautionBadge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/$patientId/fall-risk")({ component: FallRiskPage });

const ITEMS: Array<{ key: string; label: string }> = [
  { key: "age_65", label: "Age 65 or older" },
  { key: "multiple_diagnoses", label: "Multiple diagnoses (>3 chronic conditions)" },
  { key: "prior_falls", label: "History of falls in the past 12 months" },
  { key: "incontinence", label: "Incontinence (urinary / bowel urgency)" },
  { key: "visual_impairment", label: "Visual impairment" },
  { key: "mobility_impairment", label: "Mobility impairment / uses assistive device" },
  { key: "environmental_hazards", label: "Environmental hazards in home" },
  { key: "polypharmacy", label: "Polypharmacy (4+ medications)" },
  { key: "pain_affecting_function", label: "Pain affecting function" },
  { key: "cognitive_impairment", label: "Cognitive impairment / disorientation" },
];

async function uploadSig(sig: SignatureValue, patientId: string): Promise<string | null> {
  if (!sig.dataUrl) return null;
  const blob = await (await fetch(sig.dataUrl)).blob();
  const path = `${patientId}/fall-risk-${Date.now()}.png`;
  const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
  if (error) { toast.error(error.message); return null; }
  return path;
}

function FallRiskPage() {
  const { patientId } = Route.useParams();
  const [values, setValues] = useState<Record<string, boolean>>(Object.fromEntries(ITEMS.map((i) => [i.key, false])));
  const [type, setType] = useState<"initial" | "reassessment" | "post_fall">("initial");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [sig, setSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [patientSig, setPatientSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = () => {
    supabase.from("fall_risk_assessments").select("*").eq("patient_id", patientId).order("assessment_date", { ascending: false }).then(({ data }) => setHistory(data ?? []));
  };
  useEffect(loadHistory, [patientId]);

  const total = ITEMS.reduce((n, i) => n + (values[i.key] ? 1 : 0), 0);
  const risk = total >= 4 ? "at_risk" : "low";
  const clinicianSigned = !!(sig.dataUrl || sig.typed.trim());
  const patientSigned = !!(patientSig.dataUrl || patientSig.typed.trim());
  const canSubmit = clinicianSigned && patientSigned && !saving;

  const submit = async () => {
    if (!clinicianSigned) { toast.error("Clinician signature required"); return; }
    if (!patientSigned) { toast.error("Participant signature required"); return; }
    setSaving(true);
    const sigUrl = await uploadSig(sig, patientId);
    const patientSigUrl = await uploadSig(patientSig, patientId);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("fall_risk_assessments").insert({
      patient_id: patientId,
      clinician_id: user?.id,
      assessment_type: type,
      assessment_date: date,
      ...values,
      total_score: total,
      risk_level: risk,
      clinician_signature_url: sigUrl,
      clinician_signature_typed: sig.typed || null,
      patient_signature_url: patientSigUrl,
      patient_signature_typed: patientSig.typed || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fall risk assessment recorded");
    setValues(Object.fromEntries(ITEMS.map((i) => [i.key, false])));
    setSig({ dataUrl: null, typed: "" });
    setPatientSig({ dataUrl: null, typed: "" });
    loadHistory();
  };

  return (
    <div className="grid lg:grid-cols-[2fr_1fr] gap-6 items-start">
      <div className="border border-border bg-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold tracking-tight">Fall Risk Assessment</h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Total score</span>
            <span className="text-2xl font-mono font-bold tabular-nums">{total}<span className="text-muted-foreground text-sm">/10</span></span>
            {risk === "at_risk" ? <PrecautionBadge variant="red" label="AT RISK" /> : <PrecautionBadge variant="neutral" label="NOT AT RISK" />}
          </div>
        </div>

        <FormSection title="Assessment Details">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Type</FieldLabel>
              <select value={type} onChange={(e) => setType(e.target.value as any)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                <option value="initial">Initial</option>
                <option value="reassessment">Reassessment</option>
                <option value="post_fall">Post-fall</option>
              </select>
            </div>
            <div>
              <FieldLabel>Assessment date</FieldLabel>
              <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Risk Factors" description="Check each factor that applies. Score ≥ 4 flags the patient as Fall Risk.">
          <div className="grid md:grid-cols-2 gap-2">
            {ITEMS.map((i) => (
              <CheckboxRow key={i.key} label={i.label} checked={!!values[i.key]} onChange={(v) => setValues({ ...values, [i.key]: v })} suffix={<span className="text-[10px] font-mono text-muted-foreground">1 pt</span>} />
            ))}
          </div>
        </FormSection>

        <FormSection title="Signatures" description="Both clinician and participant must sign before submission.">
          <div className="grid md:grid-cols-2 gap-6">
            <SignaturePad value={sig} onChange={setSig} label="RN signature" />
            <SignaturePad value={patientSig} onChange={setPatientSig} label="Participant signature" />
          </div>
        </FormSection>

        <div className="flex items-center gap-4">
          <button onClick={submit} disabled={!canSubmit} className="bg-primary text-primary-foreground px-6 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Submit assessment"}</button>
          {!canSubmit && !saving && (
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              {!clinicianSigned && "Clinician signature required"}
              {clinicianSigned && !patientSigned && "Participant signature required"}
            </span>
          )}
        </div>
      </div>

      <div className="border border-border bg-card lg:sticky lg:top-32">
        <h3 className="text-xs font-bold uppercase tracking-widest p-4 border-b border-border">History</h3>
        {history.length === 0 ? (
          <div className="p-6 text-xs text-muted-foreground text-center">No assessments recorded yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
              <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Score</th><th className="px-4 py-2 text-left">Risk</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-2 font-mono text-xs">{h.assessment_date}</td>
                  <td className="px-4 py-2 capitalize">{h.assessment_type.replace("_", " ")}</td>
                  <td className="px-4 py-2 font-mono">{h.total_score}/10</td>
                  <td className="px-4 py-2">{h.risk_level === "at_risk" ? <span className="text-alert-red font-bold text-xs">AT RISK</span> : <span className="text-muted-foreground text-xs">Not at risk</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}