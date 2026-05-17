import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/accept-invite/")({ component: AcceptInvite });

type Invite = { id: string; email: string; role: string; accepted_at: string | null };

function AcceptInvite() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("get_invitation_by_token", { _token: token });
      if (error || !data || (data as Invite[]).length === 0) {
        setError("This invitation link is invalid or has expired.");
      } else {
        const inv = (data as Invite[])[0];
        if (inv.accepted_at) setError("This invitation has already been accepted.");
        else setInvite(inv);
      }
      setChecking(false);
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;
      toast.success(`Welcome — you're set up as ${invite.role}.`);
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md border border-border bg-card p-8">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Staff invitation</div>
        <h1 className="text-2xl font-extrabold mt-1">Accept your invite</h1>

        {checking ? (
          <p className="text-sm text-muted-foreground mt-6">Verifying invitation…</p>
        ) : error ? (
          <>
            <p className="text-sm text-alert-red mt-6">{error}</p>
            <Link to="/login" className="text-xs font-mono uppercase text-primary hover:underline mt-4 inline-block">Back to sign in</Link>
          </>
        ) : invite ? (
          <form onSubmit={submit} className="space-y-4 mt-6">
            <div className="bg-muted/40 p-3 text-xs">
              <div className="font-mono">{invite.email}</div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">Assigned role: <span className="text-primary font-bold">{invite.role}</span></div>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Full name</label>
              <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Choose a password</label>
              <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm mt-1" placeholder="At least 8 characters" />
            </div>
            <button disabled={loading} type="submit" className="w-full bg-primary text-primary-foreground py-3 text-sm font-bold disabled:opacity-50">
              {loading ? "Creating account…" : "Accept & create account"}
            </button>
            <p className="text-[10px] font-mono uppercase text-muted-foreground text-center">
              Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
            </p>
          </form>
        ) : null}
      </div>
    </div>
  );
}
