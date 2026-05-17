import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PrecautionBadge } from "@/components/app/PrecautionBadge";

export const Route = createFileRoute("/_authenticated/patients/$patientId")({ component: PatientShell });

const TABS = [
  { to: "/patients/$patientId", label: "Overview", end: true },
  { to: "/patients/$patientId/consent", label: "Consent & HIPAA" },
  { to: "/patients/$patientId/fall-risk", label: "Fall Risk" },
  { to: "/patients/$patientId/assessment", label: "Participant Assessment" },
  { to: "/patients/$patientId/care-plan", label: "Care Plan" },
  { to: "/patients/$patientId/visits", label: "Visits" },
  { to: "/patients/$patientId/skin", label: "Skin Tracking" },
  { to: "/patients/$patientId/documents", label: "Documents" },
];

function PatientShell() {
  const { patientId } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [p, setP] = useState<any>(null);
  const [fall, setFall] = useState<{ total_score: number; risk_level: string } | null>(null);
  const [consent, setConsent] = useState<{ status: string } | null>(null);
  const [skin, setSkin] = useState<{ status: string; assessment_date: string } | null>(null);

  useEffect(() => {
    supabase.from("patients").select("*").eq("id", patientId).single().then(({ data }) => setP(data));
    supabase.from("fall_risk_assessments").select("total_score, risk_level, assessment_date").eq("patient_id", patientId).order("assessment_date", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setFall(data));
    supabase.from("patient_consents").select("status").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setConsent(data));
    supabase.from("skin_assessments").select("status, assessment_date").eq("patient_id", patientId).order("assessment_date", { ascending: false }).limit(1).maybeSingle().then(({ data }) => setSkin(data));
  }, [patientId]);

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
                  variant={skin.status === "abnormal" ? "red" : "amber"}
                  label={`SKIN ${skin.status.toUpperCase()} · ${skin.assessment_date}`}
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
      <div className="p-8 max-w-7xl">
        <Outlet />
      </div>
    </div>
  );
}