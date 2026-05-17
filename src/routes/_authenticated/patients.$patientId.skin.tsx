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
type Marking = { x: number; y: number; side: Side; label: string; area?: string };

const areaLabel = (k?: string) => PRESSURE_AREAS.find((a) => a.key === k)?.label;

async function uploadSig(sig: SignatureValue, patientId: string): Promise<string | null> {
  if (!sig.dataUrl) return null;
  const blob = await (await fetch(sig.dataUrl)).blob();
  const path = `${patientId}/skin-${Date.now()}.png`;
  const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png" });
  if (error) { toast.error(error.message); return null; }
  return path;
}

function BodyCanvas({
  side, image, markings, editable, onAdd, onRemove, large,
}: {
  side: Side; image: string; markings: Marking[]; editable: boolean;
  onAdd: (x: number, y: number) => void; onRemove: (idx: number) => void; large?: boolean;
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
        className={"relative border-2 border-border bg-card mx-auto " + (large ? "max-w-md " : "") + (editable ? "cursor-crosshair" : "cursor-not-allowed opacity-90")}
      >
        <img src={image} alt={`Body diagram ${side}`} className="w-full h-auto pointer-events-none select-none" />
        {sideMarks.map(({ m, i }, idx) => (
          <button
            key={i}
            type="button"
            onClick={(e) => { e.stopPropagation(); if (editable) onRemove(i); }}
            className="absolute -ml-3 -mt-3 w-6 h-6 rounded-full bg-destructive text-destructive-foreground border-2 border-background shadow-md text-[10px] font-bold flex items-center justify-center hover:scale-125 transition"
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            title={[areaLabel(m.area), m.label].filter(Boolean).join(" — ") || `Marker ${idx + 1}`}
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
  const viewKey = `skin_view_${patientId}`;
  const [view, setView] = useState<Side>(() => {
    if (typeof window === "undefined") return "front";
    return (localStorage.getItem(viewKey) as Side) || "front";
  });
  useEffect(() => { localStorage.setItem(viewKey, view); }, [view, viewKey]);
  const [pending, setPending] = useState<{ x: number; y: number; side: Side } | null>(null);
  const [pendingArea, setPendingArea] = useState<string>("");
  const [pendingLabel, setPendingLabel] = useState<string>("");

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
    setPending({ x, y, side });
    setPendingArea("");
    setPendingLabel("");
  };
  const confirmMarker = () => {
    if (!pending) return;
    setMarkings((m) => [...m, { ...pending, label: pendingLabel.trim(), area: pendingArea || undefined }]);
    if (pendingArea) {
      setAreas((s) => ({ ...s, [pendingArea]: { affected: true, note: pendingLabel.trim() || s[pendingArea].note } }));
    }
    setPending(null);
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
  const printTarget = active ?? history[0];

  const exportPdf = () => {
    if (!printTarget) { toast.error("No assessment to export"); return; }
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) { toast.error("Pop-up blocked"); return; }
    const marks: Marking[] = Array.isArray(printTarget.markings) ? printTarget.markings : [];
    const areasMap = (printTarget.pressure_areas ?? {}) as Record<string, { affected: boolean; note: string }>;
    const renderSide = (s: Side, img: string) => {
      const sideMarks = marks.map((m, i) => ({ m, i: marks.filter((mm, j) => mm.side === s && j <= i).length })).filter(({ m }) => m.side === s);
      return `
        <div style="text-align:center">
          <div style="font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#666">${s}</div>
          <div style="position:relative;display:inline-block;border:1px solid #000">
            <img src="${img}" style="width:280px;height:auto;display:block"/>
            ${sideMarks.map(({ m, i }) => `<span style="position:absolute;left:${m.x}%;top:${m.y}%;margin-left:-10px;margin-top:-10px;width:20px;height:20px;border-radius:50%;background:#c00;color:#fff;font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center;border:1px solid #fff">${i}</span>`).join("")}
          </div>
        </div>`;
    };
    const notationsList = marks.map((m, i) => `<li><b>#${i + 1}</b> [${m.side}] ${areaLabel(m.area) ? `<i>${areaLabel(m.area)}</i> — ` : ""}${m.label || "(no label)"}</li>`).join("");
    const areasList = Object.entries(areasMap).filter(([, v]) => v?.affected).map(([k, v]) => `<li><b>${areaLabel(k) ?? k}</b>: ${v.note || "—"}</li>`).join("") || "<li>None</li>";
    const historyList = history.map((h) => `<li>${h.assessment_date} — <b>${h.status}</b> (${Array.isArray(h.markings) ? h.markings.length : 0} notations)</li>`).join("");
    const sigBlock = printTarget.clinician_signature_typed
      ? `<div style="font-family:'Brush Script MT',cursive;font-size:24px">${printTarget.clinician_signature_typed}</div>`
      : printTarget.clinician_signature_url
      ? `<div style="font-size:10px;color:#666">[signature on file]</div>`
      : `<div style="font-size:10px;color:#666">—</div>`;
    w.document.write(`<!doctype html><html><head><title>Skin Assessment ${printTarget.assessment_date}</title>
      <style>body{font-family:ui-sans-serif,system-ui,sans-serif;padding:24px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid #000;padding-bottom:4px;margin-top:18px}ul{padding-left:18px;font-size:12px;line-height:1.5}@media print{button{display:none}}</style></head><body>
      <h1>Skin Assessment Report</h1>
      <div style="font-size:11px;color:#666">Date: ${printTarget.assessment_date} · Status: <b>${printTarget.status}</b></div>
      <h2>Body Diagrams</h2>
      <div style="display:flex;gap:16px;justify-content:center">${renderSide("front", bodyFront)}${renderSide("back", bodyBack)}</div>
      <h2>Notations</h2><ul>${notationsList || "<li>None</li>"}</ul>
      <h2>Pressure-Sore Areas</h2><ul>${areasList}</ul>
      <h2>General Notes</h2><div style="font-size:12px">${printTarget.general_notes || "—"}</div>
      <h2>Clinician Signature</h2>${sigBlock}
      <h2>Assessment History</h2><ul>${historyList || "<li>None</li>"}</ul>
      <div style="margin-top:24px"><button onclick="window.print()">Print / Save as PDF</button></div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <>
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
        <div className="flex items-center gap-3">
          {history[0] && (
            <PrecautionBadge
              variant={history[0].status === "abnormal" ? "red" : "neutral"}
              label={`SKIN ${history[0].status.toUpperCase()} · ${history[0].assessment_date}`}
            />
          )}
          <button
            type="button"
            onClick={exportPdf}
            disabled={!printTarget}
            className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider border-2 border-foreground hover:bg-foreground hover:text-background disabled:opacity-40"
          >
            Export / Print PDF
          </button>
        </div>
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
              <div className="flex justify-center gap-1 mb-4">
                {(["front", "back"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setView(s)}
                    className={"px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider border-2 " + (view === s ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-foreground")}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <BodyCanvas
                side={view}
                image={view === "front" ? bodyFront : bodyBack}
                markings={markings}
                editable={editable}
                onAdd={(x, y) => addMarker(view, x, y)}
                onRemove={removeMark}
                large
              />
              {markings.length > 0 && (
                <div className="mt-4 border-t border-border pt-3 space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Notations ({markings.length})</div>
                  {markings.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="inline-flex w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold items-center justify-center">{i + 1}</span>
                      <span className="font-mono uppercase text-[10px] text-muted-foreground">{m.side}</span>
                      <span className="flex-1">
                        {areaLabel(m.area) && <span className="font-mono uppercase text-[10px] text-primary mr-1">{areaLabel(m.area)}</span>}
                        {m.label || <em className="text-muted-foreground">no label</em>}
                      </span>
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
                        <span>
                          {areaLabel(m.area) && <span className="font-mono uppercase text-[10px] text-primary mr-1">{areaLabel(m.area)}</span>}
                          {m.label || <em className="text-muted-foreground">no label</em>}
                        </span>
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
    {pending && (
      <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPending(null)}>
        <div className="bg-card border-2 border-border max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">New Notation · {pending.side}</div>
            <h3 className="text-lg font-bold">Link to pressure-sore area</h3>
          </div>
          <div>
            <FieldLabel>Area (optional)</FieldLabel>
            <select
              value={pendingArea}
              onChange={(e) => setPendingArea(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border text-sm"
            >
              <option value="">— none —</option>
              {PRESSURE_AREAS.map((a) => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Note</FieldLabel>
            <TextInput
              autoFocus
              value={pendingLabel}
              onChange={(e) => setPendingLabel(e.target.value)}
              placeholder="e.g. stage 2 ulcer, bruise"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPending(null)} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider border border-border">Cancel</button>
            <button type="button" onClick={confirmMarker} className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider bg-primary text-primary-foreground">Add Notation</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}