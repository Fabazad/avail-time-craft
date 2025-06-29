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
    const { code, state } = await req.json();

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

    console.log("Exchanging authorization code for tokens...");

    // Get the origin from the request headers or use SUPABASE_URL as fallback
    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
      Deno.env.get("SUPABASE_URL")?.replace("/supabase", "") ||
      "";

    console.log("Using redirect URI:", origin);

    // Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
        code,
        grant_type: "authorization_code",
        redirect_uri: origin,
      }),
    });

    const tokens = await tokenResponse.json();
    console.log("Token response:", {
      success: tokenResponse.ok,
      hasAccessToken: !!tokens.access_token,
    });

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", tokens);
      throw new Error(
        `Token exchange failed: ${tokens.error_description || tokens.error}`
      );
    }

    // Get user's calendar list
    console.log("Fetching user calendars...");
    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const calendars = await calendarResponse.json();
    console.log("Calendar response:", {
      success: calendarResponse.ok,
      calendarCount: calendars.items?.length,
    });

    if (!calendarResponse.ok) {
      console.error("Calendar fetch failed:", calendars);
      throw new Error(`Failed to fetch calendars: ${calendars.error?.message}`);
    }

    const primaryCalendar =
      calendars.items?.find((cal: any) => cal.primary) || calendars.items?.[0];

    if (!primaryCalendar) {
      throw new Error("No calendar found");
    }

    console.log("Storing connection in database...");

    // Store connection in database with explicit user_id
    const { error } = await supabaseClient.from("calendar_connections").upsert({
      user_id: user.id, // Explicit user_id
      provider: "google",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      calendar_id: primaryCalendar.id,
      is_active: true,
      sync_enabled: true,
    });

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    console.log("Connection stored successfully");

    // Set up webhook for the connected calendar
    try {
      console.log("Setting up calendar webhook...");
      const webhookResponse = await supabaseClient.functions.invoke(
        "setup-calendar-webhook",
        {
          headers: {
            Authorization: `Bearer ${req.headers.get("Authorization")}`,
          },
        }
      );

      if (webhookResponse.error) {
        console.warn("Webhook setup failed:", webhookResponse.error);
        // Don't fail the entire connection process if webhook setup fails
      } else {
        console.log("Webhook set up successfully:", webhookResponse.data);
      }
    } catch (webhookError) {
      console.warn("Webhook setup error:", webhookError);
      // Don't fail the entire connection process if webhook setup fails
    }

    return new Response(
      JSON.stringify({ success: true, calendar_id: primaryCalendar.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Google Calendar Auth Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
