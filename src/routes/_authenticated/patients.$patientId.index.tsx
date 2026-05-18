import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/patients/$patientId/")({ component: Overview });

function Overview() {
  const { patientId } = Route.useParams();
  const { hasRole } = useCurrentUser();
  const canEdit = hasRole("admin") || hasRole("rn");
  const [p, setP] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const onPhotoSelected = async (file: File) => {
    if (!canEdit) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${patientId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("patient-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("patient-photos").getPublicUrl(path);
    const photo_url = pub.publicUrl;
    const { error } = await supabase.from("patients").update({ photo_url }).eq("id", patientId);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setP({ ...p, photo_url });
    toast.success("Photo updated");
  };

  const removePhoto = async () => {
    if (!canEdit || !p.photo_url) return;
    const { error } = await supabase.from("patients").update({ photo_url: null }).eq("id", patientId);
    if (error) { toast.error(error.message); return; }
    setP({ ...p, photo_url: null });
  };

  const F = ({ k, label, type = "text" }: { k: string; label: string; type?: string }) => (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{label}</label>
      <input type={type} value={p[k] ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} className="w-full px-3 py-2 border border-border bg-background text-sm" />
    </div>
  );

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8 animate-entrance">
      <div className="space-y-8">
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
          <F k="start_of_care" label="Start of care" type="date" />
        </div>
      </section>
      <section className="border border-border bg-card p-6 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-widest border-b border-border pb-2">Insurance</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <F k="insurance_carrier" label="Carrier" />
          <F k="insurance_policy" label="Policy #" />
          <F k="insurance_group" label="Group #" />
          <F k="insurance_plan_type" label="Plan type" />
          <F k="insurance_subscriber" label="Subscriber" />
          <F k="insurance" label="Notes / legacy" />
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

      <aside className="space-y-5">
        <div className="border border-border bg-card p-5 space-y-3">
          <div className="aspect-square w-full bg-muted overflow-hidden border border-border grid place-items-center">
            {p.photo_url ? (
              <img src={p.photo_url} alt="Patient photo" className="w-full h-full object-cover" />
            ) : (
              <div className="text-[10px] font-mono uppercase text-muted-foreground">No photo</div>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhotoSelected(f); e.target.value = ""; }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-2 hover:bg-muted disabled:opacity-50">
                <Upload className="size-3" /> {uploading ? "Uploading…" : p.photo_url ? "Replace" : "Upload"}
              </button>
              {p.photo_url && (
                <button onClick={removePhoto} className="inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-2 hover:bg-muted text-destructive">
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="border border-border bg-card p-5 space-y-2 text-sm">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2 mb-2">Saved Details</div>
          <Row k="Name" v={`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—"} />
          <Row k="MRN" v={p.mrn ?? "—"} />
          <Row k="DOB" v={p.dob ?? "—"} />
          <Row k="Phone" v={p.phone ?? "—"} />
          <Row k="Address" v={[p.address, p.city, p.state, p.zip].filter(Boolean).join(", ") || "—"} />
          <Row k="Physician" v={p.primary_physician ?? "—"} />
          <Row k="Insurance" v={p.insurance_carrier ?? p.insurance ?? "—"} />
          <Row k="Policy #" v={p.insurance_policy ?? "—"} />
          <Row k="Status" v={p.status ?? "—"} />
          {p.dnr_status && <div className="mt-2 inline-block bg-destructive/10 text-destructive text-[10px] font-bold uppercase px-2 py-1">DNR</div>}
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[10px] font-mono uppercase text-muted-foreground">{k}</span>
      <span className="text-xs font-medium text-right truncate">{v}</span>
    </div>
  );
}
