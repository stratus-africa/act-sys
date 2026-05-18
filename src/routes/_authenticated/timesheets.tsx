import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { SignaturePad, type SignatureValue } from "@/components/app/SignaturePad";
import { toast } from "sonner";
import { Check, X, History, Plus, FileText, RefreshCw } from "lucide-react";

type VisitRow = {
  scheduled_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  start_miles: number | null;
  end_miles: number | null;
};

function hhmm(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function fetchVisitsForWeek(staffId: string, patientId: string, weekStart: string): Promise<VisitRow[]> {
  const end = new Date(weekStart + "T00:00:00");
  end.setDate(end.getDate() + 6);
  const endStr = end.toISOString().slice(0, 10);
  const { data } = await supabase
    .from("visits")
    .select("scheduled_date,check_in_at,check_out_at,start_miles,end_miles")
    .eq("staff_id", staffId)
    .eq("patient_id", patientId)
    .gte("scheduled_date", weekStart)
    .lte("scheduled_date", endStr)
    .order("check_in_at", { ascending: true });
  return (data ?? []) as VisitRow[];
}

function applyVisitsToDays(days: DayEntry[], visits: VisitRow[]): DayEntry[] {
  // Group visits by date — earliest time_in, latest time_out, sum mileage.
  const byDate = new Map<string, VisitRow[]>();
  for (const v of visits) {
    const arr = byDate.get(v.scheduled_date) ?? [];
    arr.push(v);
    byDate.set(v.scheduled_date, arr);
  }
  return days.map((d) => {
    const vs = byDate.get(d.date);
    if (!vs || vs.length === 0) return d;
    const ins = vs.map((v) => v.check_in_at).filter(Boolean) as string[];
    const outs = vs.map((v) => v.check_out_at).filter(Boolean) as string[];
    const tin = ins.length ? hhmm(ins.sort()[0]) : d.time_in;
    const tout = outs.length ? hhmm(outs.sort().slice(-1)[0]) : d.time_out;
    let miles = 0;
    for (const v of vs) {
      if (v.start_miles != null && v.end_miles != null) miles += Number(v.end_miles) - Number(v.start_miles);
    }
    const next: DayEntry = {
      ...d,
      time_in: tin,
      time_out: tout,
      miles: miles > 0 ? miles.toFixed(1) : d.miles,
    };
    next.total_hours = computeHours(next.time_in, next.time_out, next.break_minutes);
    return next;
  });
}

export const Route = createFileRoute("/_authenticated/timesheets")({ component: Timesheets });

type DayEntry = {
  date: string;
  time_in: string;
  time_out: string;
  break_minutes: string;
  sleep_in: boolean;
  total_hours: string;
  miles: string;
  client_initial: string;
};

type Availability = Record<string, Record<"7-3" | "3-11" | "11-7", boolean>>;

type Timesheet = {
  id: string;
  staff_id: string;
  patient_id: string | null;
  client_name: string | null;
  employee_name: string | null;
  week_start: string;
  hours: number;
  notes: string | null;
  comments: string | null;
  days: DayEntry[];
  tasks: Record<string, boolean[]>;
  availability: Availability;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  employee_signature_url: string | null;
  employee_signature_typed: string | null;
  employee_signed_at: string | null;
  client_signature_url: string | null;
  client_signature_typed: string | null;
  client_signed_at: string | null;
  updated_at: string;
};
type Profile = { id: string; full_name: string | null; email: string | null };
type Patient = { id: string; first_name: string; last_name: string };
type Event = { id: string; timesheet_id: string; actor_id: string | null; action: string; notes: string | null; created_at: string };

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["S", "M", "T", "W", "T", "F", "Sat"];

const TASK_GROUPS: { title: string; tasks: string[] }[] = [
  {
    title: "Personal Care",
    tasks: ["Dressed / Undressed", "Bed Bath", "Oral Hygiene", "Shampoo", "Eating", "Urinary", "Meal Preparation", "Med Reminders", "Take Out Garbage"],
  },
  {
    title: "Home Management",
    tasks: ["House Keeping", "Changed Linens", "Vacuumed", "Clean Bathroom", "Clean Kitchen", "Grocery Shopping", "Dusted", "Mopped Floors", "Made Bed"],
  },
  {
    title: "Toileting",
    tasks: ["Bathroom", "Urinal", "Attend Brief"],
  },
  {
    title: "Transfer",
    tasks: ["From the Chair", "From the Bed", "In/Out of Car", "Hoyer Lift"],
  },
  {
    title: "Activities",
    tasks: ["Escort to Appointment(s)", "Pet Care", "Mail Letters / Bills", "Errands", "Recreational", "Transportation"],
  },
];

const SHIFTS: Array<"7-3" | "3-11" | "11-7"> = ["7-3", "3-11", "11-7"];
const AVAILABILITY_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function sundayOf(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

function emptyDays(weekStart: string): DayEntry[] {
  const base = new Date(weekStart + "T00:00:00");
  return DAYS_OF_WEEK.map((_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      date: d.toISOString().slice(0, 10),
      time_in: "",
      time_out: "",
      break_minutes: "",
      sleep_in: false,
      total_hours: "",
      miles: "",
      client_initial: "",
    };
  });
}

function computeHours(time_in: string, time_out: string, break_minutes: string): string {
  if (!time_in || !time_out) return "";
  const [ih, im] = time_in.split(":").map(Number);
  const [oh, om] = time_out.split(":").map(Number);
  if (Number.isNaN(ih) || Number.isNaN(oh)) return "";
  let mins = oh * 60 + om - (ih * 60 + im);
  if (mins < 0) mins += 24 * 60;
  mins -= Number(break_minutes) || 0;
  if (mins < 0) mins = 0;
  return (Math.round((mins / 60) * 100) / 100).toString();
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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [myName, setMyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Timesheet | null>(null);
  const [historyFor, setHistoryFor] = useState<Timesheet | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [mineRes, patientsRes, allRes, profilesRes, myProfileRes] = await Promise.all([
      supabase.from("timesheets").select("*").eq("staff_id", user.id).order("week_start", { ascending: false }),
      supabase.from("patients").select("id,first_name,last_name").eq("status", "active").order("last_name"),
      canApprove
        ? supabase.from("timesheets").select("*").in("status", ["submitted", "approved", "rejected"]).order("week_start", { ascending: false }).limit(200)
        : Promise.resolve({ data: [] } as any),
      canApprove ? supabase.from("profiles").select("id,full_name,email") : Promise.resolve({ data: [] } as any),
      supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
    ]);
    setMine((mineRes.data ?? []) as unknown as Timesheet[]);
    setPatients((patientsRes.data ?? []) as Patient[]);
    setAllTs(((allRes as any).data ?? []) as Timesheet[]);
    setProfiles(((profilesRes as any).data ?? []) as Profile[]);
    const mp: any = (myProfileRes as any).data;
    setMyName(mp?.full_name ?? mp?.email ?? user.email ?? "");
    setLoading(false);
  }, [user, canApprove]);

  useEffect(() => { load(); }, [load]);

  const logEvent = async (timesheet_id: string, action: string, notes?: string) => {
    if (!user) return;
    await supabase.from("timesheet_events").insert({ timesheet_id, actor_id: user.id, action, notes: notes ?? null });
  };

  const openNew = () => {
    const ws = sundayOf(new Date());
    setEditor({
      id: "",
      staff_id: user?.id ?? "",
      patient_id: null,
      client_name: "",
      employee_name: myName,
      week_start: ws,
      hours: 0,
      notes: null,
      comments: "",
      days: emptyDays(ws),
      tasks: {},
      availability: {},
      status: "draft",
      submitted_at: null,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
      employee_signature_url: null,
      employee_signature_typed: null,
      employee_signed_at: null,
      client_signature_url: null,
      client_signature_typed: null,
      client_signed_at: null,
      updated_at: new Date().toISOString(),
    });
  };

  const openEdit = (t: Timesheet) => {
    setEditor({
      ...t,
      days: t.days && t.days.length === 7 ? t.days : emptyDays(t.week_start),
      tasks: t.tasks ?? {},
      availability: t.availability ?? {},
      comments: t.comments ?? "",
      client_name: t.client_name ?? "",
      employee_name: t.employee_name ?? "",
    });
  };

  const openHistory = async (t: Timesheet) => {
    setHistoryFor(t);
    const { data } = await supabase.from("timesheet_events").select("*").eq("timesheet_id", t.id).order("created_at", { ascending: false });
    setEvents((data ?? []) as Event[]);
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
  const patientName = (id: string | null) => {
    if (!id) return "—";
    const p = patients.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : id.slice(0, 8);
  };

  return (
    <>
      <PageHeader eyebrow="Operations" title="Provider Timesheet" description="Weekly per-patient timesheet — hours, care tasks, availability, signatures." actions={
        <button onClick={openNew} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold inline-flex items-center gap-2">
          <Plus className="size-4" /> New Timesheet
        </button>
      } />

      <div className="p-8 space-y-8">
        <div className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest">My Timesheets ({mine.length})</h3></div>
          {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
            : mine.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No timesheets yet — click "New Timesheet" to start one.</div>
            : (
            <table className="w-full text-sm">
              <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left">Week of</th>
                  <th className="px-4 py-2 text-left">Client</th>
                  <th className="px-4 py-2 text-left">Hours</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Updated</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mine.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2 font-mono text-xs">{t.week_start}</td>
                    <td className="px-4 py-2">{patientName(t.patient_id)}</td>
                    <td className="px-4 py-2 font-mono tabular-nums">{t.hours}</td>
                    <td className="px-4 py-2">
                      <span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + STATUS_COLORS[t.status]}>{t.status}</span>
                      {t.rejection_reason && <div className="text-[10px] text-red-600 mt-1 italic">"{t.rejection_reason}"</div>}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      {(t.status === "draft" || t.status === "rejected") && (
                        <button onClick={() => openEdit(t)} className="text-primary hover:underline text-xs font-mono uppercase">Edit</button>
                      )}
                      {t.status !== "draft" && t.status !== "rejected" && (
                        <button onClick={() => openEdit(t)} className="text-muted-foreground hover:text-foreground text-xs font-mono uppercase inline-flex items-center gap-1"><FileText className="size-3" />View</button>
                      )}
                      <button onClick={() => openHistory(t)} className="text-muted-foreground hover:text-foreground text-xs font-mono uppercase inline-flex items-center gap-1"><History className="size-3" />History</button>
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
                  <tr>
                    <th className="px-4 py-2 text-left">Staff</th>
                    <th className="px-4 py-2 text-left">Client</th>
                    <th className="px-4 py-2 text-left">Week</th>
                    <th className="px-4 py-2 text-left">Hours</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allTs.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2 font-semibold">{staffName(t.staff_id)}</td>
                      <td className="px-4 py-2">{patientName(t.patient_id)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{t.week_start}</td>
                      <td className="px-4 py-2 font-mono tabular-nums">{t.hours}</td>
                      <td className="px-4 py-2"><span className={"px-2 py-0.5 rounded-full text-[10px] font-bold uppercase " + STATUS_COLORS[t.status]}>{t.status}</span></td>
                      <td className="px-4 py-2 text-right space-x-1">
                        <button onClick={() => openEdit(t)} className="text-primary hover:underline text-xs font-mono uppercase">View</button>
                        {t.status === "submitted" && (
                          <>
                            <button onClick={() => approve(t)} className="text-green-700 p-1 hover:bg-green-100 inline-flex" title="Approve"><Check className="size-4" /></button>
                            <button onClick={() => reject(t)} className="text-red-700 p-1 hover:bg-red-100 inline-flex" title="Reject"><X className="size-4" /></button>
                          </>
                        )}
                        <button onClick={() => openHistory(t)} className="text-muted-foreground hover:text-foreground p-1 inline-flex" title="History"><History className="size-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {editor && (
          <TimesheetEditor
            initial={editor}
            patients={patients}
            canApprove={canApprove}
            isOwner={editor.staff_id === user?.id}
            onClose={() => setEditor(null)}
            onSaved={() => { setEditor(null); load(); }}
            onLogEvent={logEvent}
          />
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

// ===================== EDITOR =====================

function TimesheetEditor({
  initial, patients, canApprove, isOwner, onClose, onSaved, onLogEvent,
}: {
  initial: Timesheet;
  patients: Patient[];
  canApprove: boolean;
  isOwner: boolean;
  onClose: () => void;
  onSaved: () => void;
  onLogEvent: (id: string, action: string, notes?: string) => Promise<void>;
}) {
  const [form, setForm] = useState<Timesheet>(initial);
  const [empSig, setEmpSig] = useState<SignatureValue>({ dataUrl: null, typed: form.employee_signature_typed ?? "" });
  const [cliSig, setCliSig] = useState<SignatureValue>({ dataUrl: null, typed: form.client_signature_typed ?? "" });
  const [saving, setSaving] = useState(false);

  const readOnly = !isOwner || (form.status !== "draft" && form.status !== "rejected");

  const totalHours = useMemo(() => {
    return form.days.reduce((s, d) => s + (parseFloat(d.total_hours) || 0), 0);
  }, [form.days]);

  const updateDay = (idx: number, patch: Partial<DayEntry>) => {
    setForm((f) => {
      const days = f.days.map((d, i) => {
        if (i !== idx) return d;
        const next = { ...d, ...patch };
        if ("time_in" in patch || "time_out" in patch || "break_minutes" in patch) {
          next.total_hours = computeHours(next.time_in, next.time_out, next.break_minutes);
        }
        return next;
      });
      return { ...f, days };
    });
  };

  const toggleTask = (task: string, dayIdx: number) => {
    setForm((f) => {
      const row = f.tasks[task] ?? Array(7).fill(false);
      const next = [...row];
      next[dayIdx] = !next[dayIdx];
      return { ...f, tasks: { ...f.tasks, [task]: next } };
    });
  };

  const toggleAvail = (day: string, shift: "7-3" | "3-11" | "11-7") => {
    setForm((f) => {
      const row = f.availability[day] ?? { "7-3": false, "3-11": false, "11-7": false };
      return { ...f, availability: { ...f.availability, [day]: { ...row, [shift]: !row[shift] } } };
    });
  };

  const uploadSig = async (dataUrl: string, label: string) => {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `timesheet/${form.staff_id}/${form.week_start}-${label}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) throw error;
    return path;
  };

  const syncFromVisits = useCallback(async (silent = false) => {
    if (!form.staff_id || !form.patient_id) {
      if (!silent) toast.error("Select a client first");
      return;
    }
    const visits = await fetchVisitsForWeek(form.staff_id, form.patient_id, form.week_start);
    setForm((f) => ({ ...f, days: applyVisitsToDays(f.days, visits) }));
    if (!silent) toast.success(visits.length ? `Pulled ${visits.length} visit${visits.length === 1 ? "" : "s"}` : "No visits found for this week");
  }, [form.staff_id, form.patient_id, form.week_start]);

  // Auto-pull when patient/week changes on an editable draft
  useEffect(() => {
    if (!form.patient_id || form.id) return; // only auto-sync brand-new drafts
    if (form.status !== "draft") return;
    void syncFromVisits(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.patient_id, form.week_start]);

  const save = async (status: "draft" | "submitted") => {
    if (!form.patient_id) return toast.error("Please select a client (patient) for this timesheet");
    setSaving(true);
    try {
      let empUrl = form.employee_signature_url;
      let cliUrl = form.client_signature_url;
      if (empSig.dataUrl) empUrl = await uploadSig(empSig.dataUrl, "employee");
      if (cliSig.dataUrl) cliUrl = await uploadSig(cliSig.dataUrl, "client");

      if (status === "submitted") {
        const empSigned = !!empUrl || !!empSig.typed || !!form.employee_signature_typed;
        const cliSigned = !!cliUrl || !!cliSig.typed || !!form.client_signature_typed;
        if (!empSigned) return toast.error("Employee signature required to submit");
        if (!cliSigned) return toast.error("Client signature required to submit");
      }

      const payload: any = {
        staff_id: form.staff_id,
        patient_id: form.patient_id,
        client_name: form.client_name || null,
        employee_name: form.employee_name || null,
        week_start: form.week_start,
        hours: Math.round(totalHours * 100) / 100,
        notes: form.notes,
        comments: form.comments || null,
        days: form.days,
        tasks: form.tasks,
        availability: form.availability,
        status,
        employee_signature_url: empUrl,
        employee_signature_typed: empSig.typed || form.employee_signature_typed || null,
        client_signature_url: cliUrl,
        client_signature_typed: cliSig.typed || form.client_signature_typed || null,
      };
      if (empUrl || empSig.typed) payload.employee_signed_at = new Date().toISOString();
      if (cliUrl || cliSig.typed) payload.client_signed_at = new Date().toISOString();
      if (status === "submitted") payload.submitted_at = new Date().toISOString();

      let row;
      if (form.id) {
        const { data, error } = await supabase.from("timesheets").update(payload).eq("id", form.id).select().single();
        if (error) throw error;
        row = data;
      } else {
        const { data, error } = await supabase.from("timesheets").insert(payload).select().single();
        if (error) throw error;
        row = data;
      }
      if (row) await onLogEvent(row.id, status === "submitted" ? "submitted" : "saved_draft", `Hours: ${payload.hours}`);
      toast.success(status === "submitted" ? "Timesheet submitted" : "Draft saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 z-50 overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-7xl mx-auto my-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Provider Timesheet · American Care Team</div>
            <h3 className="text-base font-bold">Week of {form.week_start} {form.id && <span className="text-xs font-normal text-muted-foreground ml-2">({form.status})</span>}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Header fields */}
          <FormSection title="Header">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <FieldLabel>Week starting (Sunday)</FieldLabel>
                <TextInput type="date" value={form.week_start} disabled={readOnly}
                  onChange={(e) => {
                    const ws = sundayOf(new Date(e.target.value));
                    setForm((f) => ({ ...f, week_start: ws, days: emptyDays(ws) }));
                  }} />
              </div>
              <div>
                <FieldLabel>Name of Care Giver</FieldLabel>
                <TextInput value={form.employee_name ?? ""} disabled={readOnly} onChange={(e) => setForm((f) => ({ ...f, employee_name: e.target.value }))} placeholder="Employee name" />
              </div>
              <div>
                <FieldLabel>Client</FieldLabel>
                <select disabled={readOnly} value={form.patient_id ?? ""} onChange={(e) => {
                  const p = patients.find((x) => x.id === e.target.value);
                  setForm((f) => ({ ...f, patient_id: e.target.value || null, client_name: p ? `${p.first_name} ${p.last_name}` : f.client_name }));
                }} className="w-full px-3 py-2 border border-border bg-background text-sm">
                  <option value="">Select client…</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </div>
            </div>
          </FormSection>

          {/* Weekly hours grid */}
          <FormSection title="Daily Hours" description="Enter time in/out per day; total hours auto-calculates from time and break.">
            <div className="overflow-x-auto border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Day</th>
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Time In</th>
                    <th className="px-2 py-2 text-left">Time Out</th>
                    <th className="px-2 py-2 text-left">Break (min)</th>
                    <th className="px-2 py-2 text-left">Sleep In</th>
                    <th className="px-2 py-2 text-left">Total Hours</th>
                    <th className="px-2 py-2 text-left">Miles</th>
                    <th className="px-2 py-2 text-left">Client Initial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {form.days.map((d, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1 font-semibold">{DAYS_OF_WEEK[i]}</td>
                      <td className="px-2 py-1 font-mono">{d.date}</td>
                      <td className="px-2 py-1"><input type="time" disabled={readOnly} value={d.time_in} onChange={(e) => updateDay(i, { time_in: e.target.value })} className="w-24 px-1 py-1 border border-border bg-background" /></td>
                      <td className="px-2 py-1"><input type="time" disabled={readOnly} value={d.time_out} onChange={(e) => updateDay(i, { time_out: e.target.value })} className="w-24 px-1 py-1 border border-border bg-background" /></td>
                      <td className="px-2 py-1"><input type="number" min="0" disabled={readOnly} value={d.break_minutes} onChange={(e) => updateDay(i, { break_minutes: e.target.value })} className="w-16 px-1 py-1 border border-border bg-background" /></td>
                      <td className="px-2 py-1 text-center"><input type="checkbox" disabled={readOnly} checked={d.sleep_in} onChange={(e) => updateDay(i, { sleep_in: e.target.checked })} /></td>
                      <td className="px-2 py-1 font-mono tabular-nums">{d.total_hours || "—"}</td>
                      <td className="px-2 py-1"><input type="number" step="0.1" disabled={readOnly} value={d.miles} onChange={(e) => updateDay(i, { miles: e.target.value })} className="w-16 px-1 py-1 border border-border bg-background" /></td>
                      <td className="px-2 py-1"><input maxLength={5} disabled={readOnly} value={d.client_initial} onChange={(e) => updateDay(i, { client_initial: e.target.value.toUpperCase() })} className="w-16 px-1 py-1 border border-border bg-background uppercase" /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50">
                  <tr>
                    <td colSpan={6} className="px-2 py-2 text-right font-bold uppercase text-[10px]">Total # of Hours</td>
                    <td className="px-2 py-2 font-mono tabular-nums font-bold">{totalHours.toFixed(2)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </FormSection>

          {/* Care plan checkbox matrix */}
          <FormSection title="Care Plan — Tasks Performed" description="For each shift, check items you worked on with the client.">
            <div className="space-y-6">
              {TASK_GROUPS.map((group) => (
                <div key={group.title} className="border border-border">
                  <div className="bg-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest">{group.title}</div>
                  <table className="w-full text-xs">
                    <thead className="text-[10px] font-bold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-left w-1/3">Duty</th>
                        {DAY_SHORT.map((d, i) => <th key={i} className="px-2 py-1 text-center w-12">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.tasks.map((task) => {
                        const row = form.tasks[task] ?? Array(7).fill(false);
                        return (
                          <tr key={task}>
                            <td className="px-2 py-1">{task}</td>
                            {row.map((v, i) => (
                              <td key={i} className="px-2 py-1 text-center">
                                <input type="checkbox" disabled={readOnly} checked={!!v} onChange={() => toggleTask(task, i)} />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </FormSection>

          {/* Comments */}
          <FormSection title="Additional Comments / Notes About the Patient">
            <textarea
              disabled={readOnly}
              value={form.comments ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-border bg-background text-sm"
            />
          </FormSection>

          {/* Agreement */}
          <div className="border border-border bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed">
            <div className="font-bold uppercase text-[10px] tracking-widest mb-2 text-foreground">Employee Agreement</div>
            I agree not to accept employment with the Client for the term of employment with American Care Team, LLC and for one (1) year after the termination of my employment with American Care Team, LLC. I declare that I have sustained no injury on this assigned job. By signing this time sheet, I certify that all services have been provided in accordance with the Client's healthcare assessment and I have delivered all service hours shown on the time sheet. In order to be paid, I understand this time sheet must be completed and signed by both me and the client. All completed time sheets must be returned by Mondays at 12:00 PM.
          </div>

          {/* Availability */}
          <FormSection title="Availability for Next Week" description="Check the shifts you are available to work next week.">
            <div className="overflow-x-auto border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 text-left">Day</th>
                    {SHIFTS.map((s) => <th key={s} className="px-2 py-2 text-center">{s}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {AVAILABILITY_DAYS.map((day) => {
                    const row = form.availability[day] ?? { "7-3": false, "3-11": false, "11-7": false };
                    return (
                      <tr key={day}>
                        <td className="px-2 py-1 font-semibold">{day}</td>
                        {SHIFTS.map((s) => (
                          <td key={s} className="px-2 py-1 text-center">
                            <input type="checkbox" disabled={readOnly} checked={!!row[s]} onChange={() => toggleAvail(day, s)} />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </FormSection>

          {/* Signatures */}
          <FormSection title="Signatures" description="Both signatures are required to submit.">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                {form.employee_signature_url || form.employee_signature_typed ? (
                  <div className="border border-border bg-muted/30 p-3">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">Employee signature on file</div>
                    {form.employee_signature_typed && <div className="font-serif italic text-base">{form.employee_signature_typed}</div>}
                    {form.employee_signed_at && <div className="text-[10px] font-mono text-muted-foreground mt-1">{new Date(form.employee_signed_at).toLocaleString()}</div>}
                  </div>
                ) : null}
                {!readOnly && <SignaturePad label="Employee Signature" value={empSig} onChange={setEmpSig} />}
              </div>
              <div className="space-y-2">
                {form.client_signature_url || form.client_signature_typed ? (
                  <div className="border border-border bg-muted/30 p-3">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">Client signature on file</div>
                    {form.client_signature_typed && <div className="font-serif italic text-base">{form.client_signature_typed}</div>}
                    {form.client_signed_at && <div className="text-[10px] font-mono text-muted-foreground mt-1">{new Date(form.client_signed_at).toLocaleString()}</div>}
                  </div>
                ) : null}
                {!readOnly && <SignaturePad label="Client Signature" value={cliSig} onChange={setCliSig} />}
              </div>
            </div>
          </FormSection>

          {/* Footer actions */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="text-xs text-muted-foreground">
              {form.status === "rejected" && form.rejection_reason && <span className="text-red-600 italic">Rejected: "{form.rejection_reason}"</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Close</button>
              {!readOnly && (
                <>
                  <button onClick={() => save("draft")} disabled={saving} className="px-4 py-2 text-sm font-bold border border-border hover:bg-muted disabled:opacity-50">{saving ? "Saving…" : "Save draft"}</button>
                  <button onClick={() => save("submitted")} disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Submit"}</button>
                </>
              )}
              {canApprove && form.id && form.status === "submitted" && (
                <span className="text-[10px] font-mono uppercase text-muted-foreground self-center">Use list actions to approve/reject</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
