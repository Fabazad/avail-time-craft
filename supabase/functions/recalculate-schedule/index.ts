
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

    // STEP 4: Generate new schedule using imported engine logic
    const newSessions = generateSchedule(projects, availabilityRules, googleCalendarEvents);

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

// Inline scheduling logic (simplified version of the SchedulingEngine)
function generateSchedule(projects: any[], availabilityRules: any[], externalEvents: any[]) {
  console.log("=== GENERATING SCHEDULE ===");
  console.log("Projects:", projects.length);
  console.log("Availability rules:", availabilityRules.length);
  console.log("External events:", externalEvents.length);

  const activeProjects = projects.filter((p) => p.status !== "completed");
  if (activeProjects.length === 0 || availabilityRules.length === 0) {
    console.log("No active projects or availability rules");
    return [];
  }

  const sortedProjects = activeProjects.sort((a, b) => a.priority - b.priority);
  const totalHours = sortedProjects.reduce((sum, p) => sum + p.estimated_hours, 0);
  
  // Generate time slots
  const slots = generateTimeSlots(availabilityRules, 56); // 8 weeks
  console.log(`Generated ${slots.length} time slots`);
  
  // Block external events
  if (externalEvents.length > 0) {
    blockExternalEvents(slots, externalEvents);
    const availableAfterBlocking = slots.filter(s => s.isAvailable).length;
    console.log(`${availableAfterBlocking} slots available after blocking external events`);
  }

  // Schedule projects
  const sessions: ScheduledSession[] = [];
  for (const project of sortedProjects) {
    let remainingHours = project.estimated_hours;
    
    for (const slot of slots) {
      if (!slot.isAvailable || remainingHours <= 0) continue;
      
      const sessionDuration = Math.min(slot.duration, remainingHours);
      const sessionEnd = new Date(slot.start.getTime() + sessionDuration * 60 * 60 * 1000);
      
      sessions.push({
        id: `${project.id}-${sessions.length}`,
        projectId: project.id,
        projectName: project.name,
        startTime: slot.start,
        endTime: sessionEnd,
        duration: sessionDuration,
        status: "scheduled",
        priority: project.priority,
        color: getProjectColor(project.id),
      });
      
      remainingHours -= sessionDuration;
      slot.isAvailable = false;
      
      console.log(`Scheduled ${sessionDuration}h for ${project.name}`);
    }
  }

  console.log(`Generated ${sessions.length} total sessions`);
  return sessions;
}

function generateTimeSlots(rules: any[], days: number) {
  const slots: any[] = [];
  const startDate = new Date();
  
  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    currentDate.setHours(0, 0, 0, 0);
    
    const dayOfWeek = currentDate.getDay();
    const applicableRules = rules.filter(rule => 
      rule.is_active && rule.day_of_week.includes(dayOfWeek)
    );

    for (const rule of applicableRules) {
      const [startHours, startMinutes] = rule.start_time.split(":").map(Number);
      const [endHours, endMinutes] = rule.end_time.split(":").map(Number);

      let slotStart = new Date(currentDate);
      slotStart.setHours(startHours, startMinutes, 0, 0);
      
      const slotEnd = new Date(currentDate);
      slotEnd.setHours(endHours, endMinutes, 0, 0);

      if (slotEnd <= new Date()) continue;

      if (slotStart < new Date()) {
        slotStart = new Date();
        const minutes = slotStart.getMinutes();
        const roundedMinutes = Math.ceil(minutes / 15) * 15;
        slotStart.setMinutes(roundedMinutes, 0, 0);
      }

      if (slotStart < slotEnd) {
        const duration = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60 * 60);
        slots.push({
          start: slotStart,
          end: slotEnd,
          duration: duration,
          isAvailable: true,
        });
      }
    }
  }
  
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function blockExternalEvents(slots: any[], externalEvents: any[]) {
  for (const event of externalEvents) {
    if (!event.start || !event.end) continue;
    
    for (const slot of slots) {
      if (!slot.isAvailable) continue;
      
      const overlaps = slot.start < event.end && event.start < slot.end;
      if (overlaps) {
        slot.isAvailable = false;
      }
    }
  }
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
