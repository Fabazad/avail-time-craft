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

    // Get request body to extract timezone
    const body = await req.json().catch(() => ({}));
    const userTimezone = body.timezone || 'UTC';
    
    console.log("=== STARTING SCHEDULE RECALCULATION ===");
    console.log("User ID:", user.id);
    console.log("User timezone:", userTimezone);

    // STEP 1: Clean up existing sessions and calendar events
    await cleanupExistingSessions(supabaseClient, user.id);

    // STEP 2: Fetch user data
    const { projects, availabilityRules } = await fetchUserData(supabaseClient, user.id);

    // STEP 3: Fetch external calendar events
    const googleCalendarEvents = await fetchGoogleCalendarEvents(supabaseClient);

    // STEP 4: Generate new schedule using while loop approach with timezone
    const newSessions = generateScheduleWithWhileLoop(projects, availabilityRules, googleCalendarEvents, userTimezone);

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

// Updated: While loop approach for scheduling with timezone support
function generateScheduleWithWhileLoop(
  projects: any[],
  availabilityRules: any[],
  externalEvents: any[],
  userTimezone: string = 'UTC'
): ScheduledSession[] {
  console.log("=== WHILE LOOP SCHEDULING ENGINE ===");
  console.log("Projects:", projects.length);
  console.log("Availability rules:", availabilityRules.length);
  console.log("External events:", externalEvents.length);
  console.log("User timezone:", userTimezone);

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
    
    // Get current date in user's timezone
    let currentDate = new Date();
    // Convert to user timezone for date calculations
    const userDate = new Date(currentDate.toLocaleString("en-US", {timeZone: userTimezone}));
    userDate.setHours(0, 0, 0, 0); // Start from today in user timezone
    
    // While loop to find slots until all hours are scheduled
    while (remainingHours > 0) {
      const dayOfWeek = userDate.getDay();
      
      // Check if current day matches any availability rule
      const applicableRule = availabilityRules.find(rule => 
        rule.is_active && rule.day_of_week.includes(dayOfWeek)
      );
      
      if (applicableRule) {
        console.log(`Checking ${userDate.toDateString()} (day ${dayOfWeek}) in ${userTimezone}`);
        
        // Create potential session for this day in user timezone
        const startTime = parseTime(applicableRule.start_time);
        const endTime = parseTime(applicableRule.end_time);
        
        // Create session start/end times in user timezone
        const sessionStart = new Date(userDate);
        sessionStart.setHours(startTime.hours, startTime.minutes, 0, 0);
        
        const sessionEnd = new Date(userDate);
        sessionEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
        
        // Convert to UTC for storage and comparison
        const sessionStartUTC = new Date(sessionStart.toLocaleString("en-US", {timeZone: "UTC"}));
        const sessionEndUTC = new Date(sessionEnd.toLocaleString("en-US", {timeZone: "UTC"}));
        
        // Skip if slot is in the past (compare in user timezone)
        const nowInUserTz = new Date(new Date().toLocaleString("en-US", {timeZone: userTimezone}));
        if (sessionEnd <= nowInUserTz) {
          console.log(`Skipping past slot: ${sessionStart.toLocaleString()} ${userTimezone}`);
          userDate.setDate(userDate.getDate() + 1);
          continue;
        }
        
        // Adjust start time if it's in the past
        if (sessionStart < nowInUserTz) {
          const adjustedStart = new Date(nowInUserTz);
          // Round up to next 15-minute interval
          const minutes = adjustedStart.getMinutes();
          const roundedMinutes = Math.ceil(minutes / 15) * 15;
          adjustedStart.setMinutes(roundedMinutes, 0, 0);
          sessionStart.setTime(adjustedStart.getTime());
          console.log(`Adjusted past start time to: ${sessionStart.toLocaleString()} ${userTimezone}`);
        }
        
        // Calculate session duration
        const availableDuration = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
        const sessionDuration = Math.min(availableDuration, remainingHours);
        
        if (sessionDuration > 0) {
          const actualSessionEnd = new Date(sessionStart.getTime() + sessionDuration * 60 * 60 * 1000);
          
          // Convert to UTC for conflict checking
          const sessionStartUTCFinal = convertToUTC(sessionStart, userTimezone);
          const sessionEndUTCFinal = convertToUTC(actualSessionEnd, userTimezone);
          
          // Check for conflicts with external events (in UTC)
          const hasConflict = checkConflictWithExternalEvents(sessionStartUTCFinal, sessionEndUTCFinal, externalEvents);
          
          if (!hasConflict) {
            // No conflict - create the session (store in UTC)
            const session: ScheduledSession = {
              id: `${project.id}-${sessions.length}`,
              projectId: project.id,
              projectName: project.name,
              startTime: sessionStartUTCFinal,
              endTime: sessionEndUTCFinal,
              duration: sessionDuration,
              status: "scheduled",
              priority: project.priority,
              color: getProjectColor(project.id),
            };
            
            sessions.push(session);
            remainingHours -= sessionDuration;
            
            console.log(`✅ Scheduled: ${sessionStart.toLocaleString()} - ${actualSessionEnd.toLocaleString()} ${userTimezone} (${sessionDuration}h)`);
            console.log(`Remaining hours: ${remainingHours}h`);
          } else {
            console.log(`❌ Conflict detected for: ${sessionStart.toLocaleString()} - ${actualSessionEnd.toLocaleString()} ${userTimezone}`);
          }
        }
      }
      
      // Move to next day
      userDate.setDate(userDate.getDate() + 1);
      
      // Safety check to prevent infinite loops (max 365 days ahead)
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 365);
      if (userDate > maxDate) {
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

// Helper function to convert local time to UTC
function convertToUTC(localDate: Date, timezone: string): Date {
  // Create a date string in the target timezone and parse it as UTC
  const utcString = localDate.toLocaleString("sv-SE", {timeZone: "UTC"});
  const localString = localDate.toLocaleString("sv-SE", {timeZone: timezone});
  
  // Calculate the offset and apply it
  const utcTime = new Date(utcString).getTime();
  const localTime = new Date(localString).getTime();
  const offset = utcTime - localTime;
  
  return new Date(localDate.getTime() + offset);
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
