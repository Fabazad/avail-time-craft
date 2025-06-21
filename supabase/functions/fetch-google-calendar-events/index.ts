
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
      .maybeSingle()

    if (!connection) {
      console.log('No active Google Calendar connection found')
      return new Response(
        JSON.stringify({ events: [] }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Refresh token if needed
    let accessToken = connection.access_token
    if (new Date(connection.expires_at) <= new Date()) {
      console.log('Refreshing access token...')
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
      } else {
        throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`)
      }
    }

    // Fetch events from Google Calendar API
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + 3) // Look 3 months ahead

    console.log(`Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`)

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events?` +
      `timeMin=${encodeURIComponent(startDate.toISOString())}&` +
      `timeMax=${encodeURIComponent(endDate.toISOString())}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    const calendarData = await calendarResponse.json()

    if (!calendarResponse.ok) {
      throw new Error(`Failed to fetch calendar events: ${calendarData.error?.message}`)
    }

    // Process events into the format expected by the scheduling engine
    const events = (calendarData.items || [])
      .filter((event: any) => event.start && event.end)
      .map((event: any) => ({
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        summary: event.summary || 'Untitled Event'
      }))

    console.log(`Successfully fetched ${events.length} calendar events`)

    return new Response(
      JSON.stringify({ events }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error fetching Google Calendar events:', error)
    return new Response(
      JSON.stringify({ error: error.message, events: [] }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 with empty events instead of error to not break scheduling
      }
    )
  }
})
