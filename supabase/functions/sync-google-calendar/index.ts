
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Get active calendar connection
    const { data: connection } = await supabaseClient
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('is_active', true)
      .single()

    if (!connection) {
      throw new Error('No active Google Calendar connection found')
    }

    // Refresh token if needed
    let accessToken = connection.access_token
    if (new Date(connection.expires_at) <= new Date()) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
          refresh_token: connection.refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      const tokens = await refreshResponse.json()
      if (refreshResponse.ok) {
        accessToken = tokens.access_token
        
        // Update stored tokens
        await supabaseClient
          .from('calendar_connections')
          .update({
            access_token: tokens.access_token,
            expires_at: new Date(Date.now() + (tokens.expires_in * 1000)).toISOString(),
          })
          .eq('id', connection.id)
      }
    }

    // Fetch events from the last sync time or past 30 days
    const timeMin = connection.last_sync_at || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events?` +
      `timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const events = await eventsResponse.json()

    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch events: ${events.error?.message}`)
    }

    // Process and store events
    const eventsToInsert = events.items
      ?.filter((event: any) => event.start?.dateTime && event.end?.dateTime)
      .map((event: any) => ({
        user_id: user.id,
        calendar_id: connection.calendar_id,
        event_id: event.id,
        summary: event.summary || 'No Title',
        start_time: event.start.dateTime,
        end_time: event.end.dateTime,
      })) || []

    if (eventsToInsert.length > 0) {
      // Use upsert to handle existing events
      const { error } = await supabaseClient
        .from('google_calendar_events')
        .upsert(eventsToInsert, { 
          onConflict: 'calendar_id,event_id',
          ignoreDuplicates: false 
        })

      if (error) {
        throw error
      }
    }

    // Update last sync time
    await supabaseClient
      .from('calendar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced_events: eventsToInsert.length,
        message: `Synced ${eventsToInsert.length} events from Google Calendar`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error syncing calendar:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
