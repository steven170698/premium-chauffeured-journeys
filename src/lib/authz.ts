/** Server-side admin check. Uses the caller's RLS-bound supabase client
 *  to read their own row from user_roles (allowed by user_roles_self_read). */
export async function isAdmin(context: { supabase: any; userId: string }): Promise<boolean> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

export async function assertAdmin(context: { supabase: any; userId: string }) {
  if (!(await isAdmin(context))) throw new Error("Forbidden");
}
