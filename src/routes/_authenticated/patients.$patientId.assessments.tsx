import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/patients/$patientId/assessments")({ component: PatientAssessments });

type Kind = "participant" | "rn" | "skin" | "caregiver";
const META: Record<Kind, { table: string; date: string; route: string; label: string }> = {
  participant: { table: "participant_assessments", date: "assessment_date", route: "/patients/$patientId/assessment", label: "Participant" },
  rn:          { table: "rn_assessments",          date: "assessment_date", route: "/patients/$patientId/rn-assessment", label: "RN" },
  skin:        { table: "skin_assessments",        date: "assessment_date", route: "/patients/$patientId/skin", label: "Skin" },
  caregiver:   { table: "caregiver_assessments",   date: "service_date",    route: "/patients/$patientId/caregiver-assessment", label: "Caregiver" },
};
const KINDS: Kind[] = ["participant", "rn", "skin", "caregiver"];

function PatientAssessments() {
  const { patientId } = Route.useParams();
  const [rows, setRows] = useState<Array<{ id: string; kind: Kind; date: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<Kind | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const results = await Promise.all(KINDS.map(async (k) => {
        const m = META[k];
        const { data } = await supabase.from(m.table as any).select(`id, ${m.date}, status, risk_level`).eq("patient_id", patientId).order(m.date, { ascending: false });
        return (data ?? []).map((r: any) => ({ id: r.id, kind: k, date: r[m.date], status: r.status ?? r.risk_level ?? "—" }));
      }));
      setRows(results.flat().sort((a, b) => (a.date < b.date ? 1 : -1)));
      setLoading(false);
    })();
  }, [patientId]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (typeFilter !== "all" && r.kind !== typeFilter) return false;
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  }), [rows, typeFilter, from, to]);

  return (
    <div className="space-y-6 animate-entrance">
      <div className="flex flex-wrap gap-3 items-end border border-border bg-card p-4">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="px-3 py-2 border border-border bg-background text-sm">
            <option value="all">All types</option>
            {KINDS.map((k) => <option key={k} value={k}>{META[k].label}</option>)}
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
        <button onClick={() => { setTypeFilter("all"); setFrom(""); setTo(""); }} className="px-3 py-2 text-xs font-bold uppercase border border-border hover:bg-muted">Clear</button>
        <div className="ml-auto text-[10px] font-mono uppercase text-muted-foreground">{filtered.length} of {rows.length}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KINDS.map((k) => (
          <Link key={k} to={META[k].route as any} params={{ patientId } as any} className="border border-border bg-card p-4 hover:border-primary transition-colors">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{META[k].label}</div>
            <div className="text-2xl font-extrabold mt-1">+ New</div>
            <div className="text-[10px] text-muted-foreground mt-1">Open form</div>
          </Link>
        ))}
      </div>

      <div className="border border-border bg-card">
        <div className="px-4 py-3 border-b border-border text-xs font-bold uppercase tracking-widest">History</div>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No assessments on file.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.kind + r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{r.date}</td>
                  <td className="px-3 py-3">{META[r.kind].label}</td>
                  <td className="px-3 py-3 capitalize">{String(r.status).replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={META[r.kind].route as any} params={{ patientId } as any} className="text-xs font-bold uppercase text-primary hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}