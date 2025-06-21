
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

      return data;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw error;
    }
  };

  const createEventsForSessions = async (sessions: any[]) => {
    const results = [];
    let successCount = 0;
    let errorCount = 0;

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

    if (successCount > 0) {
      toast.success(`Created ${successCount} calendar events`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to create ${errorCount} calendar events`);
    }

    return results;
  };

  return {
    createCalendarEvent,
    createEventsForSessions
  };
};
