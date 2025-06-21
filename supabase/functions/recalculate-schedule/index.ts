import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduledSession {
  id: string;
  projectId: string;
  projectName: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'scheduled' | 'completed' | 'conflicted';
  priority: number;
  color: string;
}

interface TimeSlot {
  start: Date;
  end: Date;
  duration: number;
  isAvailable: boolean;
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

    console.log("=== STARTING SCHEDULE RECALCULATION ===");
    console.log("User ID:", user.id);

    // STEP 1: Clean up existing sessions and calendar events
    await cleanupExistingSessions(supabaseClient, user.id);

    // STEP 2: Fetch user data
    const { projects, availabilityRules } = await fetchUserData(supabaseClient, user.id);

    // STEP 3: Fetch external calendar events
    const googleCalendarEvents = await fetchGoogleCalendarEvents(supabaseClient);

    // STEP 4: Generate new schedule using while loop approach
    const newSessions = generateScheduleWithWhileLoop(projects, availabilityRules, googleCalendarEvents);

    // STEP 5: Save and create calendar events
    const { successCount, errorCount } = await saveAndCreateCalendarEvents(
      supabaseClient, 
      user.id, 
      newSessions
    );

    console.log("=== SCHEDULE RECALCULATION COMPLETED ===");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Schedule recalculated successfully',
        sessionsCount: newSessions.length,
        conflictsAvoided: googleCalendarEvents.length,
        calendarEvents: {
          created: successCount,
          failed: errorCount
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error recalculating schedule:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})

async function cleanupExistingSessions(supabaseClient: any, userId: string) {
  // Get existing scheduled sessions with Google Calendar events
  const { data: existingSessions } = await supabaseClient
    .from("scheduled_sessions")
    .select("google_event_id, project_name")
    .eq("status", "scheduled")
    .eq("user_id", userId)
    .not("google_event_id", "is", null);

  // Delete existing calendar events
  if (existingSessions && existingSessions.length > 0) {
    const { data: connection } = await supabaseClient
      .from("calendar_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "google")
      .eq("is_active", true)
      .maybeSingle();

    if (connection) {
      console.log(`Deleting ${existingSessions.length} existing calendar events...`);
      for (const session of existingSessions) {
        try {
          await supabaseClient.functions.invoke("delete-calendar-event", {
            body: { googleEventId: session.google_event_id }
          });
        } catch (error) {
          console.error(`Failed to delete calendar event:`, error);
        }
      }
    }
  }

  // Clear existing scheduled sessions from database
  const { error: clearError } = await supabaseClient
    .from("scheduled_sessions")
    .delete()
    .eq("status", "scheduled")
    .eq("user_id", userId);

  if (clearError) throw clearError;
}

async function fetchUserData(supabaseClient: any, userId: string) {
  console.log("=== FETCHING USER DATA ===");
  
  const { data: projects, error: projectsError } = await supabaseClient
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: true });

  if (projectsError) {
    console.error("Projects fetch error:", projectsError);
    throw projectsError;
  }

  const { data: availabilityRules, error: rulesError } = await supabaseClient
    .from('availability_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (rulesError) {
    console.error("Availability rules fetch error:", rulesError);
    throw rulesError;
  }

  console.log(`Found ${projects?.length || 0} projects and ${availabilityRules?.length || 0} active availability rules`);

  return { projects: projects || [], availabilityRules: availabilityRules || [] };
}

async function fetchGoogleCalendarEvents(supabaseClient: any) {
  try {
    const { data: calendarData } = await supabaseClient.functions.invoke('fetch-google-calendar-events');
    if (calendarData?.events) {
      const events = calendarData.events
        .filter((event: any) => event.start && event.end)
        .map((event: any) => ({
          start: new Date(event.start),
          end: new Date(event.end),
        }));
      console.log(`Successfully fetched ${events.length} Google Calendar events`);
      return events;
    }
  } catch (error) {
    console.error("Error fetching Google Calendar events:", error);
    console.log("Proceeding without external calendar events");
  }
  return [];
}

