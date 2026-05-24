import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { PageHeader } from "@/components/app/PageHeader";
import { FieldLabel, TextInput, FormSection } from "@/components/app/FormSection";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Mail, Trash2, UserPlus, Copy, Check, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff/")({ component: StaffPage });

type Profile = { id: string; email: string | null; full_name: string | null; phone: string | null; license_no: string | null; active: boolean; photo_url: string | null };
type Role = { id: string; user_id: string; role: "admin" | "rn" | "caregiver" | "patient" };
type Invite = { id: string; email: string; role: string; created_at: string; accepted_at: string | null; accepted_by: string | null; token: string | null };

const ROLES: Role["role"][] = ["admin", "rn", "caregiver", "patient"];

function StaffPage() {
  const { primaryRole } = useCurrentUser();
  const isAdmin = primaryRole === "admin";

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role["role"]>("caregiver");
  const [copied, setCopied] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const inviteUrl = (token: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/accept-invite/${token}`;

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(inviteUrl(token));
    setCopied(token);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(null), 1500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: i }] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name", { ascending: true }),
      supabase.from("user_roles").select("*"),
      supabase.from("staff_invitations").select("*").order("created_at", { ascending: false }),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setRoles((r ?? []) as Role[]);
    setInvites((i ?? []) as Invite[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const rolesFor = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("staff_invitations").insert({ email: email.trim().toLowerCase(), role, invited_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success(`Invitation recorded for ${email}. They will be assigned ${role} on signup.`);
    setEmail("");
    load();
  };

  const revokeInvite = async (i: Invite) => {
    if (!confirm(`Revoke invitation for ${i.email}?`)) return;
    const { error } = await supabase.from("staff_invitations").delete().eq("id", i.id);
    if (error) return toast.error(error.message);
    load();
  };

  const addRole = async (uid: string, r: Role["role"]) => {
    if (rolesFor(uid).includes(r)) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: r });
    if (error) return toast.error(error.message);
    load();
  };

  const removeRole = async (uid: string, r: Role["role"]) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", r);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleActive = async (p: Profile) => {
    const { error } = await supabase.from("profiles").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    load();
  };

  if (!isAdmin) {
    return (
      <>
        <PageHeader eyebrow="Staff" title="Staff & Invitations" />
        <div className="p-8 text-sm text-muted-foreground">Admin access required.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Staff" title="Staff & Invitations" description="Invite new users and manage their roles." />
      <div className="p-8 space-y-8">
        <div className="border border-border bg-card p-6">
          <FormSection title="Invite New User" description="A pending invitation will assign the chosen role automatically when the person signs up with that email.">
            <form onSubmit={sendInvite} className="grid md:grid-cols-[2fr_1fr_auto] gap-3 items-end">
              <div><FieldLabel>Email</FieldLabel><TextInput required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="newhire@example.com" /></div>
              <div><FieldLabel>Role</FieldLabel>
                <select value={role} onChange={(e) => setRole(e.target.value as Role["role"])} className="w-full px-3 py-2 border border-border bg-background text-sm capitalize">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 text-sm font-bold flex items-center gap-1"><UserPlus className="size-4" />Send invite</button>
            </form>
          </FormSection>
        </div>

        <div className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest">Pending Invitations ({invites.filter((i) => !i.accepted_at).length})</h3></div>
          {invites.length === 0 ? <div className="p-6 text-xs text-muted-foreground text-center">No invitations yet.</div> : (
            <table className="w-full text-sm">
              <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
                <tr><th className="px-4 py-2 text-left">Email</th><th className="px-4 py-2 text-left">Role</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-left">Created</th><th className="px-4 py-2 text-right">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invites.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-2 font-mono text-xs flex items-center gap-2"><Mail className="size-3.5 text-muted-foreground" />{i.email}</td>
                    <td className="px-4 py-2 capitalize">{i.role}</td>
                    <td className="px-4 py-2">{i.accepted_at ? <span className="text-primary text-xs font-bold">Accepted</span> : <span className="text-amber-600 text-xs font-bold">Pending</span>}</td>
                    <td className="px-4 py-2 font-mono text-[10px]">{new Date(i.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right">
                      {!i.accepted_at && i.token && (
                        <button onClick={() => copyLink(i.token!)} className="text-muted-foreground hover:text-primary mr-3" title={inviteUrl(i.token)}>
                          {copied === i.token ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                        </button>
                      )}
                      {!i.accepted_at && <button onClick={() => revokeInvite(i)} className="text-muted-foreground hover:text-alert-red"><Trash2 className="size-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border border-border bg-card">
          <div className="px-6 py-4 border-b border-border"><h3 className="text-xs font-bold uppercase tracking-widest">Staff Directory ({profiles.length})</h3></div>
          {loading ? <div className="p-6 text-xs text-muted-foreground text-center">Loading…</div> : (
            <table className="w-full text-sm">
              <thead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">
                <tr><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2 text-left">Email</th><th className="px-4 py-2 text-left">Roles</th><th className="px-4 py-2 text-left">Status</th><th className="px-4 py-2 text-right">Add role</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {profiles.map((p) => {
                  const userRoles = rolesFor(p.id);
                  const unassigned = ROLES.filter((r) => !userRoles.includes(r));
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-semibold">
                        <Link to="/staff/$staffId" params={{ staffId: p.id }} className="hover:underline">
                          {p.full_name ?? "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{p.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {userRoles.length === 0 && <span className="text-[10px] text-muted-foreground">None</span>}
                          {userRoles.map((r) => (
                            <button key={r} onClick={() => removeRole(p.id, r)} title="Remove role" className="bg-primary/10 text-primary text-[10px] font-bold uppercase px-2 py-0.5 hover:bg-alert-red/20 hover:text-alert-red">
                              {r} ✕
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3"><button onClick={() => toggleActive(p)} className={"text-[10px] font-bold uppercase " + (p.active ? "text-primary" : "text-muted-foreground")}>{p.active ? "Active" : "Inactive"}</button></td>
                      <td className="px-4 py-3 text-right">
                        {unassigned.length > 0 && (
                          <select onChange={(e) => { if (e.target.value) { addRole(p.id, e.target.value as Role["role"]); e.target.value = ""; } }} className="border border-border bg-background text-xs px-2 py-1" defaultValue="">
                            <option value="" disabled>+ role</option>
                            {unassigned.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
