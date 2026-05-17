import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { FormSection, FieldLabel, TextInput } from "@/components/app/FormSection";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

function SettingsPage() {
  const navigate = useNavigate();
  const { user, roles, loading } = useCurrentUser();
  const [profile, setProfile] = useState<{ full_name: string; email: string; phone: string; license_no: string }>({
    full_name: "", email: "", phone: "", license_no: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [prefs, setPrefs] = useState({ email_alerts: true, in_app_alerts: true });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, email, phone, license_no, notification_prefs").eq("id", user.id).single().then(({ data }) => {
      if (data) setProfile({
        full_name: data.full_name ?? "",
        email: data.email ?? user.email ?? "",
        phone: data.phone ?? "",
        license_no: data.license_no ?? "",
      });
      const np = (data as any)?.notification_prefs;
      if (np && typeof np === "object") {
        setPrefs({
          email_alerts: np.email_alerts ?? true,
          in_app_alerts: np.in_app_alerts ?? true,
        });
      }
    });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name || null,
      phone: profile.phone || null,
      license_no: profile.license_no || null,
    }).eq("id", user.id);
    setSavingProfile(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
  };

  const changePassword = async () => {
    if (pwd.next.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (pwd.next !== pwd.confirm) { toast.error("Passwords do not match"); return; }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setPwdSaving(false);
    if (error) { toast.error(error.message); return; }
    setPwd({ next: "", confirm: "" });
    toast.success("Password updated");
  };

  const savePrefs = async (next: typeof prefs) => {
    setPrefs(next);
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ notification_prefs: next as any })
      .eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Preferences saved");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="animate-entrance">
      <PageHeader eyebrow="Settings" title="Account & Preferences" />
      <div className="p-8 max-w-3xl space-y-8">
        <FormSection title="Account" description="Identity used across the application.">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel>Full Name</FieldLabel>
              <TextInput value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} placeholder="Jane Doe" />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <TextInput value={profile.email} disabled />
            </div>
            <div>
              <FieldLabel>Phone</FieldLabel>
              <TextInput value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="(555) 555-5555" />
            </div>
            <div>
              <FieldLabel>License Number</FieldLabel>
              <TextInput value={profile.license_no} onChange={(e) => setProfile((p) => ({ ...p, license_no: e.target.value }))} placeholder="RN-000000" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              {loading ? "" : `Role: ${roles.length ? roles.join(", ") : "patient"}`}
            </div>
            <button
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
              className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90"
            >
              {savingProfile ? "Saving…" : "Save Profile"}
            </button>
          </div>
        </FormSection>

        <FormSection title="Security" description="Change your account password.">
          <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
            <div>
              <FieldLabel>New Password</FieldLabel>
              <TextInput type="password" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} placeholder="min 8 characters" />
            </div>
            <div>
              <FieldLabel>Confirm Password</FieldLabel>
              <TextInput type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} />
            </div>
          </div>
          <button
            type="button"
            onClick={changePassword}
            disabled={pwdSaving || !pwd.next}
            className="mt-4 px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-foreground text-background disabled:opacity-40"
          >
            {pwdSaving ? "Updating…" : "Update Password"}
          </button>
        </FormSection>

        <FormSection title="Notifications" description="Control how you receive alerts.">
          {([
            { key: "email_alerts" as const, label: "Email alerts for new visits, signatures, and incidents" },
            { key: "in_app_alerts" as const, label: "In-app alerts for assigned tasks" },
          ]).map((pref) => (
            <label key={pref.key} className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
              <span className="text-sm">{pref.label}</span>
              <button
                type="button"
                onClick={() => savePrefs({ ...prefs, [pref.key]: !prefs[pref.key] })}
                className={"w-12 h-6 rounded-full relative transition " + (prefs[pref.key] ? "bg-primary" : "bg-muted")}
                aria-pressed={prefs[pref.key]}
              >
                <span className={"absolute top-0.5 w-5 h-5 rounded-full bg-background transition " + (prefs[pref.key] ? "left-6" : "left-0.5")} />
              </button>
            </label>
          ))}
        </FormSection>

        <FormSection title="Session">
          <button
            type="button"
            onClick={signOut}
            className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Sign Out
          </button>
        </FormSection>
      </div>
    </div>
  );
}