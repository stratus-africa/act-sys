import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type AssessmentRow = {
  id: string;
  patient_id: string;
  patient_name?: string;
  date: string;
  status?: string;
  meta?: string;
  link: { to: string; params: Record<string, string> };
};

type Kind = "participant" | "rn" | "skin" | "caregiver";

const TABLE: Record<Kind, { table: string; dateCol: string; routePath: string; label: string }> = {
  participant: { table: "participant_assessments", dateCol: "assessment_date", routePath: "/patients/$patientId/assessment", label: "Participant Assessment" },
  rn:          { table: "rn_assessments",          dateCol: "assessment_date", routePath: "/patients/$patientId/rn-assessment", label: "RN Assessment" },
  skin:        { table: "skin_assessments",        dateCol: "assessment_date", routePath: "/patients/$patientId/skin", label: "Skin Tracking" },
  caregiver:   { table: "caregiver_assessments",   dateCol: "service_date",    routePath: "/patients/$patientId/caregiver-assessment", label: "Caregiver Assessment" },
};

export function AssessmentList({ kind, patientId }: { kind: Kind; patientId?: string }) {
  const meta = TABLE[kind];
  const [rows, setRows] = useState<any[]>([]);
  const [patients, setPatients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [patientFilter, setPatientFilter] = useState<string>(patientId ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase.from(meta.table as any).select("*").order(meta.dateCol, { ascending: false }).limit(300);
      if (patientId) q = q.eq("patient_id", patientId);
      const { data } = await q;
      setRows(data ?? []);
      const ids = Array.from(new Set((data ?? []).map((r: any) => r.patient_id)));
      if (ids.length) {
        const { data: ppl } = await supabase.from("patients").select("id, first_name, last_name").in("id", ids);
        setPatients(Object.fromEntries((ppl ?? []).map((p: any) => [p.id, `${p.last_name}, ${p.first_name}`])));
      }
      setLoading(false);
    })();
  }, [kind, patientId]);

  const filtered = useMemo(() => rows.filter((r: any) => {
    if (patientFilter && r.patient_id !== patientFilter) return false;
    const d = r[meta.dateCol];
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }), [rows, patientFilter, from, to, meta.dateCol]);

  const patientOpts = useMemo(() => Object.entries(patients).sort(([,a],[,b])=>a.localeCompare(b)), [patients]);

  return (
    <div className="space-y-4">
      {!patientId && (
        <div className="flex flex-wrap gap-3 items-end border border-border bg-card p-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Patient</label>
            <select value={patientFilter} onChange={(e) => setPatientFilter(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm min-w-52">
              <option value="">All patients</option>
              {patientOpts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-border bg-background text-sm" />
          </div>
          <button onClick={() => { setPatientFilter(""); setFrom(""); setTo(""); }} className="px-3 py-2 text-xs font-bold uppercase border border-border hover:bg-muted">Clear</button>
          <div className="ml-auto text-[10px] font-mono uppercase text-muted-foreground">{filtered.length} of {rows.length}</div>
        </div>
      )}
      <div className="border border-border bg-card">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No {meta.label.toLowerCase()} records.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-2">Date</th>
                {!patientId && <th className="text-left px-3 py-2">Patient</th>}
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => {
                const status = r.status ?? r.risk_level ?? "—";
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{r[meta.dateCol]}</td>
                    {!patientId && <td className="px-3 py-3 font-bold">{patients[r.patient_id] ?? r.patient_id.slice(0, 8)}</td>}
                    <td className="px-3 py-3 capitalize">{String(status).replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={meta.routePath as any} params={{ patientId: r.patient_id }} className="text-xs font-bold uppercase text-primary hover:underline">Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function AssessmentTypeLabel({ kind }: { kind: Kind }) {
  return <span>{TABLE[kind].label}</span>;
}