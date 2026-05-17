import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/$patientId/visits")({ component: Visits });

type Visit = {
  id: string; staff_id: string | null; scheduled_date: string; scheduled_time: string | null;
  visit_type: string; status: string; check_in_at: string | null; check_out_at: string | null; notes: string | null;
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
  const [actionTarget, setActionTarget] = useState<{ visit: Visit; nextStatus: "in_progress" | "completed" } | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [editTarget, setEditTarget] = useState<Visit | null>(null);
  const [editNotes, setEditNotes] = useState("");

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

  const openAction = (v: Visit, nextStatus: "in_progress" | "completed") => {
    setActionTarget({ visit: v, nextStatus });
    setActionNotes(v.notes ?? "");
  };

  const confirmAction = async () => {
    if (!actionTarget) return;
    const { visit: v, nextStatus } = actionTarget;
    const patch: any = { status: nextStatus, staff_id: v.staff_id ?? user?.id };
    const now = new Date().toISOString();
    if (nextStatus === "in_progress") patch.check_in_at = v.check_in_at ?? now;
    if (nextStatus === "completed") {
      patch.check_out_at = now;
      if (!v.check_in_at) patch.check_in_at = now;
    }
    if (actionNotes.trim()) patch.notes = actionNotes.trim();
    const { error } = await supabase.from("visits").update(patch).eq("id", v.id);
    if (error) return toast.error(error.message);
    toast.success(nextStatus === "completed" ? "Visit completed" : "Checked in");
    setActionTarget(null);
    setActionNotes("");
    load();
  };

  const markMissed = async (v: Visit) => {
    const { error } = await supabase.from("visits").update({ status: "missed" }).eq("id", v.id);
    if (error) return toast.error(error.message);
    load();
  };

  const openEdit = (v: Visit) => { setEditTarget(v); setEditNotes(v.notes ?? ""); };
  const saveEdit = async () => {
    if (!editTarget) return;
    // Only update notes — preserve check_in_at / check_out_at and status
    const { error } = await supabase.from("visits")
      .update({ notes: editNotes.trim() || null })
      .eq("id", editTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Notes updated");
    setEditTarget(null);
    setEditNotes("");
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

      <VisitList title={`Upcoming & In Progress (${upcoming.length})`} visits={upcoming} loading={loading} canEdit={canEdit} isMine={isMine} openAction={openAction} markMissed={markMissed} openEdit={openEdit} />
      <VisitList title={`History (${past.length})`} visits={past} loading={loading} canEdit={canEdit} isMine={isMine} openAction={openAction} markMissed={markMissed} openEdit={openEdit} />

      {actionTarget && (
        <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={() => setActionTarget(null)}>
          <div className="bg-card border border-border w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">{actionTarget.nextStatus === "completed" ? "Complete visit" : "Check in"}</h3>
            <div className="text-xs font-mono uppercase text-muted-foreground">
              {actionTarget.visit.scheduled_date} {actionTarget.visit.scheduled_time ?? ""} · {actionTarget.visit.visit_type}
            </div>
            <div>
              <FieldLabel>Visit notes</FieldLabel>
              <textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} rows={4} className="w-full px-3 py-2 border border-border bg-background text-sm" placeholder="Care provided, observations, follow-up…" />
            </div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">
              {actionTarget.nextStatus === "completed" ? "Check-out time will be recorded as now." : "Check-in time will be recorded as now."}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionTarget(null)} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={confirmAction} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">{actionTarget.nextStatus === "completed" ? "Complete" : "Check in"}</button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={() => setEditTarget(null)}>
          <div className="bg-card border border-border w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Edit notes — {editTarget.status}</div>
              <h3 className="text-sm font-bold">{editTarget.scheduled_date} {editTarget.scheduled_time ?? ""} · {editTarget.visit_type}</h3>
            </div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground grid grid-cols-2 gap-2 bg-muted/40 p-2">
              <div>Check-in: <span className="text-foreground">{editTarget.check_in_at ? new Date(editTarget.check_in_at).toLocaleString() : "—"}</span></div>
              <div>Check-out: <span className="text-foreground">{editTarget.check_out_at ? new Date(editTarget.check_out_at).toLocaleString() : "—"}</span></div>
            </div>
            <div>
              <FieldLabel>Visit notes</FieldLabel>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={5} className="w-full px-3 py-2 border border-border bg-background text-sm" />
              <p className="text-[10px] font-mono uppercase text-muted-foreground mt-1">Timestamps are preserved.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={saveEdit} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">Save notes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VisitList({ title, visits, loading, canEdit, isMine, openAction, markMissed, openEdit }: { title: string; visits: Visit[]; loading: boolean; canEdit: boolean; isMine: (v: Visit) => boolean; openAction: (v: Visit, s: "in_progress" | "completed") => void; markMissed: (v: Visit) => void; openEdit: (v: Visit) => void }) {
  return (
    <div className="border border-border bg-card">
      <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest">{title}</h3></div>
      {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
        : visits.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No visits.</div>
        : (
        <table className="w-full text-sm">
          <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
            <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Time</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-left">Check-in / out</th><th className="px-4 py-2 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visits.map((v) => (
              <tr key={v.id} className="align-top">
                <td className="px-4 py-3 font-mono text-xs">{v.scheduled_date}</td>
                <td className="px-4 py-3 font-mono text-xs">{v.scheduled_time ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{v.visit_type}</td>
                <td className="px-4 py-3"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + (STATUS_COLORS[v.status] ?? "bg-muted text-muted-foreground")}>{v.status.replace("_", " ")}</span></td>
                <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                  {v.check_in_at ? new Date(v.check_in_at).toLocaleTimeString() : "—"} / {v.check_out_at ? new Date(v.check_out_at).toLocaleTimeString() : "—"}
                  {v.notes && <div className="mt-1 text-xs font-sans text-foreground/80 italic max-w-xs whitespace-normal">"{v.notes}"</div>}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {(canEdit || isMine(v)) && v.status === "scheduled" && <button onClick={() => openAction(v, "in_progress")} className="text-[10px] font-mono uppercase text-primary hover:underline">Check in</button>}
                  {(canEdit || isMine(v)) && v.status === "in_progress" && <button onClick={() => openAction(v, "completed")} className="text-[10px] font-mono uppercase text-primary hover:underline">Complete</button>}
                  {canEdit && v.status === "scheduled" && <button onClick={() => markMissed(v)} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-alert-red ml-3">Missed</button>}
                  {(canEdit || isMine(v)) && <button onClick={() => openEdit(v)} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground ml-3">Edit notes</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}