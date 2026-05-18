import { supabase } from "@/integrations/supabase/client";

/**
 * Notify all admins and RNs about an event. Inserts one row per recipient.
 * Callers should not await long if the user shouldn't wait — fire and forget is fine.
 */
export async function notifyAdminsAndRns(payload: {
  kind: string;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
}) {
  // Fetch every user with admin or rn role.
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "rn"]);
  const userIds = Array.from(new Set((roleRows ?? []).map((r) => r.user_id)));
  if (!userIds.length) return;
  await supabase.from("notifications").insert(
    userIds.map((user_id) => ({
      user_id,
      kind: payload.kind,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
      metadata: payload.metadata ?? {},
    })),
  );
}
