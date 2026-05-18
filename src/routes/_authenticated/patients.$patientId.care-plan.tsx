import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { toast } from "sonner";
import { Check, Trash2, Plus, History, Target, ChevronDown, ChevronRight, TrendingUp, FileDown } from "lucide-react";
import { exportCarePlanPdf } from "@/lib/care-plan-pdf";
import { notifyAdminsAndRns } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/patients/$patientId/care-plan")({ component: CarePlan });

type Goal = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  target_date: string | null;
  status: string;
  source_assessment_type: string | null;
  source_assessment_id: string | null;
  created_at: string;
};
type Intervention = { id: string; goal_id: string; description: string; frequency: string | null; assigned_role: string | null; active: boolean };
type Progress = { id: string; goal_id: string; note: string; status: string; recorded_by: string | null; recorded_at: string };
type Task = { id: string; title: string; category: string | null; frequency: string | null; active: boolean; created_at: string };
type Completion = { id: string; task_id: string; completed_at: string; notes: string | null; completed_by: string | null };

const ASSESSMENT_TABLE: Record<string, "fall_risk_assessments" | "skin_assessments" | "participant_assessments" | "rn_assessments" | "caregiver_assessments"> = {
  fall_risk: "fall_risk_assessments",
  skin: "skin_assessments",
  participant: "participant_assessments",
  rn: "rn_assessments",
  caregiver: "caregiver_assessments",
};

const GOAL_STATUS = ["active", "met", "on_hold", "discontinued"] as const;
const PROGRESS_STATUS = ["progressing", "met", "no_change", "regressing"] as const;
const PRIORITY = ["high", "medium", "low"] as const;
const STATUS_TONE: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  met: "bg-emerald-500/10 text-emerald-600",
  on_hold: "bg-amber-500/10 text-amber-700",
  discontinued: "bg-muted text-muted-foreground",
  progressing: "bg-primary/10 text-primary",
  no_change: "bg-muted text-muted-foreground",
  regressing: "bg-destructive/10 text-destructive",
};
const PRIORITY_TONE: Record<string, string> = {
  high: "bg-destructive/10 text-destructive",
  medium: "bg-amber-500/10 text-amber-700",
  low: "bg-muted text-muted-foreground",
};

