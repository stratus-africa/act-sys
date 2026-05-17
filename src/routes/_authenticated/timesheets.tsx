import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { toast } from "sonner";
import { Check, X, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/timesheets")({ component: Timesheets });

type Timesheet = {
  id: string; staff_id: string; week_start: string; hours: number; notes: string | null;
  status: "draft" | "submitted" | "approved" | "rejected"; submitted_at: string | null;
  approved_by: string | null; approved_at: string | null; rejection_reason: string | null; updated_at: string;
};
type Profile = { id: string; full_name: string | null; email: string | null };
type Event = { id: string; timesheet_id: string; actor_id: string | null; action: string; notes: string | null; created_at: string };

function mondayOf(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  return x.toISOString().slice(0, 10);
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function Timesheets() {
  const { primaryRole, user } = useCurrentUser();
  const canApprove = primaryRole === "admin" || primaryRole === "rn";

  const [mine, setMine] = useState<Timesheet[]>([]);
  const [allTs, setAllTs] = useState<Timesheet[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [week, setWeek] = useState(mondayOf(new Date()));
  const [hours, setHours] = useState("0");
  const [notes, setNotes] = useState("");
  const [autoHours, setAutoHours] = useState<number | null>(null);
  const [historyFor, setHistoryFor] = useState<Timesheet | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const queries: any[] = [
      supabase.from("timesheets").select("*").eq("staff_id", user.id).order("week_start", { ascending: false }),
    ];
    if (canApprove) {
      queries.push(supabase.from("timesheets").select("*").in("status", ["submitted", "approved", "rejected"]).order("week_start", { ascending: false }).limit(100));
      queries.push(supabase.from("profiles").select("id,full_name,email"));
    }
    const results = await Promise.all(queries);
    setMine((results[0].data ?? []) as Timesheet[]);
    if (canApprove) {
      setAllTs((results[1].data ?? []) as Timesheet[]);
      setProfiles((results[2].data ?? []) as Profile[]);
    }
    setLoading(false);
  }, [user, canApprove]);

  useEffect(() => { load(); }, [load]);

  const logEvent = async (timesheet_id: string, action: string, notes?: string) => {
    if (!user) return;
    await supabase.from("timesheet_events").insert({ timesheet_id, actor_id: user.id, action, notes: notes ?? null });
  };

  const openHistory = async (t: Timesheet) => {
    setHistoryFor(t);
    const { data } = await supabase.from("timesheet_events").select("*").eq("timesheet_id", t.id).order("created_at", { ascending: false });
    setEvents((data ?? []) as Event[]);
  };

  // Auto-compute hours from visit check-in/out for the chosen week
  useEffect(() => {
    if (!user) return;
    const weekEnd = new Date(week + "T00:00:00");
    weekEnd.setDate(weekEnd.getDate() + 7);
    supabase.from("visits")
      .select("check_in_at,check_out_at")
      .eq("staff_id", user.id)
      .eq("status", "completed")
      .gte("scheduled_date", week)
      .lt("scheduled_date", weekEnd.toISOString().slice(0, 10))
      .then(({ data }) => {
        const mins = (data ?? []).reduce((sum, v: any) => {
          if (!v.check_in_at || !v.check_out_at) return sum;
          return sum + Math.max(0, (new Date(v.check_out_at).getTime() - new Date(v.check_in_at).getTime()) / 60000);
        }, 0);
        setAutoHours(Math.round((mins / 60) * 100) / 100);
      });
  }, [week, user]);

  const upsert = async (status: "draft" | "submitted") => {
    if (!user) return;
    const h = parseFloat(hours) || 0;
    const payload: any = { staff_id: user.id, week_start: week, hours: h, notes: notes.trim() || null, status };
    if (status === "submitted") payload.submitted_at = new Date().toISOString();
    const { data: row, error } = await supabase.from("timesheets").upsert(payload, { onConflict: "staff_id,week_start" }).select().single();
    if (error) return toast.error(error.message);
    if (row) await logEvent(row.id, status === "submitted" ? "submitted" : "saved_draft", `Hours: ${h}`);
    toast.success(status === "submitted" ? "Timesheet submitted" : "Draft saved");
    setHours("0"); setNotes("");
    load();
  };

  const approve = async (t: Timesheet) => {
    const { error } = await supabase.from("timesheets").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString(), rejection_reason: null }).eq("id", t.id);
    if (error) return toast.error(error.message);
    await logEvent(t.id, "approved");
    load();
  };
  const reject = async (t: Timesheet) => {
    const reason = prompt("Rejection reason:");
    if (!reason) return;
    const { error } = await supabase.from("timesheets").update({ status: "rejected", rejection_reason: reason, approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", t.id);
    if (error) return toast.error(error.message);
    await logEvent(t.id, "rejected", reason);
    load();
  };

  const staffName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.full_name ?? p?.email ?? id.slice(0, 8);
  };

  return (
    <>
      <PageHeader eyebrow="Operations" title="Timesheets" description="Log hours by week. Approved by Admin or RN." />
      <div className="p-8 space-y-8">
        <div className="border border-border bg-card p-6">
          <FormSection title="Log Hours" description="Auto-computed from completed visit check-in / check-out for the selected week. Edit if needed before submitting.">
            <div className="grid md:grid-cols-[1fr_1fr_2fr_auto_auto] gap-3 items-end">
              <div><FieldLabel>Week of</FieldLabel><TextInput type="date" value={week} onChange={(e) => setWeek(mondayOf(new Date(e.target.value)))} /></div>
              <div>
                <FieldLabel>Hours</FieldLabel>
                <TextInput type="number" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} />
                {autoHours !== null && (
                  <button type="button" onClick={() => setHours(String(autoHours))} className="text-[10px] font-mono uppercase text-primary hover:underline mt-1">
                    Use auto: {autoHours} h from visits
                  </button>
                )}
              </div>
              <div><FieldLabel>Notes</FieldLabel><TextInput value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></div>
              <button onClick={() => upsert("draft")} className="px-4 py-2 text-sm font-bold border border-border hover:bg-muted">Save draft</button>
              <button onClick={() => upsert("submitted")} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">Submit</button>
            </div>
          </FormSection>
        </div>

        <div className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest">My Timesheets ({mine.length})</h3></div>
          {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
            : mine.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No timesheets yet.</div>
            : (
            <table className="w-full text-sm">
              <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
                <tr><th className="px-4 py-2 text-left">Week</th><th className="px-4 py-2 text-left">Hours</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-left">Notes</th><th className="px-4 py-2 text-left">Updated</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mine.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 font-mono text-xs">{t.week_start}</td>
                    <td className="px-4 py-2 font-mono tabular-nums">{t.hours}</td>
                    <td className="px-4 py-2"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + STATUS_COLORS[t.status]}>{t.status}</span>
                      {t.rejection_reason && <div className="text-[10px] text-alert-red mt-1 italic">"{t.rejection_reason}"</div>}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{t.notes ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                      {new Date(t.updated_at).toLocaleString()}
                      <button onClick={() => openHistory(t)} className="ml-2 text-primary hover:underline inline-flex items-center gap-1"><History className="size-3" />history</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {canApprove && (
          <div className="border border-border bg-card">
            <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest">All Submissions ({allTs.length})</h3></div>
            {allTs.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No submissions to review.</div> : (
              <table className="w-full text-sm">
                <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
                  <tr><th className="px-4 py-2 text-left">Staff</th><th className="px-4 py-2 text-left">Week</th><th className="px-4 py-2 text-left">Hours</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-left">Submitted</th><th className="px-4 py-2 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allTs.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2 font-semibold">{staffName(t.staff_id)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{t.week_start}</td>
                      <td className="px-4 py-2 font-mono tabular-nums">{t.hours}</td>
                      <td className="px-4 py-2"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + STATUS_COLORS[t.status]}>{t.status}</span></td>
                      <td className="px-4 py-2 font-mono text-[10px]">{t.submitted_at ? new Date(t.submitted_at).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-2 text-right">
                        {t.status === "submitted" && (
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => approve(t)} className="text-primary p-1 hover:bg-primary/10" title="Approve"><Check className="size-4" /></button>
                            <button onClick={() => reject(t)} className="text-alert-red p-1 hover:bg-alert-red/10" title="Reject"><X className="size-4" /></button>
                          </div>
                        )}
                        <button onClick={() => openHistory(t)} className="text-muted-foreground hover:text-foreground p-1 mt-1" title="History"><History className="size-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {historyFor && (
          <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={() => setHistoryFor(null)}>
            <div className="bg-card border border-border w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Audit history</div>
                <h3 className="text-sm font-bold">Week of {historyFor.week_start} — {historyFor.hours}h</h3>
              </div>
              {events.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-6">No events recorded.</div>
              ) : (
                <ul className="divide-y divide-border max-h-96 overflow-auto">
                  {events.map((e) => (
                    <li key={e.id} className="py-3 flex items-start gap-3">
                      <span className={"text-[10px] font-bold uppercase px-2 py-0.5 rounded-full " + (e.action === "approved" ? "bg-green-100 text-green-700" : e.action === "rejected" ? "bg-red-100 text-red-700" : e.action === "submitted" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground")}>{e.action.replace("_", " ")}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">{new Date(e.created_at).toLocaleString()} · by {e.actor_id?.slice(0, 8) ?? "system"}</div>
                        {e.notes && <div className="text-xs italic text-foreground/80 mt-1">"{e.notes}"</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end"><button onClick={() => setHistoryFor(null)} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Close</button></div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
