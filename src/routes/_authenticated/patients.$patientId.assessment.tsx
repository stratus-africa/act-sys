import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { FormSection, FieldLabel, TextInput, TextArea } from "@/components/app/FormSection";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/$patientId/assessment")({ component: AssessmentPage });

type FormState = {
  visit_type: string;
  assessment_date: string;
  general_condition: string;
  vitals: { bp_systolic?: string; bp_diastolic?: string; hr?: string; rr?: string; temp?: string; spo2?: string; pain?: string };
  weight: { value?: string; unit?: string; gain_loss?: string };
  diet: { type?: string; appetite?: string; restrictions?: string };
  respiratory: { notes?: string; abnormal?: boolean };
  cardiovascular: { notes?: string; abnormal?: boolean };
  gastrointestinal: { notes?: string; abnormal?: boolean };
  genitourinary: { notes?: string; abnormal?: boolean };
  neurological: { notes?: string; abnormal?: boolean };
  musculoskeletal: { notes?: string; abnormal?: boolean };
  skin: { notes?: string; abnormal?: boolean };
  sensory: { notes?: string; abnormal?: boolean };
  mental_health: { notes?: string; abnormal?: boolean };
  psychosocial: { notes?: string; abnormal?: boolean };
  pain: { level?: string; location?: string; character?: string };
  medication_management: string;
  caregiver_names: string;
  notes: string;
};

const EMPTY: FormState = {
  visit_type: "SOC",
  assessment_date: new Date().toISOString().slice(0, 10),
  general_condition: "stable",
  vitals: {}, weight: {}, diet: {},
  respiratory: {}, cardiovascular: {}, gastrointestinal: {}, genitourinary: {},
  neurological: {}, musculoskeletal: {}, skin: {}, sensory: {}, mental_health: {}, psychosocial: {},
  pain: {}, medication_management: "", caregiver_names: "", notes: "",
};

const SYSTEMS: Array<{ key: keyof FormState; label: string }> = [
  { key: "respiratory", label: "Respiratory" },
  { key: "cardiovascular", label: "Cardiovascular" },
  { key: "gastrointestinal", label: "Gastrointestinal" },
  { key: "genitourinary", label: "Genitourinary" },
  { key: "neurological", label: "Neurological" },
  { key: "musculoskeletal", label: "Musculoskeletal" },
  { key: "skin", label: "Skin / Integumentary" },
  { key: "sensory", label: "Sensory" },
  { key: "mental_health", label: "Mental Health" },
  { key: "psychosocial", label: "Psychosocial" },
];

async function uploadSig(sig: SignatureValue, patientId: string, kind: string): Promise<string | null> {
  if (!sig.dataUrl) return null;
  const blob = await (await fetch(sig.dataUrl)).blob();
  const path = `${patientId}/assessment-${kind}-${Date.now()}.png`;
  const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
  if (error) { toast.error(error.message); return null; }
  return path;
}

