import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
        navigate({ to: "/dashboard" });
      } else {
        const redirectUrl = `${window.location.origin}/dashboard`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("Account created");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="size-9 bg-primary rounded-sm grid place-items-center">
            <div className="size-4 border-2 border-white rotate-45" />
          </div>
          <div>
            <h1 className="font-extrabold tracking-tight text-lg leading-none">ACT SYSTEM</h1>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">American Care Team</p>
          </div>
        </div>

        <div className="border border-border bg-card p-8 animate-entrance">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight">{mode === "signin" ? "Sign in" : "Create account"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Access the clinical workspace." : "Use the email from your invitation."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Full name</label>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm focus:border-primary focus:outline-none" />
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm font-mono focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Password</label>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-border bg-background text-sm font-mono focus:border-primary focus:outline-none" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground py-2.5 text-sm font-bold tracking-wide disabled:opacity-60">
              {loading ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-xs font-medium text-muted-foreground hover:text-foreground">
              {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-6 font-mono uppercase tracking-widest">
          HIPAA-compliant clinical workspace
        </p>
      </div>
    </div>
  );
}
