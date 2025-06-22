
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
    const { sessionId, title, startTime, endTime, description } = await req.json()
    
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

    // Get active calendar connection with explicit user_id filter
    const { data: connection } = await supabaseClient
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id) // Explicit filter by user_id
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

    // Create calendar event
    const eventResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          description: description,
          start: {
            dateTime: startTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        }),
      }
    )

    const event = await eventResponse.json()

    if (!eventResponse.ok) {
      throw new Error(`Failed to create event: ${event.error?.message}`)
    }

    // Store the event ID in our database with explicit user_id filter
    await supabaseClient
      .from('scheduled_sessions')
      .update({ google_event_id: event.id })
      .eq('id', sessionId)
      .eq('user_id', user.id) // Explicit filter by user_id

    return new Response(
      JSON.stringify({ 
        success: true, 
        event_id: event.id,
        message: 'Calendar event created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error creating calendar event:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
