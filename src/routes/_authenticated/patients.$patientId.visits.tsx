import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { notifyAdminsAndRns } from "@/lib/notify";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/visits")({ component: Visits });

type Visit = {
  id: string; staff_id: string | null; scheduled_date: string; scheduled_time: string | null;
  visit_type: string; status: string; check_in_at: string | null; check_out_at: string | null;
  notes: string | null; start_miles: number | null; end_miles: number | null;
  caregiver_signature_url: string | null; caregiver_signature_typed: string | null;
  patient_signature_url: string | null; patient_signature_typed: string | null;
  verified_at: string | null; patient_id?: string;
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  missed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-700",
};

function Visits() {
  const { patientId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const canEdit = primaryRole === "admin" || primaryRole === "rn";

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [type, setType] = useState("routine");
  const [checkIn, setCheckIn] = useState<Visit | null>(null);
  const [checkOut, setCheckOut] = useState<Visit | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("visits").select("*").eq("patient_id", patientId).order("scheduled_date", { ascending: false }).order("scheduled_time", { ascending: false });
    setVisits((data ?? []) as Visit[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const addVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("visits").insert({ patient_id: patientId, scheduled_date: date, scheduled_time: time || null, visit_type: type });
    if (error) return toast.error(error.message);
    setDate(""); setTime("");
    toast.success("Visit scheduled");
    load();
  };

  const markMissed = async (v: Visit) => {
    const { error } = await supabase.from("visits").update({ status: "missed" }).eq("id", v.id);
    if (error) return toast.error(error.message);
    load();
  };

  const isMine = (v: Visit) => v.staff_id === user?.id;
  const upcoming = visits.filter((v) => v.status === "scheduled" || v.status === "in_progress");
  const past = visits.filter((v) => v.status !== "scheduled" && v.status !== "in_progress");

  return (
    <div className="space-y-8">
      {canEdit && (
        <div className="border border-border bg-card p-6">
          <FormSection title="Schedule Visit">
            <form onSubmit={addVisit} className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
              <div><FieldLabel>Date</FieldLabel><TextInput required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div><FieldLabel>Time</FieldLabel><TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              <div><FieldLabel>Type</FieldLabel>
                <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                  <option>routine</option><option>SOC</option><option>recertification</option><option>post-hospitalization</option><option>discharge</option>
                </select>
              </div>
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">+ Schedule</button>
            </form>
          </FormSection>
        </div>
      )}

      <VisitList title={`Upcoming & In Progress (${upcoming.length})`} visits={upcoming} loading={loading} canEdit={canEdit} isMine={isMine}
        onCheckIn={(v) => setCheckIn(v)} onCheckOut={(v) => setCheckOut(v)} markMissed={markMissed} />
      <VisitList title={`History (${past.length})`} visits={past} loading={loading} canEdit={canEdit} isMine={isMine}
        onCheckIn={(v) => setCheckIn(v)} onCheckOut={(v) => setCheckOut(v)} markMissed={markMissed} />

      {checkIn && (
        <CheckInModal visit={checkIn} userId={user?.id ?? null}
          onClose={() => setCheckIn(null)} onSaved={() => { setCheckIn(null); load(); }} />
      )}
      {checkOut && (
        <CheckOutModal visit={checkOut} patientId={patientId} userId={user?.id ?? null}
          onClose={() => setCheckOut(null)} onSaved={() => { setCheckOut(null); load(); }} />
      )}
    </div>
  );
}

function VisitList({ title, visits, loading, canEdit, isMine, onCheckIn, onCheckOut, markMissed }: {
  title: string; visits: Visit[]; loading: boolean; canEdit: boolean;
  isMine: (v: Visit) => boolean; onCheckIn: (v: Visit) => void; onCheckOut: (v: Visit) => void; markMissed: (v: Visit) => void;
}) {
  return (
    <div className="border border-border bg-card">
      <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest">{title}</h3></div>
      {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
        : visits.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No visits.</div>
        : (
        <table className="w-full text-sm">
          <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
            <tr>
              <th className="px-4 py-2 text-left">Date / Time</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Times & Mileage</th>
              <th className="px-4 py-2 text-left">Verified</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visits.map((v) => {
              const miles = v.start_miles != null && v.end_miles != null ? (Number(v.end_miles) - Number(v.start_miles)).toFixed(1) : null;
              return (
                <tr key={v.id} className="align-top">
                  <td className="px-4 py-3 font-mono text-xs">{v.scheduled_date}<div className="text-muted-foreground">{v.scheduled_time ?? "—"}</div></td>
                  <td className="px-4 py-3 capitalize">{v.visit_type}</td>
                  <td className="px-4 py-3"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + (STATUS_COLORS[v.status] ?? "bg-muted")}>{v.status.replace("_", " ")}</span></td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                    <div>In: {v.check_in_at ? new Date(v.check_in_at).toLocaleTimeString() : "—"}</div>
                    <div>Out: {v.check_out_at ? new Date(v.check_out_at).toLocaleTimeString() : "—"}</div>
                    {miles !== null && <div className="text-foreground">Miles: {miles}</div>}
                    {v.notes && <div className="mt-1 text-xs font-sans text-foreground/80 italic max-w-xs whitespace-normal">"{v.notes}"</div>}
                  </td>
                  <td className="px-4 py-3 text-[10px]">
                    {v.verified_at ? (
                      <span className="text-primary flex items-center gap-1"><CheckCircle2 className="size-3" /> Signed</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {(canEdit || isMine(v)) && v.status === "scheduled" && (
                      <button onClick={() => onCheckIn(v)} className="text-[10px] font-mono uppercase text-primary hover:underline">Check in</button>
                    )}
                    {(canEdit || isMine(v)) && v.status === "in_progress" && (
                      <button onClick={() => onCheckOut(v)} className="text-[10px] font-mono uppercase text-primary hover:underline">Check out</button>
                    )}
                    {canEdit && v.status === "scheduled" && (
                      <button onClick={() => markMissed(v)} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-alert-red ml-3">Missed</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CheckInModal({ visit, userId, onClose, onSaved }: { visit: Visit; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [startMiles, setStartMiles] = useState<string>(visit.start_miles?.toString() ?? "");
  const [notes, setNotes] = useState(visit.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    const { error } = await supabase.from("visits").update({
      status: "in_progress",
      check_in_at: new Date().toISOString(),
      staff_id: visit.staff_id ?? userId,
      start_miles: startMiles ? Number(startMiles) : null,
      notes: notes.trim() || null,
    }).eq("id", visit.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Checked in");
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Check in</div>
          <h3 className="text-sm font-bold">{visit.scheduled_date} {visit.scheduled_time ?? ""} · {visit.visit_type}</h3>
        </div>
        <div><FieldLabel>Starting odometer (miles)</FieldLabel>
          <TextInput type="number" step="0.1" value={startMiles} onChange={(e) => setStartMiles(e.target.value)} placeholder="Optional" />
        </div>
        <div><FieldLabel>Arrival notes</FieldLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-border bg-background text-sm" />
        </div>
        <div className="text-[10px] font-mono uppercase text-muted-foreground">Check-in time will be recorded as now.</div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Check in"}</button>
        </div>
      </div>
    </div>
  );
}

function CheckOutModal({ visit, patientId, userId, onClose, onSaved }: { visit: Visit; patientId: string; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [endMiles, setEndMiles] = useState<string>(visit.end_miles?.toString() ?? "");
  const [notes, setNotes] = useState(visit.notes ?? "");
  const [careSig, setCareSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [patSig, setPatSig] = useState<SignatureValue>({ dataUrl: null, typed: "" });
  const [saving, setSaving] = useState(false);

  const uploadSig = async (dataUrl: string, label: string) => {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${patientId}/visit-${visit.id}-${label}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    setSaving(true);
    try {
      let careUrl: string | null = null, patUrl: string | null = null;
      if (careSig.dataUrl) careUrl = await uploadSig(careSig.dataUrl, "caregiver");
      if (patSig.dataUrl) patUrl = await uploadSig(patSig.dataUrl, "patient");

      const now = new Date().toISOString();
      const verified = (careSig.dataUrl || careSig.typed) && (patSig.dataUrl || patSig.typed);
      const { error } = await supabase.from("visits").update({
        status: "completed",
        check_out_at: now,
        check_in_at: visit.check_in_at ?? now,
        staff_id: visit.staff_id ?? userId,
        end_miles: endMiles ? Number(endMiles) : null,
        notes: notes.trim() || null,
        caregiver_signature_url: careUrl,
        caregiver_signature_typed: careSig.typed || null,
        patient_signature_url: patUrl,
        patient_signature_typed: patSig.typed || null,
        verified_at: verified ? now : null,
      }).eq("id", visit.id);
      if (error) throw error;

      toast.success(verified ? "Visit completed and verified" : "Visit completed (unsigned)");
      notifyAdminsAndRns({
        kind: "visit_completed",
        title: `Visit completed${verified ? " & verified" : ""}`,
        body: `${visit.scheduled_date} · ${visit.visit_type}`,
        link: `/patients/${patientId}/visits`,
        metadata: { visit_id: visit.id, patient_id: patientId },
      });
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const miles = visit.start_miles != null && endMiles ? (Number(endMiles) - Number(visit.start_miles)).toFixed(1) : null;

  return (
    <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Check out & complete</div>
          <h3 className="text-sm font-bold">{visit.scheduled_date} {visit.scheduled_time ?? ""} · {visit.visit_type}</h3>
          <div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">
            Checked in: {visit.check_in_at ? new Date(visit.check_in_at).toLocaleTimeString() : "—"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>Start miles</FieldLabel>
            <TextInput type="number" step="0.1" value={visit.start_miles?.toString() ?? ""} disabled />
          </div>
          <div><FieldLabel>End miles</FieldLabel>
            <TextInput type="number" step="0.1" value={endMiles} onChange={(e) => setEndMiles(e.target.value)} placeholder="Required for mileage" />
          </div>
          {miles && <div className="col-span-2 text-xs text-primary font-mono">Trip distance: {miles} miles</div>}
        </div>

        <div><FieldLabel>Visit notes</FieldLabel>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full px-3 py-2 border border-border bg-background text-sm" placeholder="Care provided, observations, follow-up…" />
        </div>

        <SignaturePad value={careSig} onChange={setCareSig} label="Caregiver / Staff signature" />
        <SignaturePad value={patSig} onChange={setPatSig} label="Patient / Representative signature" />

        <div className="text-[10px] font-mono uppercase text-muted-foreground">
          Check-out time = now. Visit is verified only when both signatures are provided.
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={submit} disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Complete visit"}</button>
        </div>
      </div>
    </div>
  );
}
