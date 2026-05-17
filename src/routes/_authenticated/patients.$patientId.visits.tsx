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

  const updateStatus = async (v: Visit, status: string) => {
    const patch: any = { status };
    if (status === "in_progress") patch.check_in_at = new Date().toISOString();
    if (status === "completed") patch.check_out_at = new Date().toISOString();
    const { error } = await supabase.from("visits").update(patch).eq("id", v.id);
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

      <VisitList title={`Upcoming & In Progress (${upcoming.length})`} visits={upcoming} loading={loading} canEdit={canEdit} isMine={isMine} updateStatus={updateStatus} />
      <VisitList title={`History (${past.length})`} visits={past} loading={loading} canEdit={canEdit} isMine={isMine} updateStatus={updateStatus} />
    </div>
  );
}

function VisitList({ title, visits, loading, canEdit, isMine, updateStatus }: { title: string; visits: Visit[]; loading: boolean; canEdit: boolean; isMine: (v: Visit) => boolean; updateStatus: (v: Visit, s: string) => void }) {
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
              <tr key={v.id}>
                <td className="px-4 py-3 font-mono text-xs">{v.scheduled_date}</td>
                <td className="px-4 py-3 font-mono text-xs">{v.scheduled_time ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{v.visit_type}</td>
                <td className="px-4 py-3"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + (STATUS_COLORS[v.status] ?? "bg-muted text-muted-foreground")}>{v.status.replace("_", " ")}</span></td>
                <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                  {v.check_in_at ? new Date(v.check_in_at).toLocaleTimeString() : "—"} / {v.check_out_at ? new Date(v.check_out_at).toLocaleTimeString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {(canEdit || isMine(v)) && v.status === "scheduled" && <button onClick={() => updateStatus(v, "in_progress")} className="text-[10px] font-mono uppercase text-primary hover:underline">Check in</button>}
                  {(canEdit || isMine(v)) && v.status === "in_progress" && <button onClick={() => updateStatus(v, "completed")} className="text-[10px] font-mono uppercase text-primary hover:underline">Complete</button>}
                  {canEdit && v.status === "scheduled" && <button onClick={() => updateStatus(v, "missed")} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-alert-red ml-3">Missed</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}