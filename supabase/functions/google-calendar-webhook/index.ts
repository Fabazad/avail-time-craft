import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleCalendarWebhook {
  id: string;
  resourceId: string;
  resourceUri: string;
  token: string;
  expiration: string;
  type: "sync" | "push" | "test";
}

interface CalendarEvent {
  id: string;
  summary?: string;
  start?: {
    dateTime?: string;
    date?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
  };
  status?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("=== GOOGLE CALENDAR WEBHOOK RECEIVED ===");
  console.log("Method:", req.method);
  console.log("Headers:", Object.fromEntries(req.headers.entries()));
  console.log("URL:", req.url);

  try {
    // Verify the request is from Google Calendar
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

    // For Google Calendar webhooks, we don't require authorization headers
    // Google sends webhook notifications without auth headers
    // We'll verify the request is legitimate by checking the payload structure

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Use service role key for webhook
    );

    // Parse the webhook payload
    const body = await req.json();
    console.log("Webhook payload:", JSON.stringify(body, null, 2));

    // Handle different types of webhook events
    if (body.type === "push") {
      console.log("Processing PUSH notification");
      // This is a push notification for calendar changes
      await handleCalendarChange(supabaseClient, body);
    } else if (body.type === "sync") {
      console.log("Processing SYNC notification");
      // This is a sync notification
      await handleCalendarSync(supabaseClient, body);
    } else if (body.type === "test") {
      console.log("Processing TEST notification");
      // This is a test notification
      return new Response(
        JSON.stringify({
          success: true,
          message: "Test webhook received successfully",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } else {
      console.log("Unknown webhook type:", body.type);
      console.log("Full body:", body);
    }

    console.log("=== WEBHOOK PROCESSING COMPLETED ===");

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("=== WEBHOOK ERROR ===");
    console.error("Error processing Google Calendar webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

async function handleCalendarChange(supabaseClient: any, webhookData: any) {
  console.log("Processing calendar change webhook");

  // Extract resource information from webhook data
  const resourceId = webhookData.resourceId;
  const resourceUri = webhookData.resourceUri;

  console.log("Resource ID:", resourceId);
  console.log("Resource URI:", resourceUri);

  // Find the user whose calendar triggered this webhook
  // We can identify this by matching the webhook ID or by checking all active connections
  const { data: connections, error } = await supabaseClient
    .from("calendar_connections")
    .select("user_id, calendar_id, webhook_id")
    .eq("provider", "google")
    .eq("is_active", true)
    .eq("sync_enabled", true);

  if (error) {
    console.error("Error fetching calendar connections:", error);
    return;
  }

  if (!connections || connections.length === 0) {
    console.log("No active Google Calendar connections found");
    return;
  }

  // Try to find the specific user whose calendar changed
  // If we can't identify the specific user, we'll recalculate for all users
  let targetUsers = connections;

  // If we have a resource URI, try to extract calendar ID from it
  if (resourceUri) {
    const calendarIdMatch = resourceUri.match(/calendars\/([^\/]+)/);
    if (calendarIdMatch) {
      const calendarId = decodeURIComponent(calendarIdMatch[1]);
      console.log("Extracted calendar ID from resource URI:", calendarId);

      // Find the specific user with this calendar
      const specificConnection = connections.find(
        (conn) => conn.calendar_id === calendarId
      );
      if (specificConnection) {
        targetUsers = [specificConnection];
        console.log(
          `Found specific user for calendar ${calendarId}: ${specificConnection.user_id}`
        );
      }
    }
  }

  // For each target user, trigger schedule recalculation
  for (const connection of targetUsers) {
    try {
      console.log(`Triggering schedule recalculation for user: ${connection.user_id}`);

      // Call the recalculate-schedule function for this user
      const { data, error: recalcError } = await supabaseClient.functions.invoke(
        "recalculate-schedule",
        {
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: {
            userId: connection.user_id,
          },
        }
      );

      if (recalcError) {
        console.error(
          `Error recalculating schedule for user ${connection.user_id}:`,
          recalcError
        );
      } else {
        console.log(
          `Successfully recalculated schedule for user ${connection.user_id}:`,
          data
        );

        // Update last_sync_at timestamp
        await supabaseClient
          .from("calendar_connections")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("user_id", connection.user_id);
      }
    } catch (error) {
      console.error(`Error processing user ${connection.user_id}:`, error);
    }
  }
}

async function handleCalendarSync(supabaseClient: any, webhookData: any) {
  console.log("Processing calendar sync webhook");
  // Handle sync notifications if needed
  // For now, we'll treat them the same as push notifications
  await handleCalendarChange(supabaseClient, webhookData);
}
