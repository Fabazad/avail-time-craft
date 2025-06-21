
import { Project, AvailabilityRule, ScheduledSession } from '@/types';

interface TimeSlot {
  start: Date;
  end: Date;
  duration: number;
  isAvailable: boolean;
}

interface ExternalEvent {
  start: Date;
  end: Date;
}

export class SchedulingEngine {
  generateSchedule(
    projects: Project[],
    availabilityRules: AvailabilityRule[],
    externalEvents: ExternalEvent[] = []
  ): ScheduledSession[] {
    console.log("=== SCHEDULING ENGINE DEBUG ===");
    console.log("Projects:", projects.length);
    console.log("Availability rules:", availabilityRules.length);
    console.log("External events:", externalEvents.length);

    const activeProjects = projects.filter((p) => p.status !== "completed");
    const sortedProjects = this.sortProjectsByPriority(activeProjects);

    console.log("Active projects after filtering:", activeProjects.length);
    
    if (activeProjects.length === 0) {
      console.log("No active projects to schedule");
      return [];
    }

    if (availabilityRules.length === 0) {
      console.log("No availability rules found");
      return [];
    }

    const totalHours = sortedProjects.reduce((sum, p) => sum + p.estimatedHours, 0);
    console.log("Total hours to schedule:", totalHours);
    
    const avgHoursPerWeek = this.calculateAverageHoursPerWeek(availabilityRules);
    console.log("Average hours per week from availability:", avgHoursPerWeek);
    
    const weeksNeeded = Math.max(8, Math.ceil(totalHours / Math.max(avgHoursPerWeek, 1)) + 2);
    console.log("Weeks needed for scheduling:", weeksNeeded);

    const availableSlots = this.generateAvailableSlots(availabilityRules, weeksNeeded * 7);
    console.log("Generated available slots:", availableSlots.length);
    
    // Debug: Log some example slots
    availableSlots.slice(0, 5).forEach((slot, index) => {
      console.log(`Slot ${index + 1}: ${slot.start.toISOString()} - ${slot.end.toISOString()}, duration: ${slot.duration}h, available: ${slot.isAvailable}`);
    });
    
    // Only process external events if they exist and are valid
    const validExternalEvents = externalEvents.filter(event => 
      event && event.start && event.end && 
      event.start instanceof Date && event.end instanceof Date &&
      !isNaN(event.start.getTime()) && !isNaN(event.end.getTime())
    );
    
    console.log("Valid external events to process:", validExternalEvents.length);
    
    if (validExternalEvents.length > 0) {
      console.log("Blocking external calendar events from scheduling...");
      this.blockExternalEvents(availableSlots, validExternalEvents);
      
      const availableSlotsAfterBlocking = availableSlots.filter(slot => slot.isAvailable);
      console.log("Available slots after blocking external events:", availableSlotsAfterBlocking.length);
    }

    const sessions: ScheduledSession[] = [];
    const remainingHours = new Map(sortedProjects.map((p) => [p.id, p.estimatedHours]));

    // Schedule projects in priority order
    for (const project of sortedProjects) {
      const hoursNeeded = remainingHours.get(project.id) || 0;
      console.log(`Processing project ${project.name}, needs ${hoursNeeded} hours`);

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
        const sessionEnd = new Date(slot.start.getTime() + sessionDuration * 60 * 60 * 1000);

        // Double-check for conflicts with valid external events
        if (validExternalEvents.length > 0) {
          const hasConflict = this.hasConflictWithExternalEvents(
            sessionStart,
            sessionEnd,
            validExternalEvents
          );
          if (hasConflict) {
            console.log(`Conflict detected - skipping slot: ${sessionStart.toISOString()} - ${sessionEnd.toISOString()}`);
            slot.isAvailable = false;
            continue;
          }
        }

        // Create session
        const session: ScheduledSession = {
          id: `${project.id}-${sessions.length}`,
          projectId: project.id,
          projectName: project.name,
          startTime: sessionStart,
          endTime: sessionEnd,
          duration: sessionDuration,
          status: "scheduled",
          priority: project.priority,
          color: this.getProjectColor(project.id),
        };

        sessions.push(session);
        scheduledHours += sessionDuration;

        // Mark slot as used
        slot.isAvailable = false;

        console.log(`Scheduled session for ${project.name}: ${sessionStart.toISOString()} - ${sessionEnd.toISOString()}, duration: ${sessionDuration}h`);
      }

      // Update remaining hours
      const remaining = hoursNeeded - scheduledHours;
      remainingHours.set(project.id, remaining);
      
      if (remaining > 0) {
        console.log(`Warning: Could not schedule all hours for ${project.name}. Remaining: ${remaining}h`);
      }
    }

