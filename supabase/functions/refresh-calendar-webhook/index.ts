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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "" // Use service role for background tasks
    );

    // Get all expired or soon-to-expire webhooks
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

    const { data: expiredConnections, error } = await supabaseClient
      .from("calendar_connections")
      .select("*")
      .eq("provider", "google")
      .eq("is_active", true)
      .eq("sync_enabled", true)
      .or(
        `webhook_expiration.is.null,webhook_expiration.lt.${oneDayFromNow.toISOString()}`
      );

    if (error) {
      console.error("Error fetching expired connections:", error);
      throw error;
    }

    if (!expiredConnections || expiredConnections.length === 0) {
      console.log("No expired webhooks found");
      return new Response(
        JSON.stringify({ success: true, message: "No expired webhooks found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(
      `Found ${expiredConnections.length} connections with expired or expiring webhooks`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const connection of expiredConnections) {
      try {
        console.log(`Processing connection for user ${connection.user_id}:`, {
          calendar_id: connection.calendar_id,
          expires_at: connection.expires_at,
          webhook_id: connection.webhook_id,
          webhook_expiration: connection.webhook_expiration,
        });

        // Refresh token if needed
        let accessToken = connection.access_token;

        // Safely check if token is expired
        let isTokenExpired = false;
        if (connection.expires_at) {
          try {
            const expiresAt = new Date(connection.expires_at);
            if (!isNaN(expiresAt.getTime())) {
              isTokenExpired = expiresAt <= new Date();
            } else {
              console.warn(
                `Invalid expires_at date for user ${connection.user_id}: ${connection.expires_at}`
              );
              isTokenExpired = true; // Assume expired if invalid date
            }
          } catch (dateError) {
            console.warn(
              `Error parsing expires_at for user ${connection.user_id}:`,
              dateError
            );
            isTokenExpired = true; // Assume expired if parsing fails
          }
        } else {
          isTokenExpired = true; // Assume expired if no expiration date
        }

        if (isTokenExpired) {
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

            // Update stored tokens with safe date conversion
            try {
              const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
              await supabaseClient
                .from("calendar_connections")
                .update({
                  access_token: tokens.access_token,
                  expires_at: newExpiresAt.toISOString(),
                })
                .eq("id", connection.id);
            } catch (dateError) {
              console.error(
                `Error updating expires_at for user ${connection.user_id}:`,
                dateError
              );
              // Continue without updating the expiration date
            }
          } else {
            console.error(`Token refresh failed for user ${connection.user_id}:`, tokens);
            errorCount++;
            continue;
          }
        }

        // Stop existing webhook if it exists
        if (connection.webhook_id) {
          try {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
                connection.calendar_id
              )}/events/stop`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  id: connection.webhook_id,
                  resourceId: connection.webhook_id,
                }),
              }
            );
            console.log(
              `Stopped existing webhook ${connection.webhook_id} for user ${connection.user_id}`
            );
          } catch (stopError) {
            console.warn(
              `Failed to stop existing webhook for user ${connection.user_id}:`,
              stopError
            );
            // Continue anyway, Google will handle duplicate webhooks
          }
        }

        // Set up new webhook
        const webhookUrl = `${Deno.env.get(
          "SUPABASE_URL"
        )}/functions/v1/google-calendar-webhook`;

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
              id: `webhook-${connection.user_id}-${Date.now()}`, // Unique webhook ID
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
          console.error(`Watch setup failed for user ${connection.user_id}:`, watchData);
          errorCount++;
          continue;
        }

        // Update webhook information in database
        let webhookExpiration: string | null = null;

        // Handle the expiration date properly
        if (watchData.expiration) {
          try {
            // Google returns expiration as a timestamp in milliseconds
            const expirationTimestamp = parseInt(watchData.expiration);
            if (!isNaN(expirationTimestamp)) {
              webhookExpiration = new Date(expirationTimestamp).toISOString();
            } else {
              // Try parsing as ISO string
              webhookExpiration = new Date(watchData.expiration).toISOString();
            }
          } catch (dateError) {
            console.warn(
              `Invalid expiration date from Google: ${watchData.expiration}`,
              dateError
            );
            // Set a default expiration (30 days from now)
            webhookExpiration = new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString();
          }
        } else {
          // Set a default expiration if none provided
          webhookExpiration = new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString();
        }

        await supabaseClient
          .from("calendar_connections")
          .update({
            webhook_id: watchData.id,
            webhook_expiration: webhookExpiration,
            last_sync_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        console.log(
          `Successfully refreshed webhook for user ${connection.user_id}:`,
          watchData.id
        );
        successCount++;
      } catch (error) {
        console.error(`Error refreshing webhook for user ${connection.user_id}:`, error);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook refresh completed",
        results: {
          total: expiredConnections.length,
          successful: successCount,
          failed: errorCount,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error refreshing calendar webhooks:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