function AssessmentPage() {
  const { patientId } = Route.useParams();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rnSig, setRnSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [ptSig, setPtSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });

  useEffect(() => {
    supabase.from("participant_assessments").select("*").eq("patient_id", patientId).eq("status", "draft").order("updated_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) {
        setDraftId(data.id);
        const d = data as any;
        setForm({
          ...EMPTY,
          visit_type: d.visit_type ?? EMPTY.visit_type,
          assessment_date: d.assessment_date ?? EMPTY.assessment_date,
          general_condition: d.general_condition ?? EMPTY.general_condition,
          vitals: d.vitals ?? {}, weight: d.weight ?? {}, diet: d.diet ?? {},
          respiratory: d.respiratory ?? {}, cardiovascular: d.cardiovascular ?? {},
          gastrointestinal: d.gastrointestinal ?? {}, genitourinary: d.genitourinary ?? {},
          neurological: d.neurological ?? {}, musculoskeletal: d.musculoskeletal ?? {},
          skin: d.skin ?? {}, sensory: d.sensory ?? {}, mental_health: d.mental_health ?? {},
          psychosocial: d.psychosocial ?? {}, pain: d.pain ?? {},
          medication_management: d.medication_management ?? "", caregiver_names: d.caregiver_names ?? "", notes: d.notes ?? "",
        });
      }
    });
  }, [patientId]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const persist = async (status: "draft" | "complete") => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    let rnUrl: string | null = null;
    let ptUrl: string | null = null;
    if (status === "complete") {
      rnUrl = await uploadSig(rnSig, patientId, "rn");
      ptUrl = await uploadSig(ptSig, patientId, "participant");
    }
    const payload: any = {
      patient_id: patientId,
      nurse_id: user?.id,
      ...form,
      status,
    };
    if (status === "complete") {
      payload.signed_at = new Date().toISOString();
      payload.rn_signature_url = rnUrl;
      payload.rn_signature_typed = rnSig.typed || null;
      payload.participant_signature_url = ptUrl;
      payload.participant_signature_typed = ptSig.typed || null;
    }
    const q = draftId
      ? supabase.from("participant_assessments").update(payload).eq("id", draftId).select("id").single()
      : supabase.from("participant_assessments").insert(payload).select("id").single();
    const { data, error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (data && !draftId) setDraftId(data.id);
    toast.success(status === "complete" ? "Assessment submitted" : "Draft saved");
    if (status === "complete") {
      setDraftId(null); setForm(EMPTY); setRnSig({ dataUrl: null, typed: "" }); setPtSig({ dataUrl: null, typed: "" }); setPage(1);
    }
  };

  const submit = async () => {
    if (!rnSig.dataUrl && !rnSig.typed) { toast.error("RN signature required"); return; }
    if (!confirm("Submit and lock this assessment?")) return;
    await persist("complete");
  };

  return (
    <div className="space-y-6">
      <div className="border border-border bg-card p-4 flex items-center justify-between">
        <div className="flex gap-2">
          {[1, 2, 3].map((n) => (
            <button key={n} onClick={() => setPage(n)} className={"px-4 py-2 text-xs font-bold uppercase tracking-wider " + (page === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
              Page {n}
            </button>
          ))}
        </div>
        <button onClick={() => persist("draft")} disabled={saving} className="text-xs font-mono uppercase text-muted-foreground hover:text-foreground">{saving ? "Saving…" : "Save draft"}</button>
      </div>

      {page === 1 && <Page1 form={form} upd={upd} />}
      {page === 2 && <Page2 form={form} upd={upd} />}
      {page === 3 && <Page3 form={form} upd={upd} rnSig={rnSig} setRnSig={setRnSig} ptSig={ptSig} setPtSig={setPtSig} />}

      <div className="flex justify-between">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 text-sm border border-border disabled:opacity-50">&larr; Back</button>
        {page < 3 ? (
          <button onClick={() => setPage((p) => p + 1)} className="px-4 py-2 text-sm bg-primary text-primary-foreground font-bold">Next &rarr;</button>
        ) : (
          <button onClick={submit} disabled={saving} className="px-6 py-2 text-sm bg-primary text-primary-foreground font-bold disabled:opacity-50">{saving ? "Submitting…" : "Submit & Lock"}</button>
        )}
      </div>
    </div>
  );
}

function Page1({ form, upd }: { form: FormState; upd: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="border border-border bg-card p-6 space-y-8">
      <FormSection title="Visit Information">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <FieldLabel>Visit type</FieldLabel>
            <select value={form.visit_type} onChange={(e) => upd("visit_type", e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
              <option>SOC</option><option>Recertification</option><option>Resumption</option><option>Routine</option><option>Discharge</option>
            </select>
          </div>
          <div><FieldLabel>Assessment date</FieldLabel><TextInput type="date" value={form.assessment_date} onChange={(e) => upd("assessment_date", e.target.value)} /></div>
          <div>
            <FieldLabel>General condition</FieldLabel>
            <select value={form.general_condition} onChange={(e) => upd("general_condition", e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
              <option value="improving">Improving</option><option value="stable">Stable</option><option value="deteriorating">Deteriorating</option>
            </select>
          </div>
        </div>
      </FormSection>

      <FormSection title="Vital Signs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><FieldLabel>BP systolic</FieldLabel><TextInput value={form.vitals.bp_systolic ?? ""} onChange={(e) => upd("vitals", { ...form.vitals, bp_systolic: e.target.value })} placeholder="mmHg" /></div>
          <div><FieldLabel>BP diastolic</FieldLabel><TextInput value={form.vitals.bp_diastolic ?? ""} onChange={(e) => upd("vitals", { ...form.vitals, bp_diastolic: e.target.value })} placeholder="mmHg" /></div>
          <div><FieldLabel>Heart rate</FieldLabel><TextInput value={form.vitals.hr ?? ""} onChange={(e) => upd("vitals", { ...form.vitals, hr: e.target.value })} placeholder="bpm" /></div>
          <div><FieldLabel>Resp. rate</FieldLabel><TextInput value={form.vitals.rr ?? ""} onChange={(e) => upd("vitals", { ...form.vitals, rr: e.target.value })} placeholder="/min" /></div>
          <div><FieldLabel>Temperature</FieldLabel><TextInput value={form.vitals.temp ?? ""} onChange={(e) => upd("vitals", { ...form.vitals, temp: e.target.value })} placeholder="°F" /></div>
          <div><FieldLabel>SpO₂</FieldLabel><TextInput value={form.vitals.spo2 ?? ""} onChange={(e) => upd("vitals", { ...form.vitals, spo2: e.target.value })} placeholder="%" /></div>
          <div><FieldLabel>Pain (0-10)</FieldLabel><TextInput value={form.vitals.pain ?? ""} onChange={(e) => upd("vitals", { ...form.vitals, pain: e.target.value })} /></div>
        </div>
      </FormSection>

      <FormSection title="Weight & Diet">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div><FieldLabel>Weight</FieldLabel><TextInput value={form.weight.value ?? ""} onChange={(e) => upd("weight", { ...form.weight, value: e.target.value })} placeholder="lb" /></div>
          <div><FieldLabel>Gain / loss</FieldLabel><TextInput value={form.weight.gain_loss ?? ""} onChange={(e) => upd("weight", { ...form.weight, gain_loss: e.target.value })} placeholder="+/- since last visit" /></div>
          <div><FieldLabel>Diet type</FieldLabel><TextInput value={form.diet.type ?? ""} onChange={(e) => upd("diet", { ...form.diet, type: e.target.value })} placeholder="Regular, diabetic…" /></div>
          <div><FieldLabel>Appetite</FieldLabel>
            <select value={form.diet.appetite ?? ""} onChange={(e) => upd("diet", { ...form.diet, appetite: e.target.value })} className="w-full px-3 py-2 border border-border bg-background text-sm">
              <option value="">—</option><option>Good</option><option>Fair</option><option>Poor</option>
            </select>
          </div>
          <div className="md:col-span-2"><FieldLabel>Restrictions</FieldLabel><TextInput value={form.diet.restrictions ?? ""} onChange={(e) => upd("diet", { ...form.diet, restrictions: e.target.value })} /></div>
        </div>
      </FormSection>
    </div>
  );
}

function Page2({ form, upd }: { form: FormState; upd: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="border border-border bg-card p-6 space-y-8">
      <FormSection title="Body Systems Review" description="Mark abnormal findings and add notes.">
        <div className="space-y-3">
          {SYSTEMS.map((s) => {
            const v = form[s.key] as { notes?: string; abnormal?: boolean };
            return (
              <div key={s.key} className="border border-border p-4 grid md:grid-cols-[200px_1fr_auto] gap-4 items-start">
                <div className="font-bold text-sm">{s.label}</div>
                <TextArea rows={2} value={v.notes ?? ""} onChange={(e) => upd(s.key, { ...v, notes: e.target.value } as any)} placeholder="Findings, notes…" />
                <label className="flex items-center gap-2 text-xs whitespace-nowrap pt-2">
                  <input type="checkbox" checked={!!v.abnormal} onChange={(e) => upd(s.key, { ...v, abnormal: e.target.checked } as any)} className="accent-primary" />
                  Abnormal
                </label>
              </div>
            );
          })}
        </div>
      </FormSection>

      <FormSection title="Pain Assessment">
        <div className="grid grid-cols-3 gap-4">
          <div><FieldLabel>Pain level (0-10)</FieldLabel><TextInput value={form.pain.level ?? ""} onChange={(e) => upd("pain", { ...form.pain, level: e.target.value })} /></div>
          <div><FieldLabel>Location</FieldLabel><TextInput value={form.pain.location ?? ""} onChange={(e) => upd("pain", { ...form.pain, location: e.target.value })} /></div>
          <div><FieldLabel>Character</FieldLabel><TextInput value={form.pain.character ?? ""} onChange={(e) => upd("pain", { ...form.pain, character: e.target.value })} placeholder="Sharp, dull, throbbing…" /></div>
        </div>
      </FormSection>
    </div>
  );
}

function Page3({ form, upd, rnSig, setRnSig, ptSig, setPtSig }: { form: FormState; upd: <K extends keyof FormState>(k: K, v: FormState[K]) => void; rnSig: SignatureValue; setRnSig: (v: SignatureValue) => void; ptSig: SignatureValue; setPtSig: (v: SignatureValue) => void }) {
  return (
    <div className="border border-border bg-card p-6 space-y-8">
      <FormSection title="Medications & Caregivers">
        <div className="grid md:grid-cols-2 gap-4">
          <div><FieldLabel>Medication management</FieldLabel>
            <select value={form.medication_management} onChange={(e) => upd("medication_management", e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
              <option value="">—</option><option value="independent">Independent</option><option value="assistance">Needs assistance</option><option value="dependent">Dependent</option>
            </select>
          </div>
          <div><FieldLabel>Caregiver name(s)</FieldLabel><TextInput value={form.caregiver_names} onChange={(e) => upd("caregiver_names", e.target.value)} /></div>
        </div>
      </FormSection>

      <FormSection title="Additional Notes">
        <TextArea rows={4} value={form.notes} onChange={(e) => upd("notes", e.target.value)} placeholder="Plan of care updates, family communication, follow-up…" />
      </FormSection>

      <FormSection title="Signatures">
        <div className="grid md:grid-cols-2 gap-4">
          <SignaturePad value={rnSig} onChange={setRnSig} label="RN signature (required)" />
          <SignaturePad value={ptSig} onChange={setPtSig} label="Participant signature" />
        </div>
      </FormSection>
    </div>
  );
}