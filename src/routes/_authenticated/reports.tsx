import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";

export const Route = createFileRoute("/_authenticated/reports")({ component: Reports });

type Stats = {
  patientsActive: number;
  patientsTotal: number;
  atRisk: number;
  visits30: { scheduled: number; completed: number; missed: number; in_progress: number };
  signedDocs: number;
  pendingDocs: number;
  consentsSigned: number;
  consentsPending: number;
  hoursThisMonth: number;
};

function Reports() {
  const { primaryRole } = useCurrentUser();
  const allowed = primaryRole === "admin" || primaryRole === "rn";
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    (async () => {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const monthStart = new Date(); monthStart.setDate(1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);

      const [patients, falls, visits, docs, consents, sheets] = await Promise.all([
        supabase.from("patients").select("status"),
        supabase.from("fall_risk_assessments").select("patient_id,risk_level,assessment_date").order("assessment_date", { ascending: false }),
        supabase.from("visits").select("status").gte("scheduled_date", since30),
        supabase.from("patient_documents").select("locked,required_signers"),
        supabase.from("patient_consents").select("status"),
        supabase.from("timesheets").select("hours,status,week_start").gte("week_start", monthStartStr),
      ]);

      // Latest assessment per patient
      const latestByPatient = new Map<string, string>();
      for (const f of (falls.data ?? []) as any[]) {
        if (!latestByPatient.has(f.patient_id)) latestByPatient.set(f.patient_id, f.risk_level);
      }
      const atRisk = Array.from(latestByPatient.values()).filter((r) => r === "at_risk").length;

      const visitsArr = (visits.data ?? []) as any[];
      const v30 = {
        scheduled: visitsArr.filter((v) => v.status === "scheduled").length,
        completed: visitsArr.filter((v) => v.status === "completed").length,
        missed: visitsArr.filter((v) => v.status === "missed").length,
        in_progress: visitsArr.filter((v) => v.status === "in_progress").length,
      };

      const docsArr = (docs.data ?? []) as any[];
      const signedDocs = docsArr.filter((d) => d.locked).length;
      const pendingDocs = docsArr.filter((d) => !d.locked && (d.required_signers?.length ?? 0) > 0).length;

      const consentsArr = (consents.data ?? []) as any[];
      const consentsSigned = consentsArr.filter((c) => c.status === "signed").length;
      const consentsPending = consentsArr.filter((c) => c.status !== "signed").length;

      const sheetsArr = (sheets.data ?? []) as any[];
      const hoursThisMonth = sheetsArr.filter((s) => s.status === "approved").reduce((n, s) => n + Number(s.hours ?? 0), 0);

      const patientsArr = (patients.data ?? []) as any[];

      setStats({
        patientsActive: patientsArr.filter((p) => p.status === "active").length,
        patientsTotal: patientsArr.length,
        atRisk,
        visits30: v30,
        signedDocs, pendingDocs,
        consentsSigned, consentsPending,
        hoursThisMonth,
      });
      setLoading(false);
    })();
  }, [allowed]);

  if (!allowed) return (<><PageHeader eyebrow="Reports" title="Reports & Analytics" /><div className="p-8 text-sm text-muted-foreground">Admin or RN access required.</div></>);

  return (
    <>
      <PageHeader eyebrow="Reports" title="Reports & Analytics" description="Operational and clinical KPIs." />
      <div className="p-8 space-y-8">
        {loading || !stats ? <div className="text-xs text-muted-foreground text-center p-8">Loading…</div> : (
          <>
            <Section title="Census">
              <Kpi label="Active patients" value={stats.patientsActive} sub={`${stats.patientsTotal} total`} />
              <Kpi label="At-risk for falls" value={stats.atRisk} variant={stats.atRisk > 0 ? "warn" : "ok"} />
            </Section>

            <Section title="Visits (last 30 days)">
              <Kpi label="Completed" value={stats.visits30.completed} variant="ok" />
              <Kpi label="Scheduled" value={stats.visits30.scheduled} />
              <Kpi label="In progress" value={stats.visits30.in_progress} />
              <Kpi label="Missed" value={stats.visits30.missed} variant={stats.visits30.missed > 0 ? "warn" : "ok"} />
            </Section>

            <Section title="Documents & Consents">
              <Kpi label="Fully signed docs" value={stats.signedDocs} variant="ok" />
              <Kpi label="Pending signatures" value={stats.pendingDocs} variant={stats.pendingDocs > 0 ? "warn" : "ok"} />
              <Kpi label="Consents signed" value={stats.consentsSigned} variant="ok" />
              <Kpi label="Consents pending" value={stats.consentsPending} variant={stats.consentsPending > 0 ? "warn" : "ok"} />
            </Section>

            <Section title="Staffing">
              <Kpi label="Approved hours this month" value={stats.hoursThisMonth.toFixed(1)} />
            </Section>
          </>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 font-mono">{title}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub, variant }: { label: string; value: number | string; sub?: string; variant?: "ok" | "warn" }) {
  const accent = variant === "warn" ? "text-alert-red" : variant === "ok" ? "text-primary" : "text-foreground";
  return (
    <div className="border border-border bg-card p-5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">{label}</div>
      <div className={"text-3xl font-extrabold font-mono mt-2 tabular-nums " + accent}>{value}</div>
      {sub && <div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
