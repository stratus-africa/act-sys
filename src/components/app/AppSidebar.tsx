import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, ClipboardList, CalendarDays, FileText, Settings, LogOut, UserCog, ChevronDown, ChevronRight, SlidersHorizontal, Stethoscope } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, type AppRole } from "@/lib/use-current-user";
import { NotificationsBell } from "@/components/app/NotificationsBell";

const ALL_NAV: Array<{ to: string; label: string; icon: typeof LayoutDashboard; roles: AppRole[] }> = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "rn", "caregiver", "patient"] },
  { to: "/patients", label: "Patient Registry", icon: Users, roles: ["admin", "rn", "caregiver"] },
  { to: "/assessments", label: "Assessments", icon: Stethoscope, roles: ["admin", "rn", "caregiver"] },
  { to: "/visits", label: "Visits & Scheduling", icon: CalendarDays, roles: ["admin", "rn", "caregiver"] },
  { to: "/timesheets", label: "Timesheets", icon: ClipboardList, roles: ["admin", "rn", "caregiver"] },
  { to: "/reports", label: "Reports", icon: FileText, roles: ["admin", "rn"] },
];

const SETTINGS_CHILDREN: Array<{ to: string; label: string; icon: typeof LayoutDashboard; roles: AppRole[] }> = [
  { to: "/settings", label: "General", icon: SlidersHorizontal, roles: ["admin", "rn", "caregiver", "patient"] },
  { to: "/staff", label: "Staff", icon: UserCog, roles: ["admin"] },
];

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Administrator",
  rn: "Registered Nurse",
  caregiver: "Caregiver",
  patient: "Patient",
};

export function AppSidebar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, primaryRole } = useCurrentUser();

  const visibleNav = ALL_NAV.filter((item) => !primaryRole || item.roles.includes(primaryRole));
  const visibleSettings = SETTINGS_CHILDREN.filter((item) => !primaryRole || item.roles.includes(primaryRole));
  const settingsActive = visibleSettings.some((s) => pathname === s.to || pathname.startsWith(s.to + "/"));
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);
  useEffect(() => { if (settingsActive) setSettingsOpen(true); }, [settingsActive]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <nav className="fixed left-0 top-0 h-full w-64 border-r border-border bg-sidebar hidden lg:flex flex-col z-40">
      <div className="p-5 flex items-center gap-3 border-b border-border">
        <div className="size-8 bg-primary rounded-sm grid place-items-center shrink-0">
          <div className="size-4 border-2 border-white rotate-45" />
        </div>
        <div className="min-w-0">
          <div className="font-extrabold tracking-tight text-sm leading-none truncate">ACT SYSTEM</div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mt-1">American Care Team</div>
        </div>
      </div>

      <div className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clinical Workspace</div>
        {visibleNav.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors " +
                (active
                  ? "bg-primary/5 text-primary font-medium border-l-2 border-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent")
              }
            >
              <item.icon className="size-4 shrink-0" strokeWidth={1.5} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        {visibleSettings.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={
                "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors border-l-2 " +
                (settingsActive
                  ? "bg-primary/5 text-primary font-medium border-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent")
              }
            >
              <Settings className="size-4 shrink-0" strokeWidth={1.5} />
              <span className="truncate flex-1 text-left">Settings</span>
              {settingsOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            </button>
            {settingsOpen && (
              <div className="ml-3 mt-0.5 pl-3 border-l border-border space-y-0.5">
                {visibleSettings.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(item.to + "/");
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={
                        "flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-colors " +
                        (active
                          ? "bg-primary/5 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground")
                      }
                    >
                      <item.icon className="size-3.5 shrink-0" strokeWidth={1.5} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-9 rounded-full bg-primary/10 grid place-items-center text-primary font-bold text-xs">
            {(user?.email ?? "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold truncate">{user?.email ?? "Loading…"}</div>
            {primaryRole && (
              <div className="text-[9px] font-mono text-primary uppercase bg-primary/10 px-1.5 py-0.5 rounded mt-1 inline-block">
                {ROLE_LABEL[primaryRole]}
              </div>
            )}
          </div>
          <NotificationsBell />
        </div>
        <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm">
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </nav>
  );
}