function CarePlan() {
  const { patientId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const canEdit = primaryRole === "admin" || primaryRole === "rn";
  const canProgress = canEdit || primaryRole === "caregiver";

  const [goals, setGoals] = useState<Goal[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showStatus, setShowStatus] = useState<"active" | "all">("active");
  const [goalForm, setGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [progressTarget, setProgressTarget] = useState<Goal | null>(null);
  const [interventionTarget, setInterventionTarget] = useState<Goal | null>(null);

  const [patientMeta, setPatientMeta] = useState<{ name: string; mrn: string | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, i, pr, t, c, p] = await Promise.all([
      supabase.from("care_plan_goals").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }),
      supabase.from("care_plan_interventions").select("*").eq("patient_id", patientId).order("created_at", { ascending: true }),
      supabase.from("care_plan_progress").select("*").eq("patient_id", patientId).order("recorded_at", { ascending: false }),
      supabase.from("care_plan_tasks").select("*").eq("patient_id", patientId).order("created_at", { ascending: true }),
      supabase.from("task_completions").select("*").eq("patient_id", patientId).order("completed_at", { ascending: false }).limit(200),
      supabase.from("patients").select("first_name,last_name,mrn").eq("id", patientId).maybeSingle(),
    ]);
    setGoals((g.data ?? []) as Goal[]);
    setInterventions((i.data ?? []) as Intervention[]);
    setProgress((pr.data ?? []) as Progress[]);
    setTasks((t.data ?? []) as Task[]);
    setCompletions((c.data ?? []) as Completion[]);
    setPatientMeta(p.data ? { name: `${p.data.last_name}, ${p.data.first_name}`, mrn: p.data.mrn ?? null } : null);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const visibleGoals = showStatus === "all" ? goals : goals.filter((g) => g.status === "active" || g.status === "on_hold");

  const interventionsFor = (id: string) => interventions.filter((x) => x.goal_id === id);
  const progressFor = (id: string) => progress.filter((x) => x.goal_id === id);

  const toggleExpand = (id: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const removeGoal = async (g: Goal) => {
    if (!confirm(`Delete goal "${g.title}" and all linked interventions/progress?`)) return;
    const { error } = await supabase.from("care_plan_goals").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("Goal deleted");
    load();
  };

  const updateGoalStatus = async (g: Goal, status: string) => {
    const { error } = await supabase.from("care_plan_goals").update({ status }).eq("id", g.id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeIntervention = async (i: Intervention) => {
    const { error } = await supabase.from("care_plan_interventions").delete().eq("id", i.id);
    if (error) return toast.error(error.message);
    load();
  };

  // Tasks (kept from original)
  const addTaskForm = useTaskForm(patientId, user?.id, load);
  const todayKey = new Date().toISOString().slice(0, 10);
  const completedToday = (taskId: string) => completions.some((c) => c.task_id === taskId && c.completed_at.slice(0, 10) === todayKey);
  const activeTasks = tasks.filter((t) => t.active);

  return (
    <div className="space-y-8">
      {/* GOALS */}
      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Target className="size-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-widest">Care Goals ({visibleGoals.length})</h3>
          </div>
          <div className="flex items-center gap-2">
            <select value={showStatus} onChange={(e) => setShowStatus(e.target.value as never)} className="text-xs px-2 py-1 border border-border bg-background">
              <option value="active">Active &amp; on hold</option>
              <option value="all">All</option>
            </select>
            <button
              onClick={() => exportCarePlanPdf({
                patientName: patientMeta?.name ?? "Patient",
                patientMrn: patientMeta?.mrn,
                goals, interventions, progress,
              })}
              disabled={goals.length === 0}
              className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-40"
            >
              <FileDown className="size-3.5" /> Export PDF
            </button>
            {canEdit && (
              <button onClick={() => { setEditingGoal(null); setGoalForm(true); }} className="bg-primary text-primary-foreground px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                <Plus className="size-3.5" /> New Goal
              </button>
            )}
          </div>
        </div>

        {loading ? <div className="p-8 text-xs text-muted-foreground text-center">Loading…</div>
          : visibleGoals.length === 0 ? <div className="p-8 text-xs text-muted-foreground text-center">No goals yet.{canEdit ? " Create one to get started." : ""}</div>
          : (
          <ul className="divide-y divide-border">
            {visibleGoals.map((g) => {
              const open = expanded.has(g.id);
              const ints = interventionsFor(g.id);
              const prog = progressFor(g.id);
              const lastProg = prog[0];
              return (
                <li key={g.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleExpand(g.id)} className="mt-0.5 text-muted-foreground hover:text-foreground">
                      {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{g.title}</span>
                        <span className={"text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 " + (STATUS_TONE[g.status] ?? "bg-muted")}>{g.status.replace("_", " ")}</span>
                        <span className={"text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 " + (PRIORITY_TONE[g.priority] ?? "bg-muted")}>{g.priority}</span>
                        {g.category && <span className="text-[10px] font-mono uppercase text-muted-foreground">{g.category}</span>}
                      </div>
                      {g.description && <div className="text-xs text-muted-foreground mt-1">{g.description}</div>}
                      <div className="flex gap-3 text-[10px] font-mono uppercase text-muted-foreground mt-2">
                        {g.target_date && <span>Target {g.target_date}</span>}
                        <span>{ints.length} interventions</span>
                        <span>{prog.length} progress notes</span>
                        {lastProg && <span>Last update {new Date(lastProg.recorded_at).toLocaleDateString()}</span>}
                        {g.source_assessment_type && <span>From {g.source_assessment_type}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canProgress && (
                        <button onClick={() => setProgressTarget(g)} className="text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-1.5 hover:bg-muted inline-flex items-center gap-1">
                          <TrendingUp className="size-3" /> Progress
                        </button>
                      )}
                      {canEdit && (
                        <>
                          <button onClick={() => { setEditingGoal(g); setGoalForm(true); }} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground px-2 py-1">Edit</button>
                          <button onClick={() => removeGoal(g)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="size-3.5" /></button>
                        </>
                      )}
                    </div>
                  </div>

                  {open && (
                    <div className="ml-7 mt-4 grid lg:grid-cols-2 gap-4">
                      <div className="border border-border bg-muted/30">
                        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                          <div className="text-[10px] font-bold uppercase tracking-widest">Interventions</div>
                          {canEdit && (
                            <button onClick={() => setInterventionTarget(g)} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                              <Plus className="size-3" /> Add
                            </button>
                          )}
                        </div>
                        {ints.length === 0 ? <div className="p-3 text-[11px] text-muted-foreground">No interventions yet.</div>
                          : (
                          <ul className="divide-y divide-border">
                            {ints.map((i) => (
                              <li key={i.id} className="px-3 py-2 text-xs flex items-start gap-2">
                                <span className="flex-1">
                                  <div>{i.description}</div>
                                  <div className="flex gap-2 text-[10px] font-mono uppercase text-muted-foreground mt-1">
                                    {i.frequency && <span>{i.frequency}</span>}
                                    {i.assigned_role && <span>· {i.assigned_role}</span>}
                                  </div>
                                </span>
                                {canEdit && <button onClick={() => removeIntervention(i)} className="text-muted-foreground hover:text-destructive p-0.5"><Trash2 className="size-3" /></button>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="border border-border bg-muted/30">
                        <div className="px-3 py-2 border-b border-border text-[10px] font-bold uppercase tracking-widest">Progress Timeline</div>
                        {prog.length === 0 ? <div className="p-3 text-[11px] text-muted-foreground">No progress notes yet.</div>
                          : (
                          <ul className="divide-y divide-border max-h-64 overflow-y-auto">
                            {prog.map((p) => (
                              <li key={p.id} className="px-3 py-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className={"text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 " + (STATUS_TONE[p.status] ?? "bg-muted")}>{p.status.replace("_", " ")}</span>
                                  <span className="text-[10px] font-mono uppercase text-muted-foreground ml-auto">{new Date(p.recorded_at).toLocaleString()}</span>
                                </div>
                                <div className="mt-1">{p.note}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {canEdit && g.status !== "met" && (
                        <div className="lg:col-span-2 flex gap-2 text-[10px] font-mono uppercase">
                          {GOAL_STATUS.filter((s) => s !== g.status).map((s) => (
                            <button key={s} onClick={() => updateGoalStatus(g, s)} className="border border-border px-2 py-1 hover:bg-muted">
                              Mark {s.replace("_", " ")}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* DAILY TASKS (kept) */}
      {canEdit && (
        <div className="border border-border bg-card p-6">
          <FormSection title="Add Daily Task">
            <form onSubmit={addTaskForm.submit} className="grid md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end">
              <div><FieldLabel>Task</FieldLabel><TextInput required value={addTaskForm.title} onChange={(e) => addTaskForm.setTitle(e.target.value)} placeholder="e.g. Assist with morning bathing" /></div>
              <div><FieldLabel>Category</FieldLabel>
                <select value={addTaskForm.category} onChange={(e) => addTaskForm.setCategory(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                  <option>ADL</option><option>Medication</option><option>Vital signs</option><option>Wound care</option><option>Mobility</option><option>Other</option>
                </select>
              </div>
              <div><FieldLabel>Frequency</FieldLabel>
                <select value={addTaskForm.frequency} onChange={(e) => addTaskForm.setFrequency(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                  <option>daily</option><option>twice daily</option><option>weekly</option><option>as needed</option>
                </select>
              </div>
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold flex items-center gap-1"><Plus className="size-4" />Add</button>
            </form>
          </FormSection>
        </div>
      )}

      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest">Daily Tasks ({activeTasks.length})</h3>
          <span className="text-[10px] font-mono uppercase text-muted-foreground">{todayKey}</span>
        </div>
        {activeTasks.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No daily tasks.</div> : (
          <ul className="divide-y divide-border">
            {activeTasks.map((t) => {
              const done = completedToday(t.id);
              return (
                <li key={t.id} className="px-6 py-3 flex items-center gap-3">
                  <div className={"size-6 rounded-full border-2 grid place-items-center " + (done ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                    {done && <Check className="size-3" />}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className={done ? "text-muted-foreground line-through" : ""}>{t.title}</div>
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">{t.category} · {t.frequency}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {goalForm && canEdit && (
        <GoalFormModal
          patientId={patientId}
          existing={editingGoal}
          userId={user?.id}
          onClose={() => { setGoalForm(false); setEditingGoal(null); }}
          onSaved={() => { setGoalForm(false); setEditingGoal(null); load(); }}
        />
      )}
      {progressTarget && canProgress && (
        <ProgressModal
          goal={progressTarget}
          patientId={patientId}
          userId={user?.id}
          onClose={() => setProgressTarget(null)}
          onSaved={() => { setProgressTarget(null); load(); }}
        />
      )}
      {interventionTarget && canEdit && (
        <InterventionModal
          goal={interventionTarget}
          patientId={patientId}
          userId={user?.id}
          onClose={() => setInterventionTarget(null)}
          onSaved={() => { setInterventionTarget(null); load(); }}
        />
      )}
    </div>
  );
}

function useTaskForm(patientId: string, userId: string | undefined, reload: () => void) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("ADL");
  const [frequency, setFrequency] = useState("daily");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from("care_plan_tasks").insert({ patient_id: patientId, title: title.trim(), category, frequency, created_by: userId });
    if (error) return toast.error(error.message);
    setTitle("");
    toast.success("Task added");
    reload();
  };
  return { title, setTitle, category, setCategory, frequency, setFrequency, submit };
}

function GoalFormModal({ patientId, existing, userId, onClose, onSaved }: { patientId: string; existing: Goal | null; userId: string | undefined; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState(existing?.category ?? "ADL");
  const [priority, setPriority] = useState(existing?.priority ?? "medium");
  const [targetDate, setTargetDate] = useState(existing?.target_date ?? "");
  const [status, setStatus] = useState(existing?.status ?? "active");
  const [sourceType, setSourceType] = useState(existing?.source_assessment_type ?? "");
  const [sourceId, setSourceId] = useState(existing?.source_assessment_id ?? "");
  const [sourceOptions, setSourceOptions] = useState<Array<{ id: string; assessment_date: string }>>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sourceType) { setSourceOptions([]); return; }
    const table = ASSESSMENT_TABLE[sourceType];
    if (!table) { setSourceOptions([]); return; }
    setLoadingSources(true);
    // Some tables use `assessment_date`, caregiver_assessments uses `service_date`.
    const dateCol = table === "caregiver_assessments" ? "service_date" : "assessment_date";
    supabase.from(table).select(`id, ${dateCol}`).eq("patient_id", patientId).order(dateCol, { ascending: false }).limit(100).then(({ data }) => {
      const rows = ((data as unknown) as Array<Record<string, string>>) ?? [];
      const opts = rows.map((r) => ({ id: r.id, assessment_date: r[dateCol] }));
      setSourceOptions(opts);
      if (sourceId && !opts.some((r) => r.id === sourceId)) setSourceId("");
      setLoadingSources(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, patientId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    // Enforce: if a source assessment id is selected, verify it belongs to THIS patient.
    if (sourceType && sourceId) {
      const table = ASSESSMENT_TABLE[sourceType];
      const { data: check } = await supabase.from(table).select("id").eq("id", sourceId).eq("patient_id", patientId).maybeSingle();
      if (!check) {
        toast.error("Selected assessment does not belong to this patient.");
        return;
      }
    }
    setSaving(true);
    const payload = {
      patient_id: patientId,
      title: title.trim(),
      description: description.trim() || null,
      category: category || null,
      priority,
      target_date: targetDate || null,
      status,
      source_assessment_type: sourceType || null,
      source_assessment_id: sourceType && sourceId ? sourceId : null,
      created_by: userId,
    };
    const { error } = existing
      ? await supabase.from("care_plan_goals").update(payload).eq("id", existing.id)
      : await supabase.from("care_plan_goals").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Goal updated" : "Goal added");
    onSaved();
  };

  return (
    <Modal onClose={onClose} title={existing ? "Edit Goal" : "New Care Goal"}>
      <form onSubmit={submit} className="space-y-3">
        <div><FieldLabel>Title</FieldLabel><TextInput required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><FieldLabel>Description</FieldLabel>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-border bg-background text-sm" placeholder="Measurable outcome the patient is working toward" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><FieldLabel>Category</FieldLabel>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
              <option>ADL</option><option>Mobility</option><option>Nutrition</option><option>Pain</option><option>Wound</option><option>Mental Health</option><option>Education</option><option>Other</option>
            </select>
          </div>
          <div><FieldLabel>Priority</FieldLabel>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
              {PRIORITY.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div><FieldLabel>Status</FieldLabel>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
              {GOAL_STATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><FieldLabel>Target date</FieldLabel><TextInput type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></div>
          <div><FieldLabel>Source assessment</FieldLabel>
            <select value={sourceType} onChange={(e) => { setSourceType(e.target.value); setSourceId(""); }} className="w-full px-3 py-2 border border-border bg-background text-sm">
              <option value="">—</option>
              <option value="fall_risk">Fall Risk</option>
              <option value="skin">Skin</option>
              <option value="participant">Participant</option>
              <option value="rn">RN</option>
              <option value="caregiver">Caregiver</option>
            </select>
          </div>
          <div><FieldLabel>Linked record</FieldLabel>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} disabled={!sourceType || loadingSources} className="w-full px-3 py-2 border border-border bg-background text-sm disabled:opacity-50">
              <option value="">{!sourceType ? "Pick a type first" : loadingSources ? "Loading…" : sourceOptions.length ? "—" : "No records found"}</option>
              {sourceOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.assessment_date} · {o.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : existing ? "Save changes" : "Create goal"}</button>
        </div>
      </form>
    </Modal>
  );
}

function InterventionModal({ goal, patientId, userId, onClose, onSaved }: { goal: Goal; patientId: string; userId: string | undefined; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [assignedRole, setAssignedRole] = useState("caregiver");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("care_plan_interventions").insert({
      goal_id: goal.id, patient_id: patientId, description: description.trim(), frequency, assigned_role: assignedRole, created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Intervention added");
    onSaved();
  };
  return (
    <Modal onClose={onClose} title={`Add intervention — ${goal.title}`}>
      <form onSubmit={submit} className="space-y-3">
        <div><FieldLabel>Description</FieldLabel>
          <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-border bg-background text-sm" placeholder="e.g. Assist patient with weight-bearing exercises" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>Frequency</FieldLabel>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
              <option>daily</option><option>twice daily</option><option>weekly</option><option>as needed</option><option>every visit</option>
            </select>
          </div>
          <div><FieldLabel>Assigned to</FieldLabel>
            <select value={assignedRole} onChange={(e) => setAssignedRole(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
              <option>caregiver</option><option>rn</option><option>patient</option><option>family</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Add"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ProgressModal({ goal, patientId, userId, onClose, onSaved }: { goal: Goal; patientId: string; userId: string | undefined; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<typeof PROGRESS_STATUS[number]>("progressing");
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("care_plan_progress").insert({
      goal_id: goal.id, patient_id: patientId, note: note.trim(), status, recorded_by: userId,
    });
    if (!error && status === "met") {
      await supabase.from("care_plan_goals").update({ status: "met" }).eq("id", goal.id);
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Progress recorded");
    onSaved();
  };
  return (
    <Modal onClose={onClose} title={`Progress update — ${goal.title}`}>
      <form onSubmit={submit} className="space-y-3">
        <div><FieldLabel>Status</FieldLabel>
          <select value={status} onChange={(e) => setStatus(e.target.value as never)} className="w-full px-3 py-2 border border-border bg-background text-sm">
            {PROGRESS_STATUS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
        <div><FieldLabel>Note</FieldLabel>
          <textarea required value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="w-full px-3 py-2 border border-border bg-background text-sm" placeholder="What changed? Observations, measurements, next steps." />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground">Cancel</button>
          <button type="submit" disabled={saving} className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Record"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-foreground/40 grid place-items-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
