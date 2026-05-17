import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { FormSection, CheckboxRow, FieldLabel, TextInput } from "@/components/app/FormSection";
import { PrecautionBadge } from "@/components/app/PrecautionBadge";
import { toast } from "sonner";
import bodyDiagram from "@/assets/skin-body-diagram.jpg";
import { useCurrentUser } from "@/lib/use-current-user";

export const Route = createFileRoute("/_authenticated/patients/$patientId/skin")({ component: SkinPage });

const PRESSURE_AREAS: Array<{ key: string; label: string }> = [
  { key: "rim_of_ear", label: "Rim of Ear" },
  { key: "shoulder_blade", label: "Shoulder Blade" },
  { key: "elbow", label: "Elbow" },
  { key: "sacrum", label: "Sacrum" },
  { key: "hip", label: "Hip" },
  { key: "inner_knee", label: "Inner Knee" },
  { key: "outer_ankle", label: "Outer Ankle" },
  { key: "heel", label: "Heel" },
];

type Marking = { x: number; y: number; note?: string };

async function uploadSig(sig: SignatureValue, patientId: string): Promise<string | null> {
  if (!sig.dataUrl) return null;
  const blob = await (await fetch(sig.dataUrl)).blob();
  const path = `${patientId}/skin-${Date.now()}.png`;
  const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
  if (error) { toast.error(error.message); return null; }
  return path;
}

