import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/")({ component: PatientsList });

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  mrn: string | null;
  status: string;
  start_of_care: string | null;
  fall_risk_assessments: { total_score: number; risk_level: string; assessment_date: string }[];
};

function PatientsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");

  useEffect(() => {
    supabase.from("patients").select("id, first_name, last_name, mrn, status, start_of_care, fall_risk_assessments(total_score, risk_level, assessment_date)")
      .order("last_name", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        setRows((data ?? []) as unknown as Row[]);
        setLoading(false);
      });
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data, error } = await supabase.from("patients").insert({ first_name: first, last_name: last }).select("id").single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Patient created");
    navigate({ to: "/patients/$patientId", params: { patientId: data.id } });
  };

  return (
    <>
      <PageHeader eyebrow="Registry" title="Patient Registry" description="Active caseload" />
      <div className="p-8 max-w-7xl space-y-8 animate-entrance">
        <form onSubmit={create} className="border border-border bg-card p-4 flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">First name</label>
            <input required value={first} onChange={(e) => setFirst(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Last name</label>
            <input required value={last} onChange={(e) => setLast(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm" />
          </div>
          <button disabled={creating} type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold">+ New Patient</button>
        </form>

        <div className="border border-border bg-card shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-muted border-b border-border text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">MRN</th>
                <th className="px-4 py-3">Fall Risk</th>
                <th className="px-4 py-3">Start of Care</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border">
              {loading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-xs">No patients yet. Create one above.</td></tr>}
              {rows.map((r) => {
                const latestFall = r.fall_risk_assessments?.sort((a, b) => b.assessment_date.localeCompare(a.assessment_date))[0];
                const atRisk = latestFall?.risk_level === "at_risk" || (latestFall?.total_score ?? 0) >= 4;
                return (
                  <tr key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => navigate({ to: "/patients/$patientId", params: { patientId: r.id } })}>
                    <td className="px-4 py-4 font-semibold">{r.last_name}, {r.first_name}</td>
                    <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{r.mrn ?? "—"}</td>
                    <td className="px-4 py-4">
                      {atRisk ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-alert-red font-bold">
                          <span className="size-2 rounded-full bg-alert-red" />FALL RISK ({latestFall?.total_score})
                        </span>
                      ) : (
                        <span className="text-muted-foreground font-mono text-xs uppercase">{latestFall ? `Low (${latestFall.total_score})` : "Not assessed"}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">{r.start_of_care ?? "—"}</td>
                    <td className="px-4 py-4"><span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase">{r.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
