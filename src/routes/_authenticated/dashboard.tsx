import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { useCurrentUser } from "@/lib/use-current-user";
import { supabase } from "@/integrations/supabase/client";
import { Users, CalendarDays, ClipboardList, AlertTriangle, ShieldAlert, Activity, FileWarning, UserCog, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

type Stats = {
  patients: number;
  visitsToday: number;
  visitsWeek: number;
  pendingConsents: number;
  fallRiskHigh: number;
  criticalAllergies: number;
  abnormalSkin: number;
  pendingTimesheets: number;
};

type RecentVisit = { id: string; scheduled_date: string; scheduled_time: string | null; status: string; visit_type: string; patient: { first_name: string; last_name: string } | null };
type AlertKind = "fall" | "allergy" | "skin" | "consent";
type AlertItem = { id: string; recordId: string; kind: AlertKind; label: string; patient_id: string; patientName: string; meta?: string };

const KIND_LABEL: Record<AlertKind | "all", string> = { all: "All", fall: "Fall risk", allergy: "Allergy", skin: "Skin", consent: "Consent" };
const KIND_ROUTE: Record<AlertKind, "/patients/$patientId/fall-risk" | "/patients/$patientId/allergies" | "/patients/$patientId/skin" | "/patients/$patientId/consent"> = {
  fall: "/patients/$patientId/fall-risk",
  allergy: "/patients/$patientId/allergies",
  skin: "/patients/$patientId/skin",
  consent: "/patients/$patientId/consent",
};

const today = () => new Date().toISOString().slice(0, 10);
const weekStartIso = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
};

