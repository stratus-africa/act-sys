import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FormSection, FieldLabel, TextInput } from "@/components/app/FormSection";
import { APPLICANT_POSITIONS, APPLICANT_STATUSES } from "@/lib/hr-constants";
import { toast } from "sonner";
import { Plus, Search, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/applicants/")({ component: ApplicantsPage });

const HR_STAGES = ["applied", "screening", "background", "interview", "offer", "hired"] as const;

function HrPipelineWidget() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [hired30, setHired30] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: rows }, { count }] = await Promise.all([
        (supabase.from("applicants" as any) as any).select("status"),
        (supabase.from("applicants" as any) as any).select("id", { count: "exact", head: true }).eq("status", "hired").gte("hired_at", since),
      ]);
      const c: Record<string, number> = {};
      (rows ?? []).forEach((r: any) => { c[r.status] = (c[r.status] ?? 0) + 1; });
      setCounts(c);
      setTotal((rows ?? []).length);
      setHired30(count ?? 0);
    })();
  }, []);

  const max = Math.max(1, ...HR_STAGES.map((s) => counts?.[s] ?? 0));
  const activeTotal = HR_STAGES.slice(0, -1).reduce((sum, s) => sum + (counts?.[s] ?? 0), 0);
  const conversionRate = activeTotal + hired30 > 0 ? Math.round((hired30 / (activeTotal + hired30)) * 100) : 0;

  return (
    <section className="border border-border bg-card">
      <div className="px-6 py-4 border-b border-border flex justify-between items-center">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest">HR Pipeline</h3>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">Applicants by stage · Hires last 30 days</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        <div className="bg-card p-5"><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Total Applicants</div><div className="text-3xl font-extrabold mt-3 tabular-nums">{counts == null ? "—" : total}</div></div>
        <div className="bg-card p-5"><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">In Pipeline</div><div className="text-3xl font-extrabold mt-3 tabular-nums">{counts == null ? "—" : activeTotal}</div></div>
        <div className="bg-card p-5"><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Hired · 30d</div><div className="text-3xl font-extrabold mt-3 tabular-nums text-primary">{counts == null ? "—" : hired30}</div></div>
        <div className="bg-card p-5"><div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Conversion</div><div className="text-3xl font-extrabold mt-3 tabular-nums">{counts == null ? "—" : `${conversionRate}%`}</div></div>
      </div>
      <div className="px-6 py-5 space-y-2.5">
        {HR_STAGES.map((s) => {
          const n = counts?.[s] ?? 0;
          const pct = (n / max) * 100;
          return (
            <div key={s} className="grid grid-cols-[110px_1fr_40px] items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{s}</span>
              <div className="h-2 bg-muted relative overflow-hidden">
                <div className={"absolute inset-y-0 left-0 transition-all " + (s === "hired" ? "bg-primary" : "bg-foreground/70")} style={{ width: pct + "%" }} />
              </div>
              <span className="text-sm font-extrabold tabular-nums text-right">{counts == null ? "—" : n}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}


type Applicant = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  position: string;
  status: string;
  applied_at: string;
  city: string | null;
  state: string | null;
};

function ApplicantsPage() {
  const { primaryRole } = useCurrentUser();
  const navigate = useNavigate();
  const canManage = primaryRole === "admin" || primaryRole === "rn";

  const [list, setList] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", position: "pca" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("applicants" as any) as any)
      .select("id, first_name, last_name, email, phone, position, status, applied_at, city, state")
      .order("applied_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data ?? []) as Applicant[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => list.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (posFilter && a.position !== posFilter) return false;
    if (q) {
      const s = `${a.first_name} ${a.last_name} ${a.email ?? ""} ${a.phone ?? ""}`.toLowerCase();
      if (!s.includes(q.toLowerCase())) return false;
    }
    return true;
  }), [list, q, statusFilter, posFilter]);

  const createApplicant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) return toast.error("Name required");
    setSaving(true);
    const { data, error } = await (supabase.from("applicants" as any) as any)
      .insert({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        position: form.position,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    setOpen(false);
    setForm({ first_name: "", last_name: "", email: "", phone: "", position: "pca" });
    toast.success("Applicant created");
    navigate({ to: "/applicants/$applicantId", params: { applicantId: data.id } });
  };

  if (!canManage) {
    return (
      <>
        <PageHeader eyebrow="HR" title="Applicants" />
        <div className="p-8 text-sm text-muted-foreground">Admin or RN access required.</div>
      </>
    );
  }

  const byStatus = APPLICANT_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s.value] = list.filter((a) => a.status === s.value).length;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        eyebrow="HR / Hiring"
        title="Applicants"
        description="Track candidates through screening, background, interview, and hire."
        actions={
          <button onClick={() => setOpen((v) => !v)} className="bg-primary text-primary-foreground px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
            <Plus className="size-3.5" /> New Applicant
          </button>
        }
      />
      <div className="p-6 lg:p-8 space-y-6">
        <HrPipelineWidget />
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
          {APPLICANT_STATUSES.map((s) => (
            <button key={s.value} onClick={() => setStatusFilter(statusFilter === s.value ? "" : s.value)}
              className={"border p-3 text-left transition-colors " + (statusFilter === s.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
              <div className="text-2xl font-extrabold">{byStatus[s.value] ?? 0}</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
            </button>
          ))}
        </div>

        {open && (
          <div className="border border-border bg-card p-6">
            <FormSection title="New Applicant">
              <form onSubmit={createApplicant} className="grid md:grid-cols-2 gap-3">
                <div><FieldLabel>First Name *</FieldLabel><TextInput required value={form.first_name} onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))} /></div>
                <div><FieldLabel>Last Name *</FieldLabel><TextInput required value={form.last_name} onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))} /></div>
                <div><FieldLabel>Email</FieldLabel><TextInput type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /></div>
                <div><FieldLabel>Phone</FieldLabel><TextInput value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} /></div>
                <div className="md:col-span-2">
                  <FieldLabel>Position</FieldLabel>
                  <select value={form.position} onChange={(e) => setForm((s) => ({ ...s, position: e.target.value }))} className="w-full px-3 py-2 border border-border bg-background text-sm">
                    {APPLICANT_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <button disabled={saving} type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-xs font-bold uppercase flex items-center gap-1 disabled:opacity-50">
                    <UserPlus className="size-3.5" /> {saving ? "Saving…" : "Create & Open"}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              </form>
            </FormSection>
          </div>
        )}

        <div className="border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, phone…" className="w-full pl-9 pr-3 py-2 border border-border bg-background text-sm" />
            </div>
            <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="px-3 py-2 border border-border bg-background text-xs">
              <option value="">All positions</option>
              {APPLICANT_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            {(q || statusFilter || posFilter) && (
              <button onClick={() => { setQ(""); setStatusFilter(""); setPosFilter(""); }} className="text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground">Clear</button>
            )}
          </div>
          {loading ? <div className="p-8 text-xs text-muted-foreground text-center">Loading…</div> :
            filtered.length === 0 ? <div className="p-8 text-xs text-muted-foreground text-center">No applicants found.</div> : (
            <table className="w-full text-sm">
              <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
                <tr><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Position</th><th className="px-4 py-2 text-left">Contact</th><th className="px-4 py-2 text-left">Location</th><th className="px-4 py-2 text-left">Applied</th><th className="px-4 py-2 text-left">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((a) => {
                  const status = APPLICANT_STATUSES.find((s) => s.value === a.status);
                  const pos = APPLICANT_POSITIONS.find((p) => p.value === a.position);
                  return (
                    <tr key={a.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold">
                        <Link to="/applicants/$applicantId" params={{ applicantId: a.id }} className="hover:underline">
                          {a.last_name}, {a.first_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase font-mono">{pos?.label ?? a.position}</td>
                      <td className="px-4 py-3 text-xs">{a.email}<br /><span className="text-muted-foreground">{a.phone}</span></td>
                      <td className="px-4 py-3 text-xs">{[a.city, a.state].filter(Boolean).join(", ")}</td>
                      <td className="px-4 py-3 font-mono text-xs">{a.applied_at}</td>
                      <td className="px-4 py-3"><span className={"text-[10px] font-bold uppercase px-2 py-0.5 " + (status?.tone === "primary" ? "bg-primary/10 text-primary" : status?.tone === "destructive" ? "bg-destructive/10 text-destructive" : status?.tone === "amber" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground")}>{status?.label ?? a.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
