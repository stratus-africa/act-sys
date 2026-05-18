import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { FieldLabel, TextInput, TextArea, FormSection } from "@/components/app/FormSection";
import { notifyAdminsAndRns } from "@/lib/notify";
import { toast } from "sonner";
import { Pill, Plus, History, Check, X as XIcon, Pause } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/medications")({ component: Medications });

type Med = {
  id: string; patient_id: string; name: string; dose: string | null; route: string | null;
  frequency: string | null; prn: boolean; prn_indication: string | null; instructions: string | null;
  start_date: string | null; end_date: string | null; active: boolean; prescriber: string | null;
};
type Admin = {
  id: string; medication_id: string; administered_at: string; administered_by: string | null;
  dose_given: string | null; status: string; is_prn: boolean; prn_reason: string | null; response_note: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  given: "bg-green-100 text-green-700",
  refused: "bg-red-100 text-red-700",
  held: "bg-amber-100 text-amber-700",
  missed: "bg-gray-200 text-gray-700",
};

function Medications() {
  const { patientId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const canManage = primaryRole === "admin" || primaryRole === "rn";
  const canRecord = canManage || primaryRole === "caregiver";

  const [meds, setMeds] = useState<Med[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [edit, setEdit] = useState<Med | null>(null);
  const [recordTarget, setRecordTarget] = useState<Med | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: m }, { data: a }] = await Promise.all([
      supabase.from("patient_medications").select("*").eq("patient_id", patientId).order("active", { ascending: false }).order("name"),
      supabase.from("medication_administrations").select("*").eq("patient_id", patientId).order("administered_at", { ascending: false }).limit(200),
    ]);
    setMeds((m ?? []) as Med[]);
    setAdmins((a ?? []) as Admin[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const visibleMeds = meds.filter((m) => showInactive || m.active);

  return (
    <div className="space-y-8">
      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xs font-bold uppercase tracking-widest">Medications ({visibleMeds.length})</h3>
          <div className="flex gap-2 items-center">
            <label className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1.5">
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="accent-primary" />
              Show discontinued
            </label>
            {canManage && (
              <button onClick={() => setShowAdd(true)} className="bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold uppercase flex items-center gap-1">
                <Plus className="size-3.5" /> Add Medication
              </button>
            )}
          </div>
        </div>
        {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
          : visibleMeds.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No medications on record.</div>
          : (
          <table className="w-full text-sm">
            <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Medication</th>
                <th className="px-4 py-2 text-left">Dose / Route</th>
                <th className="px-4 py-2 text-left">Frequency</th>
                <th className="px-4 py-2 text-left">PRN</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleMeds.map((m) => {
                const lastAdmin = admins.find((a) => a.medication_id === m.id);
                return (
                  <tr key={m.id} className={m.active ? "" : "opacity-50"}>
                    <td className="px-4 py-3">
                      <div className="font-semibold flex items-center gap-1.5"><Pill className="size-3.5 text-primary" /> {m.name}</div>
                      {m.instructions && <div className="text-[10px] text-muted-foreground italic mt-0.5">{m.instructions}</div>}
                      {m.prescriber && <div className="text-[10px] font-mono uppercase text-muted-foreground mt-0.5">Rx by {m.prescriber}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {m.dose ?? "—"}{m.route ? ` · ${m.route}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs">{m.frequency ?? "—"}</td>
                    <td className="px-4 py-3">
                      {m.prn ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase">
                          PRN{m.prn_indication ? ` · ${m.prn_indication}` : ""}
                        </span>
                      ) : <span className="text-[10px] text-muted-foreground">Scheduled</span>}
                    </td>
                    <td className="px-4 py-3 text-[10px] font-mono uppercase">
                      {m.active ? <span className="text-primary">Active</span> : <span className="text-muted-foreground">Discontinued</span>}
                      {lastAdmin && (
                        <div className="text-muted-foreground mt-0.5">
                          Last: {new Date(lastAdmin.administered_at).toLocaleDateString()} · {lastAdmin.status}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {canRecord && m.active && (
                        <button onClick={() => setRecordTarget(m)} className="text-[10px] font-mono uppercase text-primary hover:underline">Record</button>
                      )}
                      {canManage && (
                        <button onClick={() => setEdit(m)} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground ml-3">Edit</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h3 className="text-xs font-bold uppercase tracking-widest">Administration Log ({admins.length})</h3>
        </div>
        {admins.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No administrations recorded yet.</div>
          : (
          <table className="w-full text-sm">
            <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Medication</th>
                <th className="px-4 py-2 text-left">Dose given</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {admins.map((a) => {
                const med = meds.find((m) => m.id === a.medication_id);
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{new Date(a.administered_at).toLocaleString()}</td>
                    <td className="px-4 py-2">{med?.name ?? "—"}{a.is_prn && <span className="ml-1.5 text-[9px] font-bold text-amber-600 uppercase">PRN</span>}</td>
                    <td className="px-4 py-2 text-xs">{a.dose_given ?? "—"}</td>
                    <td className="px-4 py-2"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + (STATUS_BADGE[a.status] ?? "bg-muted")}>{a.status}</span></td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {a.prn_reason && <div><strong>Reason:</strong> {a.prn_reason}</div>}
                      {a.response_note && <div><strong>Response:</strong> {a.response_note}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {(showAdd || edit) && (
        <MedFormModal
          existing={edit}
          patientId={patientId}
          userId={user?.id ?? null}
          onClose={() => { setShowAdd(false); setEdit(null); }}
          onSaved={() => { setShowAdd(false); setEdit(null); load(); }}
        />
      )}

      {recordTarget && (
        <RecordAdminModal
          med={recordTarget}
          patientId={patientId}
          userId={user?.id ?? null}
          onClose={() => setRecordTarget(null)}
          onSaved={() => { setRecordTarget(null); load(); }}
        />
      )}
    </div>
  );
}

function MedFormModal({ existing, patientId, userId, onClose, onSaved }: { existing: Med | null; patientId: string; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [dose, setDose] = useState(existing?.dose ?? "");
  const [route, setRoute] = useState(existing?.route ?? "PO");
  const [frequency, setFrequency] = useState(existing?.frequency ?? "");
  const [prn, setPrn] = useState(existing?.prn ?? false);
  const [prnIndication, setPrnIndication] = useState(existing?.prn_indication ?? "");
  const [instructions, setInstructions] = useState(existing?.instructions ?? "");
  const [startDate, setStartDate] = useState(existing?.start_date ?? "");
  const [endDate, setEndDate] = useState(existing?.end_date ?? "");
  const [prescriber, setPrescriber] = useState(existing?.prescriber ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error("Name required");
    setSaving(true);
    const payload = {
      patient_id: patientId, name: name.trim(), dose: dose || null, route: route || null,
      frequency: frequency || null, prn, prn_indication: prn ? (prnIndication || null) : null,
      instructions: instructions || null, start_date: startDate || null, end_date: endDate || null,
      prescriber: prescriber || null, active, created_by: existing ? undefined : userId,
    };
    const q = existing
      ? supabase.from("patient_medications").update(payload).eq("id", existing.id)
      : supabase.from("patient_medications").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Updated" : "Added");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <FormSection title={existing ? "Edit medication" : "New medication"}>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2"><FieldLabel>Name *</FieldLabel><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lisinopril" /></div>
            <div><FieldLabel>Dose</FieldLabel><TextInput value={dose} onChange={(e) => setDose(e.target.value)} placeholder="10 mg" /></div>
            <div><FieldLabel>Route</FieldLabel>
              <select value={route} onChange={(e) => setRoute(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                <option>PO</option><option>IV</option><option>IM</option><option>SubQ</option><option>Topical</option><option>Inhaled</option><option>Rectal</option><option>Other</option>
              </select>
            </div>
            <div><FieldLabel>Frequency</FieldLabel><TextInput value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="BID, Q6H, etc." /></div>
            <div><FieldLabel>Prescriber</FieldLabel><TextInput value={prescriber} onChange={(e) => setPrescriber(e.target.value)} /></div>
            <div><FieldLabel>Start date</FieldLabel><TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><FieldLabel>End date</FieldLabel><TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 p-2 border border-border cursor-pointer">
                <input type="checkbox" checked={prn} onChange={(e) => setPrn(e.target.checked)} className="accent-primary" />
                <span className="text-sm font-medium">PRN (as needed)</span>
              </label>
            </div>
            {prn && (
              <div className="md:col-span-2"><FieldLabel>PRN indication (when to use)</FieldLabel>
                <TextInput value={prnIndication} onChange={(e) => setPrnIndication(e.target.value)} placeholder="For pain >5/10, for anxiety, etc." />
              </div>
            )}
            <div className="md:col-span-2"><FieldLabel>Instructions</FieldLabel>
              <TextArea rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Take with food, monitor BP, etc." />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-primary" /><span className="text-sm">Active</span></label>
            </div>
          </div>
        </FormSection>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={save} disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function RecordAdminModal({ med, patientId, userId, onClose, onSaved }: { med: Med; patientId: string; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [doseGiven, setDoseGiven] = useState(med.dose ?? "");
  const [status, setStatus] = useState<"given" | "refused" | "held" | "missed">("given");
  const [prnReason, setPrnReason] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [administeredAt, setAdministeredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (med.prn && status === "given" && !prnReason.trim()) {
      return toast.error("PRN reason is required");
    }
    setSaving(true);
    const { error } = await supabase.from("medication_administrations").insert({
      medication_id: med.id,
      patient_id: patientId,
      administered_at: new Date(administeredAt).toISOString(),
      administered_by: userId,
      dose_given: doseGiven || null,
      status,
      is_prn: med.prn,
      prn_reason: med.prn ? (prnReason || null) : null,
      response_note: responseNote || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Administration recorded");
    // Notify RNs/admins on PRN doses given
    if (med.prn && status === "given") {
      notifyAdminsAndRns({
        kind: "prn_given",
        title: `PRN ${med.name} administered`,
        body: prnReason ? `Reason: ${prnReason}` : null,
        link: `/patients/${patientId}/medications`,
        metadata: { medication_id: med.id, patient_id: patientId },
      });
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Record administration</div>
          <h3 className="text-sm font-bold flex items-center gap-1.5"><Pill className="size-4 text-primary" /> {med.name} {med.dose && <span className="text-muted-foreground font-normal">· {med.dose}</span>}</h3>
          {med.prn && <div className="text-[10px] font-mono uppercase text-amber-600 mt-1">PRN{med.prn_indication ? ` · ${med.prn_indication}` : ""}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><FieldLabel>When</FieldLabel><TextInput type="datetime-local" value={administeredAt} onChange={(e) => setAdministeredAt(e.target.value)} /></div>
          <div><FieldLabel>Dose given</FieldLabel><TextInput value={doseGiven} onChange={(e) => setDoseGiven(e.target.value)} /></div>
          <div><FieldLabel>Status</FieldLabel>
            <div className="grid grid-cols-4 gap-1">
              {(["given","refused","held","missed"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={"px-1 py-2 text-[10px] font-bold uppercase border " + (status === s ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50")}>
                  {s === "given" ? <Check className="size-3 mx-auto" /> : s === "refused" ? <XIcon className="size-3 mx-auto" /> : <Pause className="size-3 mx-auto" />}
                  <div>{s}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        {med.prn && status === "given" && (
          <div><FieldLabel>PRN reason *</FieldLabel><TextInput value={prnReason} onChange={(e) => setPrnReason(e.target.value)} placeholder="Why is this being given now?" /></div>
        )}
        <div><FieldLabel>Response / notes</FieldLabel><TextArea rows={2} value={responseNote} onChange={(e) => setResponseNote(e.target.value)} placeholder="Patient response, side effects, observations…" /></div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={save} disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Record"}</button>
        </div>
      </div>
    </div>
  );
}
