import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FieldLabel } from "@/components/app/FormSection";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({ component: Reports });

type Stats = {
  patientsActive: number;
  patientsTotal: number;
  atRisk: number;
  visits: { scheduled: number; completed: number; missed: number; in_progress: number };
  signedDocs: number;
  pendingDocs: number;
  consentsSigned: number;
  consentsPending: number;
  approvedHours: number;
};

function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function Reports() {
  const { primaryRole } = useCurrentUser();
  const allowed = primaryRole === "admin" || primaryRole === "rn";

  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    setLoading(true);

    const visitsQ = supabase.from("visits").select("status,scheduled_date").gte("scheduled_date", from).lte("scheduled_date", to);
    const sheetsQ = supabase.from("timesheets").select("hours,status,week_start").gte("week_start", from).lte("week_start", to);
    const patientsQ = statusFilter === "all"
      ? supabase.from("patients").select("status")
      : supabase.from("patients").select("status").eq("status", statusFilter);

    const [patients, falls, visits, docs, consents, sheets] = await Promise.all([
      patientsQ,
      supabase.from("fall_risk_assessments").select("patient_id,risk_level,assessment_date").order("assessment_date", { ascending: false }),
      visitsQ,
      supabase.from("patient_documents").select("locked,required_signers"),
      supabase.from("patient_consents").select("status"),
      sheetsQ,
    ]);

    const latestByPatient = new Map<string, string>();
    for (const f of (falls.data ?? []) as any[]) {
      if (!latestByPatient.has(f.patient_id)) latestByPatient.set(f.patient_id, f.risk_level);
    }
    const atRisk = Array.from(latestByPatient.values()).filter((r) => r === "at_risk").length;

    const visitsArr = (visits.data ?? []) as any[];
    const docsArr = (docs.data ?? []) as any[];
    const consentsArr = (consents.data ?? []) as any[];
    const sheetsArr = (sheets.data ?? []) as any[];
    const patientsArr = (patients.data ?? []) as any[];

    setStats({
      patientsActive: patientsArr.filter((p) => p.status === "active").length,
      patientsTotal: patientsArr.length,
      atRisk,
      visits: {
        scheduled: visitsArr.filter((v) => v.status === "scheduled").length,
        completed: visitsArr.filter((v) => v.status === "completed").length,
        missed: visitsArr.filter((v) => v.status === "missed").length,
        in_progress: visitsArr.filter((v) => v.status === "in_progress").length,
      },
      signedDocs: docsArr.filter((d) => d.locked).length,
      pendingDocs: docsArr.filter((d) => !d.locked && (d.required_signers?.length ?? 0) > 0).length,
      consentsSigned: consentsArr.filter((c) => c.status === "signed").length,
      consentsPending: consentsArr.filter((c) => c.status !== "signed").length,
      approvedHours: sheetsArr.filter((s) => s.status === "approved").reduce((n, s) => n + Number(s.hours ?? 0), 0),
    });
    setLoading(false);
  }, [allowed, from, to, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!stats) return;
    const rows: Array<[string, string | number]> = [
      ["Report period", `${from} to ${to}`],
      ["Patient status filter", statusFilter],
      ["", ""],
      ["Active patients", stats.patientsActive],
      ["Total patients", stats.patientsTotal],
      ["At-risk for falls", stats.atRisk],
      ["Visits completed", stats.visits.completed],
      ["Visits scheduled", stats.visits.scheduled],
      ["Visits in progress", stats.visits.in_progress],
      ["Visits missed", stats.visits.missed],
      ["Fully signed documents", stats.signedDocs],
      ["Documents pending signature", stats.pendingDocs],
      ["Consents signed", stats.consentsSigned],
      ["Consents pending", stats.consentsPending],
      ["Approved hours (period)", stats.approvedHours.toFixed(2)],
    ];
    const csv = rows.map(([k, v]) => `"${String(k).replace(/"/g, '""')}","${String(v).replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `kpi-report-${from}_to_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const exportPdf = () => {
    // Use the browser's print-to-PDF: open a clean window with the report content
    if (!stats) return;
    const w = window.open("", "_blank", "width=900,height=1100");
    if (!w) return toast.error("Pop-up blocked");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>KPI Report ${from} - ${to}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:40px;color:#111;}
  h1{margin:0 0 4px;font-size:22px}
  h2{font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:#666;margin:28px 0 8px}
  .meta{color:#666;font-size:12px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  td{padding:8px 10px;border-bottom:1px solid #eee}
  td.k{color:#666;width:60%}
  td.v{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:8px 0 20px}
  .kpi{border:1px solid #ddd;padding:14px;border-radius:6px}
  .kpi .l{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#666}
  .kpi .n{font-size:28px;font-weight:800;margin-top:6px}
</style></head><body>
<h1>KPI Report</h1>
<div class="meta">Period: <strong>${from}</strong> to <strong>${to}</strong> · Patient status: <strong>${statusFilter}</strong> · Generated ${new Date().toLocaleString()}</div>
<h2>Census</h2>
<div class="grid">
  <div class="kpi"><div class="l">Active</div><div class="n">${stats.patientsActive}</div></div>
  <div class="kpi"><div class="l">Total patients</div><div class="n">${stats.patientsTotal}</div></div>
  <div class="kpi"><div class="l">At-risk (falls)</div><div class="n">${stats.atRisk}</div></div>
</div>
<h2>Visits (period)</h2>
<div class="grid">
  <div class="kpi"><div class="l">Completed</div><div class="n">${stats.visits.completed}</div></div>
  <div class="kpi"><div class="l">Scheduled</div><div class="n">${stats.visits.scheduled}</div></div>
  <div class="kpi"><div class="l">In progress</div><div class="n">${stats.visits.in_progress}</div></div>
  <div class="kpi"><div class="l">Missed</div><div class="n">${stats.visits.missed}</div></div>
</div>
<h2>Documents &amp; Consents</h2>
<div class="grid">
  <div class="kpi"><div class="l">Signed docs</div><div class="n">${stats.signedDocs}</div></div>
  <div class="kpi"><div class="l">Pending docs</div><div class="n">${stats.pendingDocs}</div></div>
  <div class="kpi"><div class="l">Consents signed</div><div class="n">${stats.consentsSigned}</div></div>
  <div class="kpi"><div class="l">Consents pending</div><div class="n">${stats.consentsPending}</div></div>
</div>
<h2>Staffing</h2>
<table><tr><td class="k">Approved hours in period</td><td class="v">${stats.approvedHours.toFixed(2)}</td></tr></table>
<script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body></html>`;
    w.document.open(); w.document.write(html); w.document.close();
  };

  if (!allowed) return (<><PageHeader eyebrow="Reports" title="Reports & Analytics" /><div className="p-8 text-sm text-muted-foreground">Admin or RN access required.</div></>);

  return (
    <>
      <PageHeader eyebrow="Reports" title="Reports & Analytics" description="Operational and clinical KPIs with selectable date range." />
      <div className="p-8 space-y-6">
        <div className="border border-border bg-card p-4 flex flex-wrap gap-4 items-end justify-between">
          <div className="flex flex-wrap gap-4 items-end">
            <div><FieldLabel>From</FieldLabel><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm" /></div>
            <div><FieldLabel>To</FieldLabel><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm" /></div>
            <div><FieldLabel>Patient status</FieldLabel>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm">
                <option value="all">All</option><option value="active">Active</option><option value="discharged">Discharged</option><option value="on_hold">On hold</option>
              </select>
            </div>
            <div className="flex gap-2">
              {[7, 30, 90].map((d) => (
                <button key={d} onClick={() => { setFrom(isoDaysAgo(d)); setTo(new Date().toISOString().slice(0, 10)); }} className="px-3 py-2 text-xs font-mono uppercase border border-border hover:bg-muted">Last {d}d</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={!stats} className="bg-card border border-border px-4 py-2 text-xs font-bold uppercase flex items-center gap-2 hover:bg-muted disabled:opacity-50"><Download className="size-4" />CSV</button>
            <button onClick={exportPdf} disabled={!stats} className="bg-primary text-primary-foreground px-4 py-2 text-xs font-bold uppercase flex items-center gap-2 disabled:opacity-50"><Printer className="size-4" />PDF</button>
          </div>
        </div>

        {loading || !stats ? <div className="text-xs text-muted-foreground text-center p-8">Loading…</div> : (
          <>
            <Section title="Census">
              <Kpi label="Active patients" value={stats.patientsActive} sub={`${stats.patientsTotal} total`} />
              <Kpi label="At-risk for falls" value={stats.atRisk} variant={stats.atRisk > 0 ? "warn" : "ok"} />
            </Section>

            <Section title="Visits (period)">
              <Kpi label="Completed" value={stats.visits.completed} variant="ok" />
              <Kpi label="Scheduled" value={stats.visits.scheduled} />
              <Kpi label="In progress" value={stats.visits.in_progress} />
              <Kpi label="Missed" value={stats.visits.missed} variant={stats.visits.missed > 0 ? "warn" : "ok"} />
            </Section>

            <Section title="Documents & Consents">
              <Kpi label="Fully signed docs" value={stats.signedDocs} variant="ok" />
              <Kpi label="Pending signatures" value={stats.pendingDocs} variant={stats.pendingDocs > 0 ? "warn" : "ok"} />
              <Kpi label="Consents signed" value={stats.consentsSigned} variant="ok" />
              <Kpi label="Consents pending" value={stats.consentsPending} variant={stats.consentsPending > 0 ? "warn" : "ok"} />
            </Section>

            <Section title="Staffing">
              <Kpi label="Approved hours (period)" value={stats.approvedHours.toFixed(1)} />
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
