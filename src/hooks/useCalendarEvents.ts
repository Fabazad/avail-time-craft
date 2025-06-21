
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useCalendarEvents = () => {
  const createCalendarEvent = async (session: {
    id: string;
    projectName: string;
    startTime: Date;
    endTime: Date;
    duration: number;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-calendar-event', {
        body: {
          sessionId: session.id,
          title: `Work Session: ${session.projectName}`,
          startTime: session.startTime.toISOString(),
          endTime: session.endTime.toISOString(),
          description: `Scheduled work session for ${session.projectName} (${session.duration} hours)`
        }
      });

      if (error) throw error;

      // Show success toast for individual event
      toast.success(`Calendar event created for ${session.projectName}`, {
        description: `${session.startTime.toLocaleString()} - ${session.endTime.toLocaleString()}`
      });

      return data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      // Show error toast for individual event
      toast.error(`Failed to create calendar event for ${session.projectName}`, {
        description: error.message || 'Unknown error occurred'
      });
      throw error;
    }
  };

  const deleteCalendarEvent = async (googleEventId: string, projectName?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-calendar-event', {
        body: {
          googleEventId
        }
      });

      if (error) throw error;

      // Show success toast for individual event deletion
      if (projectName) {
        toast.success(`Calendar event deleted for ${projectName}`);
      }

      return data;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      // Show error toast for individual event deletion
      if (projectName) {
        toast.error(`Failed to delete calendar event for ${projectName}`, {
          description: error.message || 'Unknown error occurred'
        });
      }
      throw error;
    }
  };

  const deleteEventsForSessions = async (sessions: { google_event_id?: string; project_name: string }[]) => {
    const sessionsWithEvents = sessions.filter(session => session.google_event_id);
    
    if (sessionsWithEvents.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    // Show initial toast indicating start of deletion process
    toast.info(`Deleting ${sessionsWithEvents.length} existing calendar events...`);

    for (const session of sessionsWithEvents) {
      try {
        await deleteCalendarEvent(session.google_event_id!, session.project_name);
        successCount++;
      } catch (error) {
        console.error(`Failed to delete event for session:`, error);
        errorCount++;
      }
    }

    // Show final summary toast for deletions
    if (successCount > 0 && errorCount === 0) {
      toast.success(`All ${successCount} existing calendar events deleted successfully!`);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`${successCount} events deleted, ${errorCount} failed to delete`);
    } else if (errorCount > 0) {
      toast.error(`Failed to delete all ${errorCount} calendar events`);
    }
  };

  const createEventsForSessions = async (sessions: any[]) => {
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Show initial toast indicating start of process
    if (sessions.length > 0) {
      toast.info(`Creating ${sessions.length} calendar events...`);
    }

    for (const session of sessions) {
      try {
        await createCalendarEvent(session);
        successCount++;
      } catch (error) {
        console.error(`Failed to create event for session ${session.id}:`, error);
        errorCount++;
      }
    }

    results.push({ successCount, errorCount });

    // Show final summary toast
    if (successCount > 0 && errorCount === 0) {
      toast.success(`All ${successCount} calendar events created successfully!`);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`${successCount} events created, ${errorCount} failed`);
    } else if (errorCount > 0) {
      toast.error(`Failed to create all ${errorCount} calendar events`);
    }

    return results;
  };

  return {
    createCalendarEvent,
    deleteCalendarEvent,
    deleteEventsForSessions,
    createEventsForSessions
  };
};
