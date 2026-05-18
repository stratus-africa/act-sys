import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/assessments")({ component: PatientAssessments });

type Kind = "participant" | "rn" | "skin" | "caregiver";
const META: Record<Kind, { table: string; date: string; route: string; label: string }> = {
  participant: { table: "participant_assessments", date: "assessment_date", route: "/patients/$patientId/assessment", label: "Participant" },
  rn:          { table: "rn_assessments",          date: "assessment_date", route: "/patients/$patientId/rn-assessment", label: "RN" },
  skin:        { table: "skin_assessments",        date: "assessment_date", route: "/patients/$patientId/skin", label: "Skin" },
  caregiver:   { table: "caregiver_assessments",   date: "service_date",    route: "/patients/$patientId/caregiver-assessment", label: "Caregiver" },
};
const HISTORY_KINDS: Kind[] = ["participant", "rn", "skin", "caregiver"];
// Quick-create options exclude Caregiver per request
const NEW_KINDS: Kind[] = ["participant", "rn", "skin"];

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
      const results = await Promise.all(HISTORY_KINDS.map(async (k) => {
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
            {HISTORY_KINDS.map((k) => <option key={k} value={k}>{META[k].label}</option>)}
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
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] font-mono uppercase text-muted-foreground">{filtered.length} of {rows.length}</span>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="size-3.5" /> New Assessment <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {NEW_KINDS.map((k) => (
                <DropdownMenuItem key={k} asChild>
                  <Link to={META[k].route as any} params={{ patientId } as any} className="cursor-pointer">
                    <span className="text-xs font-bold uppercase tracking-wider">{META[k].label} Assessment</span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
