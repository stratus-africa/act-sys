import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PrecautionBadge } from "@/components/app/PrecautionBadge";

export const Route = createFileRoute("/_authenticated/patients/")({ component: PatientShell });

type Patient = { id: string; first_name: string; last_name: string; mrn: string | null; dnr_status: boolean };

const TABS = [
  { to: "/patients/$patientId", label: "Overview", exact: true },
  { to: "/patients/$patientId/consent", label: "Consent & HIPAA" },
  { to: "/patients/$patientId/assessments", label: "Assessments" },
  { to: "/patients/$patientId/fall-risk", label: "Fall Risk" },
  { to: "/patients/$patientId/care-plan", label: "Care Plan" },
  { to: "/patients/$patientId/skin", label: "Skin" },
  { to: "/patients/$patientId/visits", label: "Visits" },
];

function PatientShell() {
  const { patientId } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [patient, setPatient] = useState<Patient | null>(null);
  const [fallScore, setFallScore] = useState<number | null>(null);
  const [consentComplete, setConsentComplete] = useState(false);

  useEffect(() => {
    supabase.from("patients").select("id, first_name, last_name, mrn, dnr_status").eq("id", patientId).single().then(({ data }) => setPatient(data as Patient | null));
    supabase.from("fall_risk_assessments").select("total_score").eq("patient_id", patientId).order("assessment_date", { ascending: false }).limit(1).then(({ data }) => setFallScore(data?.[0]?.total_score ?? null));
    supabase.from("patient_consents").select("status").eq("patient_id", patientId).eq("status", "complete").limit(1).then(({ data }) => setConsentComplete((data ?? []).length > 0));
  }, [patientId, pathname]);

  if (!patient) return <div className="p-8 text-sm text-muted-foreground">Loading patient…</div>;

  const atRisk = (fallScore ?? 0) >= 4;

  return (
    <>
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="px-8 py-6 animate-entrance">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-extrabold tracking-tight uppercase">{patient.last_name}, {patient.first_name}</h1>
            <span className="font-mono text-sm text-muted-foreground">#{patient.mrn ?? patient.id.slice(0, 8)}</span>
          </div>
          <div className="flex gap-2 flex-wrap mt-2">
            {atRisk && <PrecautionBadge variant="red" label="Fall Precautions" />}
            {patient.dnr_status && <PrecautionBadge variant="neutral" label="DNR" />}
            {consentComplete ? (
              <span className="px-2 py-1 bg-green-100 text-green-800 text-[10px] font-bold font-mono tracking-wider uppercase">Consent Complete</span>
            ) : (
              <span className="px-2 py-1 bg-alert-amber text-white text-[10px] font-bold font-mono tracking-wider uppercase">Consent Pending</span>
            )}
          </div>

          <div className="flex gap-1 border-b border-border mt-6 -mb-6 overflow-x-auto">
            {TABS.map((t) => {
              const active = t.exact
                ? pathname === `/patients/${patientId}`
                : pathname.startsWith(`/patients/${patientId}${t.to.replace("/patients/$patientId", "")}`);
              return (
                <Link key={t.to} to={t.to} params={{ patientId }} className={"px-4 py-2 text-sm font-medium whitespace-nowrap " + (active ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground")}>
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>
      <div className="p-8 max-w-7xl">
        <Outlet />
      </div>
    </>
  );
}
