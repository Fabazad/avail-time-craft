
import { Project, AvailabilityRule, ScheduledSession, TimeSlot } from '@/types';
import { startOfDay, addDays, addHours, addMinutes, isBefore, isAfter, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export class SchedulingEngine {
  
  /**
   * Generates a complete schedule for all projects based on availability rules
   * Now includes conflict detection with Google Calendar events
   */
  generateSchedule(
    projects: Project[], 
    availabilityRules: AvailabilityRule[], 
    externalEvents: { start: Date; end: Date }[] = []
  ): ScheduledSession[] {
    const activeProjects = projects.filter(p => p.status !== 'completed');
    const sortedProjects = this.sortProjectsByPriority(activeProjects);
    
    // Calculate how many weeks we need based on total project hours and available hours per week
    const totalHours = sortedProjects.reduce((sum, p) => sum + p.estimatedHours, 0);
    const avgHoursPerWeek = this.calculateAverageHoursPerWeek(availabilityRules);
    const weeksNeeded = Math.max(8, Math.ceil(totalHours / Math.max(avgHoursPerWeek, 1)) + 2);
    
    const availableSlots = this.generateAvailableSlots(availabilityRules, weeksNeeded * 7);
    
    // Block time slots that conflict with external events (Google Calendar) - improved logic
    console.log(`Blocking ${externalEvents.length} external calendar events from scheduling`);
    this.blockExternalEventsImproved(availableSlots, externalEvents);
    
    const sessions: ScheduledSession[] = [];
    const remainingHours = new Map(sortedProjects.map(p => [p.id, p.estimatedHours]));
    
    // Schedule projects in priority order
    for (const project of sortedProjects) {
      const hoursNeeded = remainingHours.get(project.id) || 0;
      
      if (hoursNeeded <= 0) continue;
      
      let scheduledHours = 0;
      
      // Find suitable time slots for this project
      for (let slotIndex = 0; slotIndex < availableSlots.length && scheduledHours < hoursNeeded; slotIndex++) {
        const slot = availableSlots[slotIndex];
        
        if (!slot.isAvailable) {
          continue;
        }
        
        // Calculate session duration (use full slot or remaining hours, whichever is smaller)
        const sessionDuration = Math.min(slot.duration, hoursNeeded - scheduledHours);
        
        // Create potential session
        const sessionStart = slot.start;
        const sessionEnd = addHours(slot.start, sessionDuration);
        
        // Double-check for conflicts with external events before creating session
        const hasConflict = this.hasConflictWithExternalEvents(sessionStart, sessionEnd, externalEvents);
        if (hasConflict) {
          console.log(`Skipping slot due to conflict: ${sessionStart.toISOString()} - ${sessionEnd.toISOString()}`);
          slot.isAvailable = false;
          continue;
        }
        
        // Create session
        const session: ScheduledSession = {
          id: `${project.id}-${sessions.length}`,
          projectId: project.id,
          projectName: project.name,
          startTime: sessionStart,
          endTime: sessionEnd,
          duration: sessionDuration,
          status: 'scheduled',
          priority: project.priority,
          color: this.getProjectColor(project.id)
        };
        
        sessions.push(session);
        scheduledHours += sessionDuration;
        
        // Mark slot as used
        slot.isAvailable = false;
      }
      
      // Update remaining hours
      remainingHours.set(project.id, hoursNeeded - scheduledHours);
    }
    
    return sessions;
  }
  
  /**
   * Improved method to check for conflicts with external events
   */
  private hasConflictWithExternalEvents(
    sessionStart: Date, 
    sessionEnd: Date, 
    externalEvents: { start: Date; end: Date }[]
  ): boolean {
    return externalEvents.some(event => {
      // Check if the session overlaps with any external event
      // Two time ranges overlap if: start1 < end2 AND start2 < end1
      const overlaps = sessionStart < event.end && event.start < sessionEnd;
      
      if (overlaps) {
        console.log(`Conflict detected between session (${sessionStart.toISOString()} - ${sessionEnd.toISOString()}) and external event (${event.start.toISOString()} - ${event.end.toISOString()})`);
      }
      
      return overlaps;
    });
  }
  
  /**
   * Calculate average available hours per week
   */
  private calculateAverageHoursPerWeek(rules: AvailabilityRule[]): number {
    const activeRules = rules.filter(rule => rule.isActive);
    if (activeRules.length === 0) return 0;
    
    let totalHoursPerWeek = 0;
    
    for (const rule of activeRules) {
      const startTime = this.parseTime(rule.startTime);
      const endTime = this.parseTime(rule.endTime);
      const hoursPerSession = endTime.hours - startTime.hours + (endTime.minutes - startTime.minutes) / 60;
      const sessionsPerWeek = rule.dayOfWeek.length;
      totalHoursPerWeek += hoursPerSession * sessionsPerWeek;
    }
    
    return totalHoursPerWeek;
  }
  
  /**
   * Sorts projects by priority (1 = highest priority)
   */
  private sortProjectsByPriority(projects: Project[]): Project[] {
    return [...projects].sort((a, b) => a.priority - b.priority);
  }
  
  /**
   * Generates available time slots based on availability rules
   */
  private generateAvailableSlots(rules: AvailabilityRule[], daysAhead: number): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const startDate = new Date();
    
    for (let i = 0; i < daysAhead; i++) {
      const currentDate = addDays(startOfDay(startDate), i);
      const dayOfWeek = currentDate.getDay();
      
      // Find applicable rules for this day
      const applicableRules = rules.filter(rule => 
        rule.isActive && rule.dayOfWeek.includes(dayOfWeek)
      );
      
      // Create slots for each applicable rule
      for (const rule of applicableRules) {
        const startTime = this.parseTime(rule.startTime);
        const endTime = this.parseTime(rule.endTime);
        
        let slotStart = addMinutes(addHours(currentDate, startTime.hours), startTime.minutes);
        const slotEnd = addMinutes(addHours(currentDate, endTime.hours), endTime.minutes);
        
        // Skip slots that are in the past
        if (isBefore(slotEnd, new Date())) {
          continue;
        }
        
        // Adjust start time if it's in the past
        if (isBefore(slotStart, new Date())) {
          slotStart = new Date();
          // Round up to next 15-minute interval for cleaner scheduling
          const minutes = slotStart.getMinutes();
          const roundedMinutes = Math.ceil(minutes / 15) * 15;
          slotStart.setMinutes(roundedMinutes, 0, 0);
        }
        
        // Create slot if there's still time available
        if (isBefore(slotStart, slotEnd)) {
          const duration = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60 * 60);
          
          slots.push({
            start: slotStart,
            end: slotEnd,
            duration: duration,
            isAvailable: true
          });
        }
      }
    }
    
    // Sort slots by start time
    return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  }
  
  /**
   * Parses time string (HH:MM) into hours and minutes
   */
  private parseTime(timeString: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours, minutes };
  }
  
  /**
   * Gets a color for a project based on its ID
   */
  private getProjectColor(projectId: string): string {
    const colors = [
      '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', 
      '#EF4444', '#06B6D4', '#84CC16', '#F97316'
    ];
    const index = parseInt(projectId.slice(-1)) || 0;
    return colors[index % colors.length];
  }
  
  /**
   * Handles conflicts when external events overlap with scheduled sessions
   */
  resolveConflicts(sessions: ScheduledSession[], conflicts: { start: Date; end: Date }[]): ScheduledSession[] {
    return sessions.map(session => {
      const hasConflict = conflicts.some(conflict => 
        (isBefore(session.startTime, conflict.end) && isAfter(session.endTime, conflict.start))
      );
      
      if (hasConflict) {
        return { ...session, status: 'conflicted' as const };
      }
      
      return session;
    });
  }
  
  /**
   * Reschedules conflicted sessions to the next available slots
   */
  rescheduleConflictedSessions(
    sessions: ScheduledSession[], 
    projects: Project[], 
    availabilityRules: AvailabilityRule[]
  ): ScheduledSession[] {
    const conflictedSessions = sessions.filter(s => s.status === 'conflicted');
    const nonConflictedSessions = sessions.filter(s => s.status !== 'conflicted');
    
    if (conflictedSessions.length === 0) {
      return sessions;
    }
    
    // Get available slots and exclude already scheduled time
    const availableSlots = this.generateAvailableSlots(availabilityRules, 30); // Look further ahead
    
    // Block out time slots that are already taken by non-conflicted sessions
    for (const session of nonConflictedSessions) {
      this.blockTimeSlot(availableSlots, session.startTime, session.endTime);
    }
    
    const rescheduledSessions: ScheduledSession[] = [...nonConflictedSessions];
    
    // Reschedule conflicted sessions
    for (const conflictedSession of conflictedSessions) {
      const newSlot = this.findNextAvailableSlot(availableSlots, conflictedSession.duration);
      
      if (newSlot) {
        const rescheduledSession: ScheduledSession = {
          ...conflictedSession,
          startTime: newSlot.start,
          endTime: addHours(newSlot.start, conflictedSession.duration),
          status: 'scheduled'
        };
        
        rescheduledSessions.push(rescheduledSession);
        this.blockTimeSlot(availableSlots, newSlot.start, rescheduledSession.endTime);
      }
    }
    
    return rescheduledSessions.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }
  
  /**
   * Blocks a time slot in the available slots array
   */
  private blockTimeSlot(slots: TimeSlot[], start: Date, end: Date): void {
    for (const slot of slots) {
      if (slot.isAvailable && 
          isBefore(start, slot.end) && 
          isAfter(end, slot.start)) {
        slot.isAvailable = false;
      }
    }
  }
  
  /**
   * Finds the next available slot that can accommodate the required duration
   */
  private findNextAvailableSlot(slots: TimeSlot[], requiredDuration: number): TimeSlot | null {
    return slots.find(slot => 
      slot.isAvailable && slot.duration >= requiredDuration
    ) || null;
  }
  
  /**
   * Improved method to block time slots that conflict with external events
   */
  private blockExternalEventsImproved(slots: TimeSlot[], externalEvents: { start: Date; end: Date }[]): void {
    for (const event of externalEvents) {
      console.log(`Blocking external event: ${event.start.toISOString()} - ${event.end.toISOString()}`);
      
      for (const slot of slots) {
        if (!slot.isAvailable) continue;
        
        // Check if the slot overlaps with the external event
        // Two time ranges overlap if: start1 < end2 AND start2 < end1
        const overlaps = slot.start < event.end && event.start < slot.end;
        
        if (overlaps) {
          console.log(`Blocking slot: ${slot.start.toISOString()} - ${slot.end.toISOString()}`);
          slot.isAvailable = false;
        }
      }
    }
  }
  
  /**
   * Legacy method - kept for compatibility
   */
  private blockExternalEvents(slots: TimeSlot[], externalEvents: { start: Date; end: Date }[]): void {
    this.blockExternalEventsImproved(slots, externalEvents);
  }
}

