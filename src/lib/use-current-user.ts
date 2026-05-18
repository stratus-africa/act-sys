import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "rn" | "caregiver" | "patient";

// Module-level cache shared across all hook consumers — prevents a refetch storm
// when many components mount and each subscribes to onAuthStateChange.
let cachedUser: User | null = null;
let cachedRoles: AppRole[] = [];
let cachedUserId: string | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

async function loadRoles(user: User | null) {
  cachedUser = user;
  if (!user) {
    cachedRoles = [];
    cachedUserId = null;
    return;
  }
  if (user.id === cachedUserId && cachedRoles.length) return; // already loaded
  cachedUserId = user.id;
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  cachedRoles = (data ?? []).map((r) => r.role as AppRole);
}

async function refresh() {
  if (inflight) return inflight;
  inflight = (async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await loadRoles(session?.user ?? null);
    listeners.forEach((l) => l());
  })();
  try { await inflight; } finally { inflight = null; }
}

let subscribed = false;
function ensureSubscribed() {
  if (subscribed || typeof window === "undefined") return;
  subscribed = true;
  supabase.auth.onAuthStateChange((event, session) => {
    // Only refetch when the actual user identity changes.
    const newId = session?.user?.id ?? null;
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    if (newId === cachedUserId && event !== "SIGNED_OUT") return;
    void refresh();
  });
}

export function useCurrentUser() {
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState(cachedUserId === null && cachedUser === null);

  useEffect(() => {
    ensureSubscribed();
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    if (cachedUserId === null && cachedUser === null) {
      refresh().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => { listeners.delete(listener); };
  }, []);

  return {
    user: cachedUser,
    roles: cachedRoles,
    loading,
    hasRole: (r: AppRole) => cachedRoles.includes(r),
    primaryRole: cachedRoles[0] ?? null,
  };
}
