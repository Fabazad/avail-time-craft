
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
    const { googleEventId } = await req.json()
    
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

    // Delete calendar event
    const deleteResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendar_id)}/events/${encodeURIComponent(googleEventId)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      // 404 is OK - event might already be deleted
      const errorData = await deleteResponse.json().catch(() => ({}))
      throw new Error(`Failed to delete event: ${errorData.error?.message || deleteResponse.statusText}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Calendar event deleted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error deleting calendar event:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