/**
 * Main function to schedule projects - fetches Google Calendar events first to avoid conflicts
 */
export const scheduleProjects = async (
  projects: Project[], 
  availabilityRules: AvailabilityRule[]
): Promise<void> => {
  const engine = new SchedulingEngine();
  
  // Fetch Google Calendar events to avoid conflicts - improved fetching
  let googleCalendarEvents: { start: Date; end: Date }[] = [];
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Check if user has an active calendar connection
      const { data: connection } = await supabase
        .from('calendar_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .eq('is_active', true)
        .maybeSingle();
      
      if (connection) {
        console.log('Active Google Calendar connection found, fetching events...');
        
        // Fetch Google Calendar events from the database with expanded time range
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 3); // Look 3 months ahead
        
        const { data: events, error } = await supabase
          .from('google_calendar_events')
          .select('start_time, end_time, summary')
          .eq('user_id', user.id)
          .gte('end_time', startDate.toISOString())
          .lte('start_time', endDate.toISOString());
        
        if (error) {
          console.error('Error fetching Google Calendar events:', error);
        } else if (events && events.length > 0) {
          googleCalendarEvents = events.map(event => ({
            start: new Date(event.start_time),
            end: new Date(event.end_time)
          }));
          
          console.log(`Successfully fetched ${googleCalendarEvents.length} Google Calendar events for conflict avoidance`);
          
          // Log events for debugging
          googleCalendarEvents.forEach((event, index) => {
            console.log(`Event ${index + 1}: ${event.start.toISOString()} - ${event.end.toISOString()}`);
          });
        } else {
          console.log('No Google Calendar events found in the specified time range');
        }
      } else {
        console.log('No active Google Calendar connection found');
      }
    }
  } catch (error) {
    console.error('Error fetching Google Calendar events for conflict avoidance:', error);
    // Continue with scheduling even if we can't fetch calendar events
  }
  
  // Get existing scheduled sessions with Google Calendar events before deleting them
  const { data: existingSessions } = await supabase
    .from('scheduled_sessions')
    .select('google_event_id, project_name')
    .eq('status', 'scheduled')
    .not('google_event_id', 'is', null);

  // Delete existing calendar events first
  if (existingSessions && existingSessions.length > 0) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if user has an active calendar connection
      const { data: connection } = await supabase
        .from('calendar_connections')
        .select('id')
        .eq('user_id', user?.id)
        .eq('provider', 'google')
        .eq('is_active', true)
        .maybeSingle();
      
      if (connection) {
        // Delete existing calendar events
        let successCount = 0;
        let errorCount = 0;

        toast.info(`Deleting ${existingSessions.length} existing calendar events...`);

        for (const session of existingSessions) {
          try {
            await supabase.functions.invoke('delete-calendar-event', {
              body: {
                googleEventId: session.google_event_id
              }
            });
            successCount++;
          } catch (error) {
            console.error(`Failed to delete calendar event:`, error);
            errorCount++;
          }
        }

        // Show summary toast for deletions
        if (successCount > 0 && errorCount === 0) {
          toast.success(`All ${successCount} existing calendar events deleted successfully!`);
        } else if (successCount > 0 && errorCount > 0) {
          toast.warning(`${successCount} events deleted, ${errorCount} failed to delete`);
        } else if (errorCount > 0) {
          toast.error(`Failed to delete existing calendar events`);
        }
      }
    } catch (calendarError) {
      console.error('Error deleting existing calendar events:', calendarError);
      toast.error('Failed to delete existing calendar events', {
        description: calendarError.message || 'Unknown error occurred'
      });
      // Continue with scheduling even if deletion fails
    }
  }
  
  // Clear existing scheduled sessions (keep completed ones)
  const { error: clearError } = await supabase
    .from('scheduled_sessions')
    .delete()
    .eq('status', 'scheduled');
    
  if (clearError) {
    console.error('Error clearing existing sessions:', clearError);
    throw clearError;
  }
  
  // Generate new schedule with Google Calendar conflicts considered
  const newSessions = engine.generateSchedule(projects, availabilityRules, googleCalendarEvents);
  
  console.log(`Generated ${newSessions.length} sessions for ${projects.length} projects, successfully avoiding ${googleCalendarEvents.length} Google Calendar conflicts`);
  
  // Save new sessions to database
  if (newSessions.length > 0) {
    const sessionsToInsert = newSessions.map(session => ({
      project_id: session.projectId,
      project_name: session.projectName,
      start_time: session.startTime.toISOString(),
      end_time: session.endTime.toISOString(),
      duration: session.duration,
      status: session.status,
      priority: session.priority,
      color: session.color
    }));
    
    const { data: insertedSessions, error } = await supabase
      .from('scheduled_sessions')
      .insert(sessionsToInsert)
      .select();
      
    if (error) {
      console.error('Error saving scheduled sessions:', error);
      throw error;
    }
    
    console.log(`Successfully saved ${sessionsToInsert.length} sessions to database`);
    
    // Create calendar events for the new sessions with individual toast notifications
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check if user has an active calendar connection
      const { data: connection } = await supabase
        .from('calendar_connections')
        .select('id')
        .eq('user_id', user?.id)
        .eq('provider', 'google')
        .eq('is_active', true)
        .maybeSingle();
      
      if (connection && insertedSessions) {
        // Show initial toast for calendar event creation process
        toast.info(`Creating ${insertedSessions.length} Google Calendar events...`);
        
        let successCount = 0;
        let errorCount = 0;
        
        // Create calendar events for each session with individual notifications
        for (const session of insertedSessions) {
          try {
            await supabase.functions.invoke('create-calendar-event', {
              body: {
                sessionId: session.id,
                title: `Work Session: ${session.project_name}`,
                startTime: session.start_time,
                endTime: session.end_time,
                description: `Scheduled work session for ${session.project_name} (${session.duration} hours)`
              }
            });
            
            // Show success toast for individual event
            toast.success(`Calendar event created for ${session.project_name}`, {
              description: `${new Date(session.start_time).toLocaleString()} - ${new Date(session.end_time).toLocaleString()}`
            });
            
            successCount++;
          } catch (eventError) {
            console.error(`Failed to create calendar event for session ${session.id}:`, eventError);
            
            // Show error toast for individual event
            toast.error(`Failed to create calendar event for ${session.project_name}`, {
              description: eventError.message || 'Unknown error occurred'
            });
            
            errorCount++;
          }
        }
        
        // Show final summary toast
        if (successCount > 0 && errorCount === 0) {
          toast.success(`All ${successCount} calendar events created successfully!`);
        } else if (successCount > 0 && errorCount > 0) {
          toast.warning(`${successCount} events created, ${errorCount} failed`);
        } else if (errorCount > 0) {
          toast.error(`Failed to create all ${errorCount} calendar events`);
        }
        
        console.log('Calendar events creation completed');
      }
    } catch (calendarError) {
      console.error('Error creating calendar events:', calendarError);
      toast.error('Failed to create calendar events', {
        description: calendarError.message || 'Unknown error occurred'
      });
      // Don't throw here - sessions are created successfully, calendar events are optional
    }
  }
};
