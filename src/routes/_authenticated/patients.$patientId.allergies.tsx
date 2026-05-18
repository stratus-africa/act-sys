import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PrecautionBadge } from "@/components/app/PrecautionBadge";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, X, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/allergies")({ component: AllergiesPage });

type Allergy = {
  id: string;
  patient_id: string;
  allergen: string;
  category: string | null;
  reaction: string | null;
  severity: string;
  onset_date: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

const CATEGORIES = ["Drug", "Food", "Environmental", "Latex", "Insect", "Other"];
const SEVERITIES = ["mild", "moderate", "severe", "anaphylaxis"];

const SEV_VARIANT: Record<string, "neutral" | "amber" | "red"> = {
  mild: "neutral",
  moderate: "amber",
  severe: "red",
  anaphylaxis: "red",
};

function AllergiesPage() {
  const { patientId } = Route.useParams();
  const { hasRole } = useCurrentUser();
  const canEdit = hasRole("admin") || hasRole("rn");
  const [rows, setRows] = useState<Allergy[]>([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({
    allergen: "",
    category: "Drug",
    reaction: "",
    severity: "mild",
    onset_date: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Allergy>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("patient_allergies")
      .select("*")
      .eq("patient_id", patientId)
      .order("active", { ascending: false })
      .order("created_at", { ascending: false });
    setRows((data as Allergy[]) ?? []);
    setLoading(false);
    const { data: ev } = await supabase
      .from("patient_allergy_events")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(100);
    setEvents(ev ?? []);
    const ids = Array.from(new Set((ev ?? []).map((e: any) => e.actor_id).filter(Boolean)));
    if (ids.length) {
      const { data: pf } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      setActorNames(Object.fromEntries((pf ?? []).map((p: any) => [p.id, p.full_name || p.email || "Unknown"])));
    }
  };

  useEffect(() => { load(); }, [patientId]);

  const logEvent = async (action: string, allergy_id: string | null, before: any, after: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("patient_allergy_events").insert({
      allergy_id, patient_id: patientId, action, actor_id: user?.id ?? null, before, after,
    });
  };

  const add = async () => {
    if (!draft.allergen.trim()) { toast.error("Allergen is required"); return; }
    setSaving(true);
    const payload = {
      patient_id: patientId,
      allergen: draft.allergen.trim(),
      category: draft.category || null,
      reaction: draft.reaction || null,
      severity: draft.severity,
      onset_date: draft.onset_date || null,
      notes: draft.notes || null,
    };
    const { data: inserted, error } = await supabase.from("patient_allergies").insert(payload).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logEvent("add", inserted?.id ?? null, null, payload);
    setDraft({ allergen: "", category: "Drug", reaction: "", severity: "mild", onset_date: "", notes: "" });
    toast.success("Allergy added");
    load();
  };

  const toggleActive = async (a: Allergy) => {
    const { error } = await supabase.from("patient_allergies").update({ active: !a.active }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    await logEvent(a.active ? "resolve" : "reactivate", a.id, { active: a.active }, { active: !a.active });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this allergy?")) return;
    const removed = rows.find((r) => r.id === id);
    const { error } = await supabase.from("patient_allergies").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await logEvent("remove", id, removed ?? null, null);
    toast.success("Removed");
    load();
  };

  const startEdit = (a: Allergy) => {
    setEditId(a.id);
    setEditDraft({
      allergen: a.allergen, category: a.category, reaction: a.reaction,
      severity: a.severity, onset_date: a.onset_date, notes: a.notes,
    });
  };
  const cancelEdit = () => { setEditId(null); setEditDraft({}); };
  const saveEdit = async () => {
    if (!editId) return;
    if (!editDraft.allergen?.toString().trim()) { toast.error("Allergen is required"); return; }
    const before = rows.find((r) => r.id === editId);
    const update = {
      allergen: editDraft.allergen,
      category: editDraft.category || null,
      reaction: editDraft.reaction || null,
      severity: editDraft.severity ?? "mild",
      onset_date: editDraft.onset_date || null,
      notes: editDraft.notes || null,
    };
    const { error } = await supabase.from("patient_allergies").update(update).eq("id", editId);
    if (error) { toast.error(error.message); return; }
    await logEvent("edit", editId, before ?? null, update);
    toast.success("Saved");
    cancelEdit();
    load();
  };

  const active = rows.filter((r) => r.active);
  const inactive = rows.filter((r) => !r.active);
  const critical = active.filter((a) => a.severity === "severe" || a.severity === "anaphylaxis");

  return (
    <div className="space-y-6 animate-entrance">
      <section className="border border-border bg-card p-6 space-y-3">
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest">Allergy Summary</h3>
          {critical.length > 0 && <PrecautionBadge variant="red" label={`${critical.length} CRITICAL`} />}
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : active.length === 0 ? (
          <div className="text-sm text-muted-foreground">No known allergies (NKA).</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {active.map((a) => (
              <PrecautionBadge key={a.id} variant={SEV_VARIANT[a.severity] ?? "neutral"} label={`${a.allergen.toUpperCase()} · ${a.severity.toUpperCase()}`} />
            ))}
          </div>
        )}
      </section>

      {canEdit && (
        <section className="border border-border bg-card p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest border-b border-border pb-2">Add Allergy</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Allergen *">
              <input value={draft.allergen} onChange={(e) => setDraft({ ...draft, allergen: e.target.value })} className="w-full px-3 py-2 border border-border bg-background text-sm" placeholder="Penicillin" />
            </Field>
            <Field label="Category">
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="w-full px-3 py-2 border border-border bg-background text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Severity">
              <select value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value })} className="w-full px-3 py-2 border border-border bg-background text-sm">
                {SEVERITIES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </Field>
            <Field label="Reaction">
              <input value={draft.reaction} onChange={(e) => setDraft({ ...draft, reaction: e.target.value })} className="w-full px-3 py-2 border border-border bg-background text-sm" placeholder="Hives, swelling…" />
            </Field>
            <Field label="Onset date">
              <input type="date" value={draft.onset_date} onChange={(e) => setDraft({ ...draft, onset_date: e.target.value })} className="w-full px-3 py-2 border border-border bg-background text-sm" />
            </Field>
            <Field label="Notes">
              <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="w-full px-3 py-2 border border-border bg-background text-sm" />
            </Field>
          </div>
          <button onClick={add} disabled={saving} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">
            <Plus className="size-4" /> {saving ? "Adding…" : "Add allergy"}
          </button>
        </section>
      )}

      <section className="border border-border bg-card">
        <div className="px-6 py-3 border-b border-border flex justify-between items-center">
          <h3 className="text-xs font-bold uppercase tracking-widest">Active ({active.length})</h3>
        </div>
        <AllergyTable rows={active} canEdit={canEdit} onToggle={toggleActive} onRemove={remove} editId={editId} editDraft={editDraft} setEditDraft={setEditDraft} onStartEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} />
      </section>

      {inactive.length > 0 && (
        <section className="border border-border bg-card opacity-70">
          <div className="px-6 py-3 border-b border-border">
            <h3 className="text-xs font-bold uppercase tracking-widest">Resolved / Inactive ({inactive.length})</h3>
          </div>
          <AllergyTable rows={inactive} canEdit={canEdit} onToggle={toggleActive} onRemove={remove} editId={editId} editDraft={editDraft} setEditDraft={setEditDraft} onStartEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} />
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{label}</label>
      {children}
    </div>
  );
}

function AllergyTable({ rows, canEdit, onToggle, onRemove, editId, editDraft, setEditDraft, onStartEdit, onCancelEdit, onSaveEdit }: {
  rows: Allergy[]; canEdit: boolean; onToggle: (a: Allergy) => void; onRemove: (id: string) => void;
  editId: string | null; editDraft: Partial<Allergy>; setEditDraft: (d: Partial<Allergy>) => void;
  onStartEdit: (a: Allergy) => void; onCancelEdit: () => void; onSaveEdit: () => void;
}) {
  if (rows.length === 0) return <div className="px-6 py-6 text-sm text-muted-foreground">None.</div>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
          <th className="text-left px-6 py-2">Allergen</th>
          <th className="text-left px-3 py-2">Category</th>
          <th className="text-left px-3 py-2">Reaction</th>
          <th className="text-left px-3 py-2">Severity</th>
          <th className="text-left px-3 py-2">Onset</th>
          <th className="text-left px-3 py-2">Notes</th>
          {canEdit && <th className="text-right px-6 py-2">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => {
          const isEditing = editId === a.id;
          if (isEditing) {
            return (
              <tr key={a.id} className="border-b border-border last:border-0 bg-muted/30">
                <td className="px-6 py-2"><input value={editDraft.allergen ?? ""} onChange={(e) => setEditDraft({ ...editDraft, allergen: e.target.value })} className="w-full px-2 py-1 border border-border bg-background text-sm" /></td>
                <td className="px-3 py-2">
                  <select value={editDraft.category ?? ""} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} className="w-full px-2 py-1 border border-border bg-background text-sm">
                    <option value="">—</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input value={editDraft.reaction ?? ""} onChange={(e) => setEditDraft({ ...editDraft, reaction: e.target.value })} className="w-full px-2 py-1 border border-border bg-background text-sm" /></td>
                <td className="px-3 py-2">
                  <select value={editDraft.severity ?? "mild"} onChange={(e) => setEditDraft({ ...editDraft, severity: e.target.value })} className="w-full px-2 py-1 border border-border bg-background text-sm capitalize">
                    {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input type="date" value={editDraft.onset_date ?? ""} onChange={(e) => setEditDraft({ ...editDraft, onset_date: e.target.value })} className="w-full px-2 py-1 border border-border bg-background text-sm" /></td>
                <td className="px-3 py-2"><input value={editDraft.notes ?? ""} onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} className="w-full px-2 py-1 border border-border bg-background text-sm" /></td>
                <td className="px-6 py-2 text-right space-x-2 whitespace-nowrap">
                  <button onClick={onSaveEdit} className="inline-flex text-primary hover:text-primary/80" title="Save"><Check className="size-4" /></button>
                  <button onClick={onCancelEdit} className="inline-flex text-muted-foreground hover:text-foreground" title="Cancel"><X className="size-4" /></button>
                </td>
              </tr>
            );
          }
          return (
          <tr key={a.id} className="border-b border-border last:border-0">
            <td className="px-6 py-3 font-bold">{a.allergen}</td>
            <td className="px-3 py-3">{a.category ?? "—"}</td>
            <td className="px-3 py-3">{a.reaction ?? "—"}</td>
            <td className="px-3 py-3"><PrecautionBadge variant={SEV_VARIANT[a.severity] ?? "neutral"} label={a.severity.toUpperCase()} /></td>
            <td className="px-3 py-3 font-mono text-xs">{a.onset_date ?? "—"}</td>
            <td className="px-3 py-3 text-muted-foreground">{a.notes ?? "—"}</td>
            {canEdit && (
              <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                <button onClick={() => onStartEdit(a)} className="inline-flex text-muted-foreground hover:text-foreground" title="Edit"><Pencil className="size-4" /></button>
                <button onClick={() => onToggle(a)} className="text-xs font-bold uppercase text-muted-foreground hover:text-foreground">
                  {a.active ? "Resolve" : "Reactivate"}
                </button>
                <button onClick={() => onRemove(a.id)} className="text-destructive hover:text-destructive/80 inline-flex"><Trash2 className="size-4" /></button>
              </td>
            )}
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}