function Dashboard() {
  const { primaryRole, user, hasRole } = useCurrentUser();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<AlertKind | "all">("all");
  const [states, setStates] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_alert_states").select("alert_key, status");
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.alert_key] = r.status; });
      setStates(map);
    })();
  }, []);

  const setAlertState = async (a: AlertItem, status: "acknowledged" | "dismissed" | "resolved") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_alert_states").upsert({ user_id: user.id, alert_key: a.id, status });
    setStates((s) => ({ ...s, [a.id]: status }));
  };

  useEffect(() => {
    let active = true;
    (async () => {
      const t = today();
      const ws = weekStartIso();
      const [patients, visitsToday, visitsWeek, consents, falls, allergies, skin, timesheets, recent] = await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("visits").select("id", { count: "exact", head: true }).eq("scheduled_date", t),
        supabase.from("visits").select("id", { count: "exact", head: true }).gte("scheduled_date", ws),
        supabase.from("patient_consents").select("id, patient_id, status").neq("status", "complete"),
        supabase.from("fall_risk_assessments").select("id, patient_id, total_score, risk_level, assessment_date").order("assessment_date", { ascending: false }),
        supabase.from("patient_allergies").select("id, patient_id, allergen, severity").eq("active", true).in("severity", ["severe", "anaphylaxis"]),
        supabase.from("skin_assessments").select("id, patient_id, status, assessment_date").eq("status", "abnormal").order("assessment_date", { ascending: false }),
        supabase.from("timesheets").select("id", { count: "exact", head: true }).eq("status", "submitted"),
        supabase.from("visits").select("id, scheduled_date, scheduled_time, status, visit_type, patient_id").gte("scheduled_date", t).order("scheduled_date").order("scheduled_time").limit(8),
      ]);

      if (!active) return;

      // Dedupe fall risk: keep latest per patient
      const seenFall = new Set<string>();
      const latestFalls = (falls.data ?? []).filter((f: any) => {
        if (seenFall.has(f.patient_id)) return false;
        seenFall.add(f.patient_id); return true;
      });
      const seenSkin = new Set<string>();
      const latestSkin = (skin.data ?? []).filter((s: any) => {
        if (seenSkin.has(s.patient_id)) return false;
        seenSkin.add(s.patient_id); return true;
      });
      const fallRiskHigh = latestFalls.filter((f: any) => f.risk_level === "at_risk" || f.total_score >= 4);

      setStats({
        patients: patients.count ?? 0,
        visitsToday: visitsToday.count ?? 0,
        visitsWeek: visitsWeek.count ?? 0,
        pendingConsents: consents.data?.length ?? 0,
        fallRiskHigh: fallRiskHigh.length,
        criticalAllergies: allergies.data?.length ?? 0,
        abnormalSkin: latestSkin.length,
        pendingTimesheets: timesheets.count ?? 0,
      });

      // Fetch patient names for recent visits & alerts
      const patientIds = new Set<string>();
      (recent.data ?? []).forEach((v: any) => patientIds.add(v.patient_id));
      fallRiskHigh.forEach((f: any) => patientIds.add(f.patient_id));
      (allergies.data ?? []).forEach((a: any) => patientIds.add(a.patient_id));
      latestSkin.forEach((s: any) => patientIds.add(s.patient_id));
      (consents.data ?? []).forEach((c: any) => patientIds.add(c.patient_id));

      let nameMap: Record<string, string> = {};
      if (patientIds.size > 0) {
        const { data: ppl } = await supabase.from("patients").select("id, first_name, last_name").in("id", Array.from(patientIds));
        nameMap = Object.fromEntries((ppl ?? []).map((p: any) => [p.id, `${p.last_name}, ${p.first_name}`]));
      }

      setRecentVisits((recent.data ?? []).map((v: any) => ({
        ...v,
        patient: nameMap[v.patient_id] ? { first_name: "", last_name: nameMap[v.patient_id] } : null,
      })));

      const items: AlertItem[] = [];
      fallRiskHigh.slice(0, 5).forEach((f: any) => items.push({ id: `f-${f.id}`, recordId: f.id, kind: "fall", label: "Fall risk", patient_id: f.patient_id, patientName: nameMap[f.patient_id] ?? "Patient", meta: `Score ${f.total_score}` }));
      (allergies.data ?? []).slice(0, 5).forEach((a: any) => items.push({ id: `a-${a.id}`, recordId: a.id, kind: "allergy", label: "Critical allergy", patient_id: a.patient_id, patientName: nameMap[a.patient_id] ?? "Patient", meta: `${a.allergen} · ${a.severity}` }));
      latestSkin.slice(0, 5).forEach((s: any) => items.push({ id: `s-${s.id}`, recordId: s.id, kind: "skin", label: "Abnormal skin", patient_id: s.patient_id, patientName: nameMap[s.patient_id] ?? "Patient", meta: s.assessment_date }));
      (consents.data ?? []).slice(0, 5).forEach((c: any) => items.push({ id: `c-${c.id}`, recordId: c.id, kind: "consent", label: "Consent pending", patient_id: c.patient_id, patientName: nameMap[c.patient_id] ?? "Patient", meta: c.status }));
      setAlerts(items);
    })();
    return () => { active = false; };
  }, []);

  const resolveAlert = async (a: AlertItem) => {
    if (a.kind === "skin") {
      const { error } = await supabase.from("skin_assessments").update({ status: "normal" }).eq("id", a.recordId);
      if (error) { toast.error(error.message); return; }
      toast.success("Skin assessment marked normal");
      setAlerts((cur) => cur.filter((x) => x.id !== a.id));
      return;
    }
    if (a.kind === "allergy") {
      const { error } = await supabase.from("patient_allergies").update({ active: false }).eq("id", a.recordId);
      if (error) { toast.error(error.message); return; }
      toast.success("Allergy resolved");
      setAlerts((cur) => cur.filter((x) => x.id !== a.id));
      return;
    }
    if (a.kind === "consent") {
      const { error } = await supabase.from("patient_consents").update({ status: "complete" }).eq("id", a.recordId);
      if (error) { toast.error(error.message); return; }
      toast.success("Consent marked complete");
      setAlerts((cur) => cur.filter((x) => x.id !== a.id));
      return;
    }
    // fall risk: just dismiss from view (clinical data preserved)
    await setAlertState(a, "acknowledged");
    toast.success("Acknowledged");
  };

  const visibleAlerts = alerts
    .filter((a) => states[a.id] !== "dismissed" && states[a.id] !== "resolved" && states[a.id] !== "acknowledged")
    .filter((a) => filter === "all" || a.kind === filter);
  const counts: Record<string, number> = { all: alerts.length };
  alerts.forEach((a) => { counts[a.kind] = (counts[a.kind] ?? 0) + 1; });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title={`${greeting}${user?.email ? `, ${user.email.split("@")[0]}` : ""}`}
        description={primaryRole ? `${primaryRole.toUpperCase()} workspace · ${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}` : ""}
      />
      <div className="p-8 max-w-7xl space-y-8 animate-entrance">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Active Patients" value={stats?.patients} to="/patients" />
          <StatCard icon={CalendarDays} label="Visits Today" value={stats?.visitsToday} to="/visits" />
          <StatCard icon={Activity} label="Visits This Week" value={stats?.visitsWeek} to="/visits" />
          <StatCard icon={ClipboardList} label="Timesheets Pending" value={stats?.pendingTimesheets} to="/timesheets" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AlertCard icon={ShieldAlert} label="Fall Risk" value={stats?.fallRiskHigh} tone={(stats?.fallRiskHigh ?? 0) > 0 ? "red" : "neutral"} />
          <AlertCard icon={AlertTriangle} label="Critical Allergies" value={stats?.criticalAllergies} tone={(stats?.criticalAllergies ?? 0) > 0 ? "red" : "neutral"} />
          <AlertCard icon={Activity} label="Abnormal Skin" value={stats?.abnormalSkin} tone={(stats?.abnormalSkin ?? 0) > 0 ? "amber" : "neutral"} />
          <AlertCard icon={FileWarning} label="Consents Pending" value={stats?.pendingConsents} tone={(stats?.pendingConsents ?? 0) > 0 ? "amber" : "neutral"} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest">Upcoming Visits</h3>
              <Link to="/visits" className="text-[10px] font-mono uppercase tracking-widest text-primary hover:underline flex items-center gap-1">All <ArrowRight className="size-3" /></Link>
            </div>
            {recentVisits.length === 0 ? (
              <div className="px-6 py-8 text-sm text-muted-foreground">No upcoming visits.</div>
            ) : (
              <ul className="divide-y divide-border">
                {recentVisits.map((v) => (
                  <li key={v.id} className="px-6 py-3 flex items-center gap-4 hover:bg-muted/30">
                    <div className="text-center w-14 shrink-0">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">{new Date(v.scheduled_date).toLocaleDateString(undefined, { month: "short" })}</div>
                      <div className="text-lg font-extrabold leading-none">{new Date(v.scheduled_date).getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{v.patient?.last_name ?? "—"}</div>
                      <div className="text-[11px] font-mono uppercase text-muted-foreground">{v.scheduled_time ?? "—"} · {v.visit_type}</div>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-1 bg-muted">{v.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-border bg-card">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest">Clinical Alerts</h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{visibleAlerts.length}/{alerts.length}</span>
            </div>
            <div className="px-6 py-2 border-b border-border flex flex-wrap gap-1">
              {(["all", "fall", "allergy", "skin", "consent"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={"text-[10px] font-mono uppercase tracking-widest px-2 py-1 border " + (filter === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  {KIND_LABEL[k]} {counts[k] ? `(${counts[k]})` : ""}
                </button>
              ))}
            </div>
            {visibleAlerts.length === 0 ? (
              <div className="px-6 py-8 text-sm text-muted-foreground">No active alerts. 🎉</div>
            ) : (
              <ul className="divide-y divide-border">
                {visibleAlerts.slice(0, 10).map((a) => (
                  <li key={a.id} className="px-6 py-3 flex items-center gap-3 hover:bg-muted/30">
                    <span className={"size-2 rounded-full shrink-0 " + (a.kind === "fall" || a.kind === "allergy" ? "bg-destructive" : "bg-amber-500")} />
                    <div className="flex-1 min-w-0">
                      <Link to="/patients/$patientId" params={{ patientId: a.patient_id }} className="text-sm font-bold truncate hover:underline block">{a.patientName}</Link>
                      <div className="text-[11px] font-mono uppercase text-muted-foreground truncate">{a.label}{a.meta ? ` · ${a.meta}` : ""}</div>
                    </div>
                    {hasRole("admin") || hasRole("rn") ? (
                      <button
                        onClick={() => resolveAlert(a)}
                        title={a.kind === "fall" ? "Acknowledge" : "Resolve"}
                        className="text-[10px] font-mono uppercase tracking-widest px-2 py-1 border border-border text-muted-foreground hover:text-primary hover:border-primary inline-flex items-center gap-1"
                      >
                        <Check className="size-3" /> {a.kind === "fall" ? "Ack" : "Resolve"}
                      </button>
                    ) : null}
                    <Link to={KIND_ROUTE[a.kind]} params={{ patientId: a.patient_id }} className="text-[10px] font-mono uppercase tracking-widest text-primary hover:underline inline-flex items-center gap-1">
                      Open <ArrowRight className="size-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {(hasRole("admin") || hasRole("rn")) && <HrPipelineWidget />}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickLink to="/patients" icon={Users} label="Patients" />
          <QuickLink to="/visits" icon={CalendarDays} label="Visits" />
          <QuickLink to="/timesheets" icon={ClipboardList} label="Timesheets" />
          {hasRole("admin") ? <QuickLink to="/staff" icon={UserCog} label="Staff" /> : <QuickLink to="/settings" icon={UserCog} label="Settings" />}
        </div>
      </div>
    </>
  );
}

function StatCard({ icon: Icon, label, value, to }: { icon: any; label: string; value: number | undefined; to: string }) {
  return (
    <Link to={to} className="border border-border bg-card p-5 hover:border-primary transition-colors block">
      <div className="flex justify-between items-start">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="text-3xl font-extrabold mt-3 tabular-nums">{value ?? "—"}</div>
    </Link>
  );
}

function AlertCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | undefined; tone: "red" | "amber" | "neutral" }) {
  const toneCls = tone === "red" ? "border-destructive/40 bg-destructive/5" : tone === "amber" ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card";
  const iconCls = tone === "red" ? "text-destructive" : tone === "amber" ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className={"border p-5 " + toneCls}>
      <div className="flex justify-between items-start">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
        <Icon className={"size-4 " + iconCls} strokeWidth={1.5} />
      </div>
      <div className="text-3xl font-extrabold mt-3 tabular-nums">{value ?? "—"}</div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="border border-border bg-card p-4 hover:border-primary hover:bg-muted/30 transition-colors flex items-center gap-3">
      <Icon className="size-5 text-primary" strokeWidth={1.5} />
      <span className="text-sm font-bold">{label}</span>
    </Link>
  );
}
