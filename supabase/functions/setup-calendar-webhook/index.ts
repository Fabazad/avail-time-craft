import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get user
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get active calendar connection
    const { data: connection } = await supabaseClient
      .from("calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .eq("is_active", true)
      .single();

    if (!connection) {
      throw new Error("No active Google Calendar connection found");
    }

    // Refresh token if needed
    let accessToken = connection.access_token;
    if (new Date(connection.expires_at) <= new Date()) {
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
          client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
          refresh_token: connection.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const tokens = await refreshResponse.json();
      if (refreshResponse.ok) {
        accessToken = tokens.access_token;

        // Update stored tokens
        await supabaseClient
          .from("calendar_connections")
          .update({
            access_token: tokens.access_token,
            expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          })
          .eq("id", connection.id);
      } else {
        throw new Error(
          `Token refresh failed: ${tokens.error_description || tokens.error}`
        );
      }
    }

    // Set up webhook URL
    const webhookUrl = `${Deno.env.get(
      "SUPABASE_URL"
    )}/functions/v1/google-calendar-webhook`;

    // Set up calendar watch
    const watchResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        connection.calendar_id
      )}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: `webhook-${user.id}-${Date.now()}`, // Unique webhook ID
          type: "web_hook",
          address: webhookUrl,
          params: {
            ttl: "2592000", // 30 days in seconds
          },
        }),
      }
    );

    const watchData = await watchResponse.json();

    if (!watchResponse.ok) {
      console.error("Watch setup failed:", watchData);
      throw new Error(`Failed to set up calendar webhook: ${watchData.error?.message}`);
    }

    // Store webhook information in database
    await supabaseClient
      .from("calendar_connections")
      .update({
        webhook_id: watchData.id,
        webhook_expiration: new Date(watchData.expiration).toISOString(),
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    console.log("Calendar webhook set up successfully:", watchData);

    return new Response(
      JSON.stringify({
        success: true,
        webhook_id: watchData.id,
        expiration: watchData.expiration,
        message: "Calendar webhook set up successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error setting up calendar webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
