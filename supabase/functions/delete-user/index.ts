import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Service unavailable" }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: caller, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !caller.user) return json({ error: "Unauthorized" }, 401);

    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", caller.user.id)
      .maybeSingle();
    if (profileError || !callerProfile?.is_admin) return json({ error: "Forbidden" }, 403);

    const body = await req.json() as { userId?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: "Invalid account" }, 400);
    }
    if (userId === caller.user.id) return json({ error: "You cannot delete your own account" }, 400);

    const { data: files } = await admin.storage.from("songs").list(userId, { limit: 1000 });
    if (files?.length) {
      await admin.storage.from("songs").remove(files.map((file) => `${userId}/${file.name}`));
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) return json({ error: "Could not delete account" }, 500);

    return json({ success: true });
  } catch (error) {
    console.error("delete-user failed", error);
    return json({ error: "Could not delete account" }, 500);
  }
});