function SkinPage() {
  const { patientId } = Route.useParams();
  const { hasRole, loading: roleLoading } = useCurrentUser();
  const isClinician = hasRole("admin") || hasRole("rn");
  const isCaregiver = hasRole("caregiver");
  const canCreate = isClinician;
  const canAddNotes = isClinician || isCaregiver;
  const [status, setStatus] = useState<"normal" | "abnormal">("normal");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [areas, setAreas] = useState<Record<string, { affected: boolean; note: string }>>(
    Object.fromEntries(PRESSURE_AREAS.map((a) => [a.key, { affected: false, note: "" }]))
  );
  const [markings, setMarkings] = useState<Marking[]>([]);
  const [generalNotes, setGeneralNotes] = useState("");
  const [sig, setSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newRemark, setNewRemark] = useState("");
  const diagramRef = useRef<HTMLDivElement>(null);

  const loadHistory = () => {
    supabase.from("skin_assessments").select("*").eq("patient_id", patientId).order("assessment_date", { ascending: false }).then(({ data }) => setHistory(data ?? []));
  };
  useEffect(loadHistory, [patientId]);

  useEffect(() => {
    if (!activeId) { setNotes([]); return; }
    supabase.from("skin_assessment_notes").select("*").eq("skin_assessment_id", activeId).order("noted_at", { ascending: false }).then(({ data }) => setNotes(data ?? []));
  }, [activeId]);

  const clinicianSigned = !!(sig.dataUrl || sig.typed.trim());
  const canSubmit = clinicianSigned && !saving;

  const onDiagramClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== "abnormal") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMarkings((m) => [...m, { x, y }]);
  };

  const removeMark = (idx: number) => setMarkings((m) => m.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!clinicianSigned) { toast.error("Clinician signature required"); return; }
    setSaving(true);
    const sigUrl = await uploadSig(sig, patientId);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("skin_assessments").insert({
      patient_id: patientId,
      clinician_id: user?.id,
      assessment_date: date,
      status,
      pressure_areas: areas,
      markings,
      general_notes: generalNotes || null,
      clinician_signature_typed: sig.typed || null,
      clinician_signature_url: sigUrl,
      signed_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Skin assessment saved");
    setMarkings([]); setGeneralNotes(""); setSig({ dataUrl: null, typed: "" });
    setAreas(Object.fromEntries(PRESSURE_AREAS.map((a) => [a.key, { affected: false, note: "" }])));
    setStatus("normal");
    loadHistory();
  };

  const addNote = async () => {
    if (!activeId || !newRemark.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("skin_assessment_notes").insert({
      skin_assessment_id: activeId,
      patient_id: patientId,
      remarks: newRemark.trim(),
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    setNewRemark("");
    const { data } = await supabase.from("skin_assessment_notes").select("*").eq("skin_assessment_id", activeId).order("noted_at", { ascending: false });
    setNotes(data ?? []);
    toast.success("Note added");
  };

  const active = history.find((h) => h.id === activeId);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Clinical / Integumentary</div>
          <h2 className="text-3xl font-extrabold tracking-tight">Skin Assessment</h2>
          {!roleLoading && (
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
              {isClinician ? "Clinician view · create & sign" : isCaregiver ? "Caregiver view · notes only" : "Read-only view"}
            </div>
          )}
        </div>
        {history[0] && (
          <PrecautionBadge
            variant={history[0].status === "abnormal" ? "red" : "neutral"}
            label={`SKIN ${history[0].status.toUpperCase()} · ${history[0].assessment_date}`}
          />
        )}
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-6">
          {canCreate ? (<>
          <FormSection title="Assessment Header">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Assessment Date</FieldLabel>
                <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Overall Status</FieldLabel>
                <div className="flex gap-2">
                  {(["normal", "abnormal"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={"px-4 py-2 text-xs font-bold uppercase tracking-wider border-2 " + (status === s ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-foreground")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Body Diagram" description={status === "abnormal" ? "Click on the diagram to mark affected areas. Click a marker to remove it." : "Set status to Abnormal to mark affected areas."}>
            <div
              ref={diagramRef}
              onClick={onDiagramClick}
              className={"relative mx-auto max-w-sm border-2 border-border bg-card " + (status === "abnormal" ? "cursor-crosshair" : "cursor-not-allowed opacity-90")}
            >
              <img src={bodyDiagram} alt="Body diagram for marking skin findings" className="w-full h-auto pointer-events-none select-none" />
              {markings.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeMark(i); }}
                  className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-destructive border-2 border-background shadow-md hover:scale-125 transition"
                  style={{ left: `${m.x}%`, top: `${m.y}%` }}
                  aria-label={`Remove marker ${i + 1}`}
                />
              ))}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-2 text-center">{markings.length} marker{markings.length !== 1 ? "s" : ""} placed</div>
          </FormSection>

          <FormSection title="Areas Prone to Pressure Sores" description="Check any area that is broken, bruised, or reddened. Add a brief note if needed.">
            <div className="grid sm:grid-cols-2 gap-3">
              {PRESSURE_AREAS.map((a) => (
                <div key={a.key} className="border border-border p-3 space-y-2">
                  <CheckboxRow
                    label={a.label}
                    checked={areas[a.key].affected}
                    onChange={(v) => setAreas((s) => ({ ...s, [a.key]: { ...s[a.key], affected: v } }))}
                  />
                  {areas[a.key].affected && (
                    <TextInput
                      placeholder="Describe finding…"
                      value={areas[a.key].note}
                      onChange={(e) => setAreas((s) => ({ ...s, [a.key]: { ...s[a.key], note: e.target.value } }))}
                    />
                  )}
                </div>
              ))}
            </div>
          </FormSection>

          <FormSection title="General Notes">
            <textarea
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-background border border-border text-sm font-mono"
              placeholder="Additional observations…"
            />
          </FormSection>

          <FormSection title="Clinician Signature" description="Required to save assessment.">
            <SignaturePad value={sig} onChange={setSig} />
          </FormSection>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="px-6 py-3 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90"
          >
            {saving ? "Saving…" : "Save Skin Assessment"}
          </button>
          </>) : (
            <div className="border border-border p-6 bg-muted/30">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Read-only</div>
              <div className="text-sm">
                {isCaregiver
                  ? "Only RNs and admins can create new skin assessments. You can add dated notes to any existing assessment using the panel on the right."
                  : "Only clinicians can create skin assessments. Select an assessment on the right to review details."}
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">History</div>
            <div className="space-y-2">
              {history.length === 0 && <div className="text-xs text-muted-foreground">No prior assessments.</div>}
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setActiveId(h.id === activeId ? null : h.id)}
                  className={"w-full text-left border p-3 transition " + (h.id === activeId ? "border-primary bg-primary/5" : "border-border hover:border-foreground")}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold">{h.assessment_date}</div>
                    <span className={"text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 " + (h.status === "abnormal" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground")}>{h.status}</span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">
                    {(h.markings?.length ?? 0)} markers · {Object.values(h.pressure_areas ?? {}).filter((a: any) => a?.affected).length} areas
                  </div>
                </button>
              ))}
            </div>
          </div>

          {active && (
            <div className="border border-border p-4 space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Notes log · {active.assessment_date}</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notes.length === 0 && <div className="text-xs text-muted-foreground">No notes yet.</div>}
                {notes.map((n) => (
                  <div key={n.id} className="text-xs border-l-2 border-primary pl-2">
                    <div className="font-mono text-[10px] text-muted-foreground">{new Date(n.noted_at).toLocaleString()}</div>
                    <div>{n.remarks}</div>
                  </div>
                ))}
              </div>
              {canAddNotes ? (<div className="space-y-2">
                <textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  rows={2}
                  className="w-full px-2 py-1.5 bg-background border border-border text-xs font-mono"
                  placeholder="Add a dated remark…"
                />
                <button
                  type="button"
                  onClick={addNote}
                  disabled={!newRemark.trim()}
                  className="w-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider bg-foreground text-background disabled:opacity-40"
                >
                  Add Note
                </button>
              </div>) : (
                <div className="text-[11px] font-mono text-muted-foreground">Read-only · contact your care team to add notes.</div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}