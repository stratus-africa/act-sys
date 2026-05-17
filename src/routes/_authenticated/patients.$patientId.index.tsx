import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/$patientId/")({ component: Overview });

function Overview() {
  const { patientId } = Route.useParams();
  const [p, setP] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("patients").select("*").eq("id", patientId).single().then(({ data }) => setP(data));
  }, [patientId]);

  if (!p) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const save = async () => {
    setSaving(true);
    const { id, created_at, updated_at, ...rest } = p;
    const { error } = await supabase.from("patients").update(rest).eq("id", patientId);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const F = ({ k, label, type = "text" }: { k: string; label: string; type?: string }) => (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{label}</label>
      <input type={type} value={p[k] ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} className="w-full px-3 py-2 border border-border bg-background text-sm" />
    </div>
  );

  return (
    <div className="space-y-8 animate-entrance">
      <section className="border border-border bg-card p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-border pb-2">Demographics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <F k="first_name" label="First name" />
          <F k="last_name" label="Last name" />
          <F k="dob" label="Date of birth" type="date" />
          <F k="mrn" label="MRN" />
          <F k="ssn_last4" label="SSN (last 4)" />
          <F k="phone" label="Phone" />
        </div>
      </section>
      <section className="border border-border bg-card p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-border pb-2">Address & Emergency</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <F k="address" label="Address" />
          <F k="city" label="City" />
          <F k="state" label="State" />
          <F k="zip" label="Zip" />
          <F k="emergency_contact_name" label="Emergency contact" />
          <F k="emergency_contact_phone" label="Emergency phone" />
          <F k="emergency_contact_relation" label="Relationship" />
          <F k="primary_physician" label="Primary physician" />
          <F k="insurance" label="Insurance" />
          <F k="start_of_care" label="Start of care" type="date" />
        </div>
      </section>
      <section className="border border-border bg-card p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-border pb-2">Clinical</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">General condition</label>
            <select value={p.general_condition ?? ""} onChange={(e) => setP({ ...p, general_condition: e.target.value || null })} className="w-full px-3 py-2 border border-border bg-background text-sm">
              <option value="">—</option>
              <option value="improving">Improving</option>
              <option value="stable">Stable</option>
              <option value="deteriorating">Deteriorating</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm pt-6"><input type="checkbox" checked={p.dnr_status} onChange={(e) => setP({ ...p, dnr_status: e.target.checked })} className="accent-primary" />DNR status</label>
        </div>
      </section>
      <button onClick={save} disabled={saving} className="bg-primary text-primary-foreground px-6 py-2 text-sm font-bold disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
    </div>
  );
}
