import { useEffect, useState, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as Notification[]);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const unread = items.filter((i) => !i.read_at).length;

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, read_at: new Date().toISOString() } : i));
  };

  const markAll = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
    setItems((prev) => prev.map((i) => i.read_at ? i : { ...i, read_at: now }));
  };

  const dismiss = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted"
        aria-label="Notifications"
      >
        <Bell className="size-4" strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full min-w-[16px] h-[16px] grid place-items-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-card border border-border shadow-lg z-50 max-h-[480px] flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest">Notifications</h3>
              {unread > 0 && (
                <button onClick={markAll} className="text-[10px] font-mono uppercase text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-6 text-xs text-muted-foreground text-center">No notifications.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => (
                    <li key={n.id} className={"px-4 py-3 group " + (n.read_at ? "opacity-60" : "bg-primary/5")}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          {n.link ? (
                            <Link to={n.link} onClick={() => { markRead(n.id); setOpen(false); }} className="text-sm font-semibold hover:text-primary block">
                              {n.title}
                            </Link>
                          ) : (
                            <div className="text-sm font-semibold">{n.title}</div>
                          )}
                          {n.body && <div className="text-xs text-muted-foreground mt-1">{n.body}</div>}
                          <div className="text-[10px] font-mono uppercase text-muted-foreground mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100">
                          {!n.read_at && (
                            <button onClick={() => markRead(n.id)} className="text-[9px] font-mono uppercase text-primary hover:underline">Read</button>
                          )}
                          <button onClick={() => dismiss(n.id)} className="text-muted-foreground hover:text-alert-red" title="Dismiss">
                            <X className="size-3" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
