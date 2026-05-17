import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FieldLabel } from "@/components/app/FormSection";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/visits")({ component: OrgVisits });

type Visit = {
  id: string; patient_id: string; staff_id: string | null; scheduled_date: string; scheduled_time: string | null;
  visit_type: string; status: string; check_in_at: string | null; check_out_at: string | null;
};
type Patient = { id: string; first_name: string; last_name: string };
type Profile = { id: string; full_name: string | null; email: string | null };

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  missed: "bg-red-100 text-red-700",
};

function OrgVisits() {
  const { primaryRole } = useCurrentUser();
  const canEdit = primaryRole === "admin" || primaryRole === "rn";

  const [visits, setVisits] = useState<Visit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [status, setStatus] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [reschedule, setReschedule] = useState<Visit | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newStaff, setNewStaff] = useState<string>("");

  const load = useCallback(async () => {
      setLoading(true);
      const [{ data: v }, { data: p }, { data: s }] = await Promise.all([
        supabase.from("visits").select("*").gte("scheduled_date", from).lte("scheduled_date", to).order("scheduled_date").order("scheduled_time"),
        supabase.from("patients").select("id,first_name,last_name"),
        supabase.from("profiles").select("id,full_name,email"),
      ]);
      setVisits((v ?? []) as Visit[]);
      setPatients((p ?? []) as Patient[]);
      setStaff((s ?? []) as Profile[]);
      setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const openReschedule = (v: Visit) => {
    setReschedule(v);
    setNewDate(v.scheduled_date);
    setNewTime(v.scheduled_time ?? "");
    setNewStaff(v.staff_id ?? "");
  };

  const saveReschedule = async () => {
    if (!reschedule) return;
    // Only update scheduling fields — check_in_at and check_out_at remain untouched
    const { error } = await supabase.from("visits")
      .update({
        scheduled_date: newDate,
        scheduled_time: newTime || null,
        staff_id: newStaff || null,
      })
      .eq("id", reschedule.id);
    if (error) return toast.error(error.message);
    toast.success("Visit rescheduled — check-in/out timestamps preserved");
    setReschedule(null);
    load();
  };

  const patientName = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.last_name}, ${p.first_name}` : "Unknown";
  };
  const staffName = (id: string | null) => {
    if (!id) return "—";
    const s = staff.find((x) => x.id === id);
    return s?.full_name ?? s?.email ?? "—";
  };

  const filtered = useMemo(() => visits.filter((v) =>
    (status === "all" || v.status === status) && (staffFilter === "all" || v.staff_id === staffFilter)
  ), [visits, status, staffFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Visit[]>();
    for (const v of filtered) {
      if (!map.has(v.scheduled_date)) map.set(v.scheduled_date, []);
      map.get(v.scheduled_date)!.push(v);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totals = {
    scheduled: filtered.filter((v) => v.status === "scheduled").length,
    in_progress: filtered.filter((v) => v.status === "in_progress").length,
    completed: filtered.filter((v) => v.status === "completed").length,
    missed: filtered.filter((v) => v.status === "missed").length,
  };

  return (
    <>
      <PageHeader eyebrow="Operations" title="Visits & Scheduling" description="Organization-wide visit schedule across all patients." />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(totals) as Array<keyof typeof totals>).map((k) => (
            <div key={k} className="border border-border bg-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">{k.replace("_", " ")}</div>
              <div className="text-2xl font-extrabold font-mono mt-1 tabular-nums">{totals[k]}</div>
            </div>
          ))}
        </div>

        <div className="border border-border bg-card p-4 flex flex-wrap gap-4 items-end">
          <div><FieldLabel>From</FieldLabel><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm" /></div>
          <div><FieldLabel>To</FieldLabel><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm" /></div>
          <div><FieldLabel>Status</FieldLabel>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm">
              <option value="all">All</option>
              <option value="scheduled">Scheduled</option><option value="in_progress">In progress</option>
              <option value="completed">Completed</option><option value="missed">Missed</option>
            </select>
          </div>
          <div><FieldLabel>Staff</FieldLabel>
            <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm">
              <option value="all">All staff</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="text-xs text-muted-foreground text-center p-8">Loading…</div>
          : grouped.length === 0 ? <div className="border border-border bg-card p-8 text-xs text-muted-foreground text-center">No visits in this range.</div>
          : grouped.map(([date, vs]) => (
            <div key={date} className="border border-border bg-card">
              <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="text-sm font-bold">{new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">{vs.length} visit{vs.length === 1 ? "" : "s"}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
                  <tr><th className="px-4 py-2 text-left">Time</th><th className="px-4 py-2 text-left">Patient</th><th className="px-4 py-2 text-left">Staff</th><th className="px-4 py-2 text-left">Type</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-left">Duration</th><th className="px-4 py-2 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {vs.map((v) => {
                    const dur = v.check_in_at && v.check_out_at
                      ? Math.round((new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 60000)
                      : null;
                    return (
                      <tr key={v.id}>
                        <td className="px-4 py-2 font-mono text-xs">{v.scheduled_time ?? "—"}</td>
                        <td className="px-4 py-2"><Link to="/patients/$patientId" params={{ patientId: v.patient_id }} className="text-primary hover:underline">{patientName(v.patient_id)}</Link></td>
                        <td className="px-4 py-2 text-xs">{staffName(v.staff_id)}</td>
                        <td className="px-4 py-2 capitalize">{v.visit_type}</td>
                        <td className="px-4 py-2"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + (STATUS_COLORS[v.status] ?? "bg-muted text-muted-foreground")}>{v.status.replace("_", " ")}</span></td>
                        <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{dur !== null ? `${dur} min` : "—"}</td>
                        <td className="px-4 py-2 text-right">
                          {canEdit && (
                            <button onClick={() => openReschedule(v)} className="text-[10px] font-mono uppercase text-primary hover:underline inline-flex items-center gap-1">
                              <CalendarClock className="size-3" /> Reschedule
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

        {reschedule && (
          <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={() => setReschedule(null)}>
            <div className="bg-card border border-border w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Reschedule visit</div>
                <h3 className="text-sm font-bold">{patientName(reschedule.patient_id)}</h3>
              </div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground bg-muted/40 p-2">
                Originally: {reschedule.scheduled_date} {reschedule.scheduled_time ?? ""}
                {(reschedule.check_in_at || reschedule.check_out_at) && (
                  <div className="mt-1">Check-in/out timestamps will be preserved.</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><FieldLabel>New date</FieldLabel><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" /></div>
                <div><FieldLabel>New time</FieldLabel><input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" /></div>
              </div>
              <div>
                <FieldLabel>Assign staff</FieldLabel>
                <select value={newStaff} onChange={(e) => setNewStaff(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                  <option value="">Unassigned</option>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? s.email}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setReschedule(null)} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={saveReschedule} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
