import { Project, AvailabilityRule, ScheduledSession, TimeSlot } from '@/types';
import { startOfDay, addDays, addHours, addMinutes, isBefore, isAfter, format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

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
    
    // Block time slots that conflict with external events (Google Calendar)
    this.blockExternalEvents(availableSlots, externalEvents);
    
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
        
        // Create session
        const session: ScheduledSession = {
          id: `${project.id}-${sessions.length}`,
          projectId: project.id,
          projectName: project.name,
          startTime: slot.start,
          endTime: addHours(slot.start, sessionDuration),
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
   * Blocks time slots that conflict with external events (like Google Calendar)
   */
  private blockExternalEvents(slots: TimeSlot[], externalEvents: { start: Date; end: Date }[]): void {
    for (const event of externalEvents) {
      for (const slot of slots) {
        if (slot.isAvailable && 
            isBefore(event.start, slot.end) && 
            isAfter(event.end, slot.start)) {
          slot.isAvailable = false;
        }
      }
    }
  }
}

/**
 * Main function to schedule projects - clears existing scheduled sessions and creates new ones
 * Now includes Google Calendar conflict detection
 */
export const scheduleProjects = async (
  projects: Project[], 
  availabilityRules: AvailabilityRule[], 
  googleCalendarEvents: { start: Date; end: Date }[] = []
): Promise<void> => {
  const engine = new SchedulingEngine();
  
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
  
  console.log(`Generated ${newSessions.length} sessions for ${projects.length} projects`);
  
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
    
    const { error } = await supabase
      .from('scheduled_sessions')
      .insert(sessionsToInsert);
      
    if (error) {
      console.error('Error saving scheduled sessions:', error);
      throw error;
    }
    
    console.log(`Successfully saved ${sessionsToInsert.length} sessions to database`);
  }
};
