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
      } else {
        throw new Error(
          `Token refresh failed: ${tokens.error_description || tokens.error}`
        );
      }
    }

    // Check current webhook status
    let webhookStatus = {
      hasWebhook: !!connection.webhook_id,
      webhookId: connection.webhook_id,
      webhookExpiration: connection.webhook_expiration,
      isExpired: false,
      lastSync: connection.last_sync_at,
      calendarId: connection.calendar_id,
    };

    // Check if webhook is expired
    if (connection.webhook_expiration) {
      const expiration = new Date(connection.webhook_expiration);
      webhookStatus.isExpired = expiration <= new Date();
    }

    // Test webhook endpoint accessibility
    const webhookUrl = `${Deno.env.get(
      "SUPABASE_URL"
    )}/functions/v1/google-calendar-webhook`;
    let webhookAccessible = false;
    try {
      const testResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "test",
          resourceId: "test",
          resourceUri: "test",
        }),
      });
      webhookAccessible = testResponse.ok;
    } catch (error) {
      console.log("Webhook endpoint test failed:", error);
    }

    // Get calendar events to verify access
    let calendarAccessible = false;
    let eventCount = 0;
    try {
      const eventsResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          connection.calendar_id
        )}/events?maxResults=5`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        calendarAccessible = true;
        eventCount = eventsData.items?.length || 0;
      }
    } catch (error) {
      console.log("Calendar access test failed:", error);
    }

    return new Response(
      JSON.stringify({
        success: true,
        webhookStatus,
        webhookUrl,
        webhookAccessible,
        calendarAccessible,
        eventCount,
        message: "Webhook status check completed",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error checking webhook status:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