// NEW: While loop approach for scheduling
function generateScheduleWithWhileLoop(
  projects: any[],
  availabilityRules: any[],
  externalEvents: any[]
): ScheduledSession[] {
  console.log("=== WHILE LOOP SCHEDULING ENGINE ===");
  console.log("Projects:", projects.length);
  console.log("Availability rules:", availabilityRules.length);
  console.log("External events:", externalEvents.length);

  const activeProjects = projects.filter((p) => p.status !== "completed");
  const sortedProjects = sortProjectsByPriority(activeProjects);

  if (activeProjects.length === 0 || availabilityRules.length === 0) {
    console.log("No active projects or availability rules");
    return [];
  }

  const sessions: ScheduledSession[] = [];
  
  // Process each project in priority order
  for (const project of sortedProjects) {
    let remainingHours = project.estimated_hours;
    console.log(`\n=== Processing project: ${project.name} (${remainingHours}h needed) ===`);
    
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Start from today
    
    // While loop to find slots until all hours are scheduled
    while (remainingHours > 0) {
      const dayOfWeek = currentDate.getDay();
      
      // Check if current day matches any availability rule
      const applicableRule = availabilityRules.find(rule => 
        rule.is_active && rule.day_of_week.includes(dayOfWeek)
      );
      
      if (applicableRule) {
        console.log(`Checking ${currentDate.toDateString()} (day ${dayOfWeek})`);
        
        // Create potential session for this day
        const startTime = parseTime(applicableRule.start_time);
        const endTime = parseTime(applicableRule.end_time);
        
        const sessionStart = new Date(currentDate);
        sessionStart.setHours(startTime.hours, startTime.minutes, 0, 0);
        
        const sessionEnd = new Date(currentDate);
        sessionEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
        
        // Skip if slot is in the past
        if (sessionEnd <= new Date()) {
          console.log(`Skipping past slot: ${sessionStart.toISOString()}`);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        // Adjust start time if it's in the past
        if (sessionStart < new Date()) {
          const now = new Date();
          sessionStart.setTime(now.getTime());
          // Round up to next 15-minute interval
          const minutes = sessionStart.getMinutes();
          const roundedMinutes = Math.ceil(minutes / 15) * 15;
          sessionStart.setMinutes(roundedMinutes, 0, 0);
        }
        
        // Calculate session duration
        const availableDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
        const sessionDuration = Math.min(availableDuration, remainingHours);
        
        if (sessionDuration > 0) {
          const actualSessionEnd = new Date(sessionStart.getTime() + sessionDuration * 60 * 60 * 1000);
          
          // Check for conflicts with external events
          const hasConflict = checkConflictWithExternalEvents(sessionStart, actualSessionEnd, externalEvents);
          
          if (!hasConflict) {
            // No conflict - create the session
            const session: ScheduledSession = {
              id: `${project.id}-${sessions.length}`,
              projectId: project.id,
              projectName: project.name,
              startTime: sessionStart,
              endTime: actualSessionEnd,
              duration: sessionDuration,
              status: "scheduled",
              priority: project.priority,
              color: getProjectColor(project.id),
            };
            
            sessions.push(session);
            remainingHours -= sessionDuration;
            
            console.log(`✅ Scheduled: ${sessionStart.toISOString()} - ${actualSessionEnd.toISOString()} (${sessionDuration}h)`);
            console.log(`Remaining hours: ${remainingHours}h`);
          } else {
            console.log(`❌ Conflict detected for: ${sessionStart.toISOString()} - ${actualSessionEnd.toISOString()}`);
          }
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Safety check to prevent infinite loops (max 365 days ahead)
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 365);
      if (currentDate > maxDate) {
        console.log(`⚠️ Reached maximum scheduling horizon. ${remainingHours}h remaining for ${project.name}`);
        break;
      }
    }
    
    if (remainingHours > 0) {
      console.log(`⚠️ Could not schedule all hours for ${project.name}. Remaining: ${remainingHours}h`);
    } else {
      console.log(`✅ Successfully scheduled all hours for ${project.name}`);
    }
  }
  
  console.log(`\n=== SCHEDULING COMPLETE ===`);
  console.log(`Total sessions created: ${sessions.length}`);
  return sessions;
}

function checkConflictWithExternalEvents(sessionStart: Date, sessionEnd: Date, externalEvents: any[]): boolean {
  if (!externalEvents || externalEvents.length === 0) return false;
  
  for (const event of externalEvents) {
    if (!event.start || !event.end) continue;
    
    // Skip all-day events (they typically don't conflict with specific time slots)
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    
    // Check if it's an all-day event (exactly 24 hours or more, starting at midnight)
    const isAllDay = (
      eventStart.getHours() === 0 && 
      eventStart.getMinutes() === 0 && 
      eventStart.getSeconds() === 0 &&
      (eventEnd.getTime() - eventStart.getTime()) >= 24 * 60 * 60 * 1000
    );
    
    if (isAllDay) {
      console.log(`Skipping all-day event: ${event.start} - ${event.end}`);
      continue;
    }
    
    // Check for overlap with the session
    const hasOverlap = sessionStart < eventEnd && eventStart < sessionEnd;
    if (hasOverlap) {
      console.log(`Conflict with event: ${event.start} - ${event.end}`);
      return true;
    }
  }
  
  return false;
}

function sortProjectsByPriority(projects: any[]): any[] {
  return [...projects].sort((a, b) => a.priority - b.priority);
}

function parseTime(timeString: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeString.split(":").map(Number);
  return { hours, minutes };
}

function getProjectColor(projectId: string): string {
  const colors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#84CC16", "#F97316"];
  const index = parseInt(projectId.slice(-1)) || 0;
  return colors[index % colors.length];
}

async function saveAndCreateCalendarEvents(supabaseClient: any, userId: string, sessions: ScheduledSession[]) {
  if (sessions.length === 0) return { successCount: 0, errorCount: 0 };

  // Save sessions to database
  const sessionsToInsert = sessions.map((session) => ({
    project_id: session.projectId,
    project_name: session.projectName,
    start_time: session.startTime.toISOString(),
    end_time: session.endTime.toISOString(),
    duration: session.duration,
    status: session.status,
    priority: session.priority,
    color: session.color,
    user_id: userId,
  }));

  const { data: insertedSessions, error: insertError } = await supabaseClient
    .from("scheduled_sessions")
    .insert(sessionsToInsert)
    .select();

  if (insertError) throw insertError;

  // Create calendar events
  const { data: connection } = await supabaseClient
    .from("calendar_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("is_active", true)
    .maybeSingle();

  let successCount = 0;
  let errorCount = 0;

  if (connection && insertedSessions) {
    console.log(`Creating ${insertedSessions.length} new calendar events...`);
    
    for (const session of insertedSessions) {
      try {
        await supabaseClient.functions.invoke("create-calendar-event", {
          body: {
            sessionId: session.id,
            title: `Work Session: ${session.project_name}`,
            startTime: session.start_time,
            endTime: session.end_time,
            description: `Scheduled work session for ${session.project_name} (${session.duration} hours)`,
          },
        });
        successCount++;
      } catch (error) {
        console.error(`Failed to create calendar event:`, error);
        errorCount++;
      }
    }
  }

  return { successCount, errorCount };
}
