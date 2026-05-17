import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { toast } from "sonner";
import { Check, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/care-plan")({ component: CarePlan });

type Task = { id: string; title: string; category: string | null; frequency: string | null; active: boolean; created_at: string };
type Completion = { id: string; task_id: string; completed_at: string; notes: string | null };

function CarePlan() {
  const { patientId } = Route.useParams();
  const { primaryRole, user } = useCurrentUser();
  const canEdit = primaryRole === "admin" || primaryRole === "rn";
  const canComplete = canEdit || primaryRole === "caregiver";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("ADL");
  const [frequency, setFrequency] = useState("daily");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from("care_plan_tasks").select("*").eq("patient_id", patientId).order("created_at", { ascending: true }),
      supabase.from("task_completions").select("*").eq("patient_id", patientId).order("completed_at", { ascending: false }).limit(200),
    ]);
    setTasks((t ?? []) as Task[]);
    setCompletions((c ?? []) as Completion[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from("care_plan_tasks").insert({ patient_id: patientId, title: title.trim(), category, frequency, created_by: user?.id });
    if (error) return toast.error(error.message);
    setTitle("");
    toast.success("Task added");
    load();
  };

  const toggleActive = async (t: Task) => {
    const { error } = await supabase.from("care_plan_tasks").update({ active: !t.active }).eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeTask = async (t: Task) => {
    if (!confirm(`Remove "${t.title}"?`)) return;
    const { error } = await supabase.from("care_plan_tasks").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  };

  const completeTask = async (t: Task) => {
    const { error } = await supabase.from("task_completions").insert({ task_id: t.id, patient_id: patientId, completed_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success(`Marked "${t.title}" complete`);
    load();
  };

  const todayKey = new Date().toISOString().slice(0, 10);
  const completedToday = (taskId: string) => completions.some((c) => c.task_id === taskId && c.completed_at.slice(0, 10) === todayKey);
  const lastCompletion = (taskId: string) => completions.find((c) => c.task_id === taskId);

  const activeTasks = tasks.filter((t) => t.active);
  const inactiveTasks = tasks.filter((t) => !t.active);

  return (
    <div className="space-y-8">
      {canEdit && (
        <div className="border border-border bg-card p-6">
          <FormSection title="Add Task">
            <form onSubmit={addTask} className="grid md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end">
              <div><FieldLabel>Task</FieldLabel><TextInput required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Assist with morning bathing" /></div>
              <div><FieldLabel>Category</FieldLabel>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
                  <option>ADL</option><option>Medication</option><option>Vital signs</option><option>Wound care</option><option>Mobility</option><option>Other</option>
                </select>
              </div>
              <div><FieldLabel>Frequency</FieldLabel>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm">
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
          <h3 className="text-xs font-bold uppercase tracking-widest">Active Tasks ({activeTasks.length})</h3>
          <span className="text-[10px] font-mono uppercase text-muted-foreground">{todayKey}</span>
        </div>
        {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div>
          : activeTasks.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No active tasks. {canEdit && "Add one above."}</div>
          : (
          <ul className="divide-y divide-border">
            {activeTasks.map((t) => {
              const done = completedToday(t.id);
              const last = lastCompletion(t.id);
              return (
                <li key={t.id} className="px-6 py-4 flex items-center gap-4">
                  <button
                    disabled={!canComplete || done}
                    onClick={() => completeTask(t)}
                    className={"size-8 rounded-full border-2 grid place-items-center transition-colors " + (done ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary disabled:opacity-30")}
                  >
                    {done && <Check className="size-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={"font-semibold text-sm " + (done ? "text-muted-foreground line-through" : "")}>{t.title}</div>
                    <div className="flex gap-3 text-[10px] font-mono uppercase text-muted-foreground mt-1">
                      <span>{t.category}</span><span>{t.frequency}</span>
                      {last && <span>Last: {new Date(last.completed_at).toLocaleString()}</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => toggleActive(t)} className="text-[10px] font-mono uppercase text-muted-foreground hover:text-foreground px-2 py-1">Archive</button>
                      <button onClick={() => removeTask(t)} className="text-muted-foreground hover:text-alert-red p-1"><Trash2 className="size-4" /></button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {inactiveTasks.length > 0 && (
        <div className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Archived ({inactiveTasks.length})</h3></div>
          <ul className="divide-y divide-border">
            {inactiveTasks.map((t) => (
              <li key={t.id} className="px-6 py-3 flex items-center justify-between text-sm text-muted-foreground">
                <span>{t.title}</span>
                {canEdit && <button onClick={() => toggleActive(t)} className="text-[10px] font-mono uppercase hover:text-foreground">Reactivate</button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border border-border bg-card">
        <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest">Recent Completions</h3></div>
        {completions.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No completions yet.</div> : (
          <ul className="divide-y divide-border max-h-72 overflow-y-auto">
            {completions.slice(0, 30).map((c) => {
              const task = tasks.find((t) => t.id === c.task_id);
              return (
                <li key={c.id} className="px-6 py-2.5 flex items-center justify-between text-sm">
                  <span>{task?.title ?? "—"}</span>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">{new Date(c.completed_at).toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}