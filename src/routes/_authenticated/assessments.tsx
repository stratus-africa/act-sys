import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";

export const Route = createFileRoute("/_authenticated/assessments")({ component: AssessmentsLayout });

const TABS = [
  { to: "/assessments/participant", label: "Participant" },
  { to: "/assessments/rn", label: "RN" },
  { to: "/assessments/skin", label: "Skin Tracking" },
  { to: "/assessments/caregiver", label: "Caregiver" },
];

function AssessmentsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <PageHeader eyebrow="Clinical" title="Assessments" description="Cross-patient assessment activity across all forms." />
      <div className="px-8 border-b border-border flex gap-1 overflow-x-auto sticky top-0 bg-background z-20">
        {TABS.map((t) => {
          const active = pathname === t.to || pathname.startsWith(t.to + "/");
          return (
            <Link key={t.to} to={t.to} className={"px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 " + (active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t.label}
            </Link>
          );
        })}
      </div>
      <div className="p-6 lg:p-8">
        <Outlet />
      </div>
    </>
  );
}