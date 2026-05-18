import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PrecautionBadge } from "@/components/app/PrecautionBadge";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/patients/$patientId")({ component: PatientShell });

const TABS = [
  { to: "/patients/$patientId", label: "Overview", end: true },
  { to: "/patients/$patientId/consent", label: "Consent & HIPAA" },
  { to: "/patients/$patientId/fall-risk", label: "Fall Risk" },
  { to: "/patients/$patientId/assessments", label: "Assessments" },
  { to: "/patients/$patientId/care-plan", label: "Care Plan" },
  { to: "/patients/$patientId/visits", label: "Visits" },
  { to: "/patients/$patientId/allergies", label: "Allergies" },
  { to: "/patients/$patientId/documents", label: "Documents" },
];

function PatientShell() {
  const { patientId } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hasRole } = useCurrentUser();
  const canEdit = hasRole("admin") || hasRole("rn");
  const [p, setP] = useState<any>(null);
  const [fall, setFall] = useState<{ total_score: number; risk_level: string } | null>(null);
  const [consent, setConsent] = useState<{ status: string } | null>(null);
  const [skin, setSkin] = useState<{ status: string; assessment_date: string } | null>(null);
  const [allergyCount, setAllergyCount] = useState<{ total: number; critical: number }>({ total: 0, critical: 0 });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPatient = useCallback(() => {
    supabase.from("patients").select("*").eq("id", patientId).single().then(({ data }) => setP(data));
  }, [patientId]);

  useEffect(() => {
    loadPatient();
    supabase.from("fall_risk_assessments").select("total_score, risk_level, assessment_date").eq("patient_id", patientId).order("assessment_date", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setFall(data));
    supabase.from("patient_consents").select("status").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setConsent(data));
    supabase.from("skin_assessments").select("status, assessment_date").eq("patient_id", patientId).order("assessment_date", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setSkin(data));
    supabase.from("patient_allergies").select("severity").eq("patient_id", patientId).eq("active", true).then(({ data }) => {
      const list = data ?? [];
      setAllergyCount({
        total: list.length,
        critical: list.filter((a: any) => a.severity === "severe" || a.severity === "anaphylaxis").length,
      });
    });
  }, [patientId, loadPatient]);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d || d.patientId === patientId) loadPatient();
    };
    window.addEventListener("patient:refresh", handler);
    return () => window.removeEventListener("patient:refresh", handler);
  }, [patientId, loadPatient]);

  const onPhotoSelected = async (file: File) => {
    if (!canEdit) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${patientId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("patient-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("patient-photos").getPublicUrl(path);
    const { error } = await supabase.from("patients").update({ photo_url: pub.publicUrl }).eq("id", patientId);
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    setP((prev: any) => ({ ...prev, photo_url: pub.publicUrl }));
    toast.success("Photo updated");
  };
  const removePhoto = async () => {
    if (!canEdit || !p?.photo_url) return;
    const { error } = await supabase.from("patients").update({ photo_url: null }).eq("id", patientId);
    if (error) { toast.error(error.message); return; }
    setP({ ...p, photo_url: null });
  };

  const atRisk = fall ? fall.risk_level === "at_risk" || fall.total_score >= 4 : false;

  return (
    <div className="animate-entrance">
      <div className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="px-8 pt-6 pb-3">
          <Link to="/patients" className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">&larr; Registry</Link>
          <div className="flex items-end justify-between gap-4 mt-2 flex-wrap">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {p ? `${p.last_name}, ${p.first_name}` : "Loading…"}
              </h1>
              <div className="flex gap-4 mt-1 text-[11px] font-mono text-muted-foreground uppercase">
                {p?.mrn && <span>MRN {p.mrn}</span>}
                {p?.dob && <span>DOB {p.dob}</span>}
                {p?.status && <span>Status {p.status}</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {p?.dnr_status && <PrecautionBadge variant="red" label="DNR" />}
              {atRisk && <PrecautionBadge variant="red" label={`FALL RISK (${fall?.total_score})`} />}
              {consent?.status !== "complete" && <PrecautionBadge variant="amber" label="CONSENT PENDING" />}
              {skin && (
                <PrecautionBadge
                  variant={skin.status === "abnormal" ? "red" : "neutral"}
                  label={`SKIN ${skin.status.toUpperCase()} · ${skin.assessment_date}`}
                />
              )}
              {allergyCount.total > 0 && (
                <PrecautionBadge
                  variant={allergyCount.critical > 0 ? "red" : "amber"}
                  label={`ALLERGIES ${allergyCount.total}${allergyCount.critical ? ` · ${allergyCount.critical} CRIT` : ""}`}
                />
              )}
            </div>
          </div>
        </div>
        <div className="px-8 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const href = t.to.replace("$patientId", patientId);
            const active = t.end ? pathname === href : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={t.to}
                to={t.to}
                params={{ patientId }}
                className={"px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 " + (active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-6 p-6 lg:p-8">
        <div className="min-w-0">
          <Outlet />
        </div>
        <aside className="space-y-4 xl:sticky xl:top-44 xl:self-start">
          <div className="border border-border bg-card p-4 space-y-3">
            <div className="aspect-square w-full bg-muted overflow-hidden border border-border grid place-items-center">
              {p?.photo_url ? (
                <img src={p.photo_url} alt="Patient" className="w-full h-full object-cover" />
              ) : (
                <div className="text-[10px] font-mono uppercase text-muted-foreground">No photo</div>
              )}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhotoSelected(f); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-2 hover:bg-muted disabled:opacity-50">
                  <Upload className="size-3" /> {uploading ? "Uploading…" : p?.photo_url ? "Replace" : "Upload"}
                </button>
                {p?.photo_url && (
                  <button onClick={removePhoto} className="inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest border border-border px-2 py-2 hover:bg-muted text-destructive">
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="border border-border bg-card p-4 space-y-2 text-sm">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2 mb-2">Saved Details</div>
            <Row k="Name" v={p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "—" : "—"} />
            <Row k="MRN" v={p?.mrn ?? "—"} />
            <Row k="DOB" v={p?.dob ?? "—"} />
            <Row k="Phone" v={p?.phone ?? "—"} />
            <Row k="Address" v={p ? ([p.address, p.city, p.state, p.zip].filter(Boolean).join(", ") || "—") : "—"} />
            <Row k="Physician" v={p?.primary_physician ?? "—"} />
            <Row k="Insurance" v={p?.insurance_carrier ?? p?.insurance ?? "—"} />
            <Row k="Policy #" v={p?.insurance_policy ?? "—"} />
            <Row k="Status" v={p?.status ?? "—"} />
            {p?.dnr_status && <div className="mt-2 inline-block bg-destructive/10 text-destructive text-[10px] font-bold uppercase px-2 py-1">DNR</div>}
          </div>
        </aside>
      </div>
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
