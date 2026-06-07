// Deletes the calling user's account: storage objects first, then the auth
// user (FK cascades clean tiles/albums/album_tiles). Required in-app by App
// Store guideline 5.1.1(v). Used by both the web app and the iOS app.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify the caller from their JWT — never trust a user id in the body.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Remove the user's captured images (best effort, paginated).
    for (;;) {
      const { data: files, error: listError } = await admin.storage
        .from("tiles")
        .list(user.id, { limit: 100 });
      if (listError || !files || files.length === 0) break;
      const { error: removeError } = await admin.storage
        .from("tiles")
        .remove(files.map((f) => `${user.id}/${f.name}`));
      if (removeError) break;
    }

    // Delete the auth user — cascades take the rows with it.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) return json({ error: deleteError.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