    console.log(`Generated ${sessions.length} total sessions`);
    return sessions;
  }

  private sortProjectsByPriority(projects: Project[]): Project[] {
    return [...projects].sort((a, b) => a.priority - b.priority);
  }

  private calculateAverageHoursPerWeek(rules: AvailabilityRule[]): number {
    const activeRules = rules.filter((rule) => rule.isActive);
    if (activeRules.length === 0) return 0;

    let totalHoursPerWeek = 0;
    for (const rule of activeRules) {
      const startTime = this.parseTime(rule.startTime);
      const endTime = this.parseTime(rule.endTime);
      const hoursPerSession = endTime.hours - startTime.hours + (endTime.minutes - startTime.minutes) / 60;
      const sessionsPerWeek = rule.dayOfWeek.length;
      totalHoursPerWeek += hoursPerSession * sessionsPerWeek;
      
      console.log(`Rule ${rule.name}: ${hoursPerSession}h per session, ${sessionsPerWeek} days per week = ${hoursPerSession * sessionsPerWeek}h per week`);
    }
    return totalHoursPerWeek;
  }

  private generateAvailableSlots(rules: AvailabilityRule[], daysAhead: number): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const startDate = new Date();
    
    console.log(`Generating slots for ${daysAhead} days ahead starting from ${startDate.toISOString()}`);

    for (let i = 0; i < daysAhead; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      currentDate.setHours(0, 0, 0, 0);
      
      const dayOfWeek = currentDate.getDay();
      
      // Find applicable rules for this day
      const applicableRules = rules.filter(
        (rule) => rule.isActive && rule.dayOfWeek.includes(dayOfWeek)
      );

      if (applicableRules.length > 0) {
        console.log(`Day ${i} (${dayOfWeek}): Found ${applicableRules.length} applicable rules`);
      }

      // Create slots for each applicable rule
      for (const rule of applicableRules) {
        const startTime = this.parseTime(rule.startTime);
        const endTime = this.parseTime(rule.endTime);

        let slotStart = new Date(currentDate);
        slotStart.setHours(startTime.hours, startTime.minutes, 0, 0);
        
        const slotEnd = new Date(currentDate);
        slotEnd.setHours(endTime.hours, endTime.minutes, 0, 0);

        // Skip slots that are entirely in the past
        if (slotEnd <= new Date()) {
          console.log(`Skipping past slot: ${slotStart.toISOString()} - ${slotEnd.toISOString()}`);
          continue;
        }

        // Adjust start time if it's in the past
        if (slotStart < new Date()) {
          slotStart = new Date();
          // Round up to next 15-minute interval for cleaner scheduling
          const minutes = slotStart.getMinutes();
          const roundedMinutes = Math.ceil(minutes / 15) * 15;
          slotStart.setMinutes(roundedMinutes, 0, 0);
          console.log(`Adjusted past start time to: ${slotStart.toISOString()}`);
        }

        // Create slot if there's still time available
        if (slotStart < slotEnd) {
          const duration = (slotEnd.getTime() - slotStart.getTime()) / (1000 * 60 * 60);

          slots.push({
            start: slotStart,
            end: slotEnd,
            duration: duration,
            isAvailable: true,
          });
          
          console.log(`Created slot: ${slotStart.toISOString()} - ${slotEnd.toISOString()}, duration: ${duration}h`);
        }
      }
    }

    // Sort slots by start time
    const sortedSlots = slots.sort((a, b) => a.start.getTime() - b.start.getTime());
    console.log(`Total slots generated: ${sortedSlots.length}`);
    
    return sortedSlots;
  }

  private parseTime(timeString: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeString.split(":").map(Number);
    return { hours, minutes };
  }

  private getProjectColor(projectId: string): string {
    const colors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#06B6D4", "#84CC16", "#F97316"];
    const index = parseInt(projectId.slice(-1)) || 0;
    return colors[index % colors.length];
  }

  private hasConflictWithExternalEvents(
    sessionStart: Date,
    sessionEnd: Date,
    externalEvents: ExternalEvent[]
  ): boolean {
    if (!externalEvents || externalEvents.length === 0) return false;
    
    return externalEvents.some((event) => {
      if (!event.start || !event.end) return false;
      return sessionStart < event.end && event.start < sessionEnd;
    });
  }

  private blockExternalEvents(slots: TimeSlot[], externalEvents: ExternalEvent[]): void {
    if (!externalEvents || externalEvents.length === 0) return;

    console.log(`Processing ${externalEvents.length} external events for slot blocking...`);

    let totalBlockedSlots = 0;
    
    for (const event of externalEvents) {
      if (!event.start || !event.end) {
        console.warn("Skipping invalid event:", event);
        continue;
      }

      let blockedCount = 0;
      for (const slot of slots) {
        if (!slot.isAvailable) continue;

        // Check if the slot overlaps with the external event
        const overlaps = slot.start < event.end && event.start < slot.end;

        if (overlaps) {
          slot.isAvailable = false;
          blockedCount++;
          totalBlockedSlots++;
        }
      }
      
      if (blockedCount > 0) {
        console.log(`Blocked ${blockedCount} slots for event: ${event.start.toISOString()} - ${event.end.toISOString()}`);
      }
    }
    
    console.log(`Total slots blocked by external events: ${totalBlockedSlots}`);
  }
}
