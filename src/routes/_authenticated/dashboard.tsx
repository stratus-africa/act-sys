import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { useCurrentUser } from "@/lib/use-current-user";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { primaryRole, user } = useCurrentUser();
  return (
    <>
      <PageHeader eyebrow="Workspace" title="Dashboard" description={`Signed in as ${user?.email ?? ""}`} />
      <div className="p-8 max-w-7xl space-y-8 animate-entrance">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/patients" className="border border-border bg-card p-6 hover:border-primary transition-colors">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Patients</div>
            <div className="text-2xl font-extrabold mt-2">Open registry →</div>
          </Link>
          {primaryRole === "admin" && (
            <Link to="/staff" className="border border-border bg-card p-6 hover:border-primary transition-colors">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Staff</div>
              <div className="text-2xl font-extrabold mt-2">Manage invites →</div>
            </Link>
          )}
          <div className="border border-border bg-card p-6">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Your role</div>
            <div className="text-2xl font-extrabold mt-2 capitalize">{primaryRole ?? "—"}</div>
          </div>
        </div>
      </div>
    </>
  );
}
