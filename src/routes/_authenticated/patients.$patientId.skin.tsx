import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { FormSection, CheckboxRow, FieldLabel, TextInput } from "@/components/app/FormSection";
import { PrecautionBadge } from "@/components/app/PrecautionBadge";
import { toast } from "sonner";
import bodyFront from "@/assets/skin-body-diagram.jpg";
import bodyBack from "@/assets/skin-body-diagram-back.jpg";
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

type Side = "front" | "back";
type Marking = { x: number; y: number; side: Side; label: string };

async function uploadSig(sig: SignatureValue, patientId: string): Promise<string | null> {
  if (!sig.dataUrl) return null;
  const blob = await (await fetch(sig.dataUrl)).blob();
  const path = `${patientId}/skin-${Date.now()}.png`;
  const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
  if (error) { toast.error(error.message); return null; }
  return path;
}

function BodyCanvas({
  side, image, markings, editable, onAdd, onRemove,
}: {
  side: Side; image: string; markings: Marking[]; editable: boolean;
  onAdd: (x: number, y: number) => void; onRemove: (idx: number) => void;
}) {
  const sideMarks = markings.map((m, i) => ({ m, i })).filter(({ m }) => m.side === side);
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">{side}</div>
      <div
        onClick={(e) => {
          if (!editable) return;
          const r = e.currentTarget.getBoundingClientRect();
          onAdd(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
        }}
        className={"relative border-2 border-border bg-card " + (editable ? "cursor-crosshair" : "cursor-not-allowed opacity-90")}
      >
        <img src={image} alt={`Body diagram ${side}`} className="w-full h-auto pointer-events-none select-none" />
        {sideMarks.map(({ m, i }, idx) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); if (editable) onRemove(i); }}
            className="absolute -ml-3 -mt-3 w-6 h-6 rounded-full bg-destructive text-destructive-foreground border-2 border-background shadow-md text-[10px] font-bold flex items-center justify-center hover:scale-125 transition"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            title={m.label || `Marker ${idx + 1}`}
            aria-label={`Remove ${m.label || `marker ${idx + 1}`}`}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    </div>
  );
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
  const editable = canCreate && status === "abnormal";

  const addMarker = (side: Side, x: number, y: number) => {
    const label = window.prompt(`Notation for marker on ${side}? (e.g. "bruise", "stage 2 ulcer")`, "");
    if (label === null) return;
    setMarkings((m) => [...m, { x, y, side, label: label.trim() }]);
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

      {canCreate ? (
        <>
          <FormSection title="Assessment Header">
            <div className="grid grid-cols-2 gap-4 max-w-2xl">
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

          <div className="grid lg:grid-cols-[1fr_360px] gap-8">
            <FormSection
              title="Body Diagram — Front & Back"
              description={editable ? "Click on either diagram to add a labeled notation. Click a marker to remove it." : "Set status to Abnormal to mark and notate affected areas."}
            >
              <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                <BodyCanvas side="front" image={bodyFront} markings={markings} editable={editable} onAdd={(x, y) => addMarker("front", x, y)} onRemove={removeMark} />
                <BodyCanvas side="back" image={bodyBack} markings={markings} editable={editable} onAdd={(x, y) => addMarker("back", x, y)} onRemove={removeMark} />
              </div>
              {markings.length > 0 && (
                <div className="mt-4 border-t border-border pt-3 space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Notations ({markings.length})</div>
                  {markings.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="inline-flex w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold items-center justify-center">{i + 1}</span>
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">{m.side}</span>
                      <span className="flex-1">{m.label || <em className="text-muted-foreground">no label</em>}</span>
                      {editable && (
                        <button type="button" onClick={() => removeMark(i)} className="text-[10px] uppercase text-destructive font-bold">remove</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </FormSection>

            <FormSection title="Areas Prone to Pressure Sores" description="Check any area that is broken, bruised, or reddened.">
              <div className="space-y-2">
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
          </div>

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
        </>
      ) : (
        <div className="border border-border p-6 bg-muted/30">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Read-only</div>
          <div className="text-sm">
            {isCaregiver
              ? "Only RNs and admins can create new skin assessments. You can add dated notes to any existing assessment below."
              : "Only clinicians can create skin assessments. Review prior assessments below."}
          </div>
        </div>
      )}

      <FormSection title="Assessment History" description="Select an assessment to view notations and add dated notes.">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-6">
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {history.length === 0 && <div className="text-xs text-muted-foreground">No prior assessments.</div>}
            {history.map((h) => {
              const markCount = Array.isArray(h.markings) ? h.markings.length : 0;
              const areaCount = Object.values(h.pressure_areas ?? {}).filter((a: any) => a?.affected).length;
              return (
                <button
                  key={h.id}
                  onClick={() => setActiveId(h.id === activeId ? null : h.id)}
                  className={"w-full text-left border p-3 transition " + (h.id === activeId ? "border-primary bg-primary/5" : "border-border hover:border-foreground")}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold">{h.assessment_date}</div>
                    <PrecautionBadge variant={h.status === "abnormal" ? "red" : "neutral"} label={h.status} />
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">
                    {markCount} notation{markCount !== 1 ? "s" : ""} · {areaCount} pressure area{areaCount !== 1 ? "s" : ""}
                  </div>
                </button>
              );
            })}
          </div>

          {active ? (
            <div className="border border-border p-4 space-y-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Notations · {active.assessment_date}</div>
                {(active.markings as Marking[] | null)?.length ? (
                  <ul className="mt-2 space-y-1">
                    {(active.markings as Marking[]).map((m, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="inline-flex w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold items-center justify-center">{i + 1}</span>
                        <span className="font-mono uppercase text-[10px] text-muted-foreground">{m.side}</span>
                        <span>{m.label || <em className="text-muted-foreground">no label</em>}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-muted-foreground mt-2">No body notations.</div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Notes log</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {notes.length === 0 && <div className="text-xs text-muted-foreground">No notes yet.</div>}
                  {notes.map((n) => (
                    <div key={n.id} className="text-xs border-l-2 border-primary pl-2">
                      <div className="font-mono text-[10px] text-muted-foreground">{new Date(n.noted_at).toLocaleString()}</div>
                      <div>{n.remarks}</div>
                    </div>
                  ))}
                </div>
                {canAddNotes ? (
                  <div className="space-y-2 mt-3">
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
                      className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider bg-foreground text-background disabled:opacity-40"
                    >
                      Add Note
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] font-mono text-muted-foreground mt-3">Read-only · contact your care team to add notes.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-dashed border-border p-6 text-xs text-muted-foreground flex items-center justify-center">
              Select an assessment to view details.
            </div>
          )}
        </div>
      </FormSection>
    </div>
  );
}