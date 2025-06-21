
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface GoogleCalendarEvent {
  id: string;
  calendar_id: string;
  event_id: string;
  summary: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

export const useGoogleCalendar = () => {
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('google_calendar_events')
        .select('*')
        .gte('end_time', new Date().toISOString())
        .order('start_time', { ascending: true });

      if (error) throw error;

      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching Google Calendar events:', error);
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  };

  const syncCalendar = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar');

      if (error) throw error;

      toast.success('Calendar synced successfully');
      await fetchEvents(); // Refresh events after sync
      
      return data;
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast.error('Failed to sync calendar');
      throw error;
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return {
    events,
    loading,
    syncCalendar,
    refetch: fetchEvents
  };
};
