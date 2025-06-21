
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScheduledSession } from '@/types';
import { toast } from 'sonner';

export const useScheduledSessions = () => {
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch scheduled sessions from database
  const fetchScheduledSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;

      const formattedSessions: ScheduledSession[] = data.map(session => ({
        id: session.id,
        projectId: session.project_id,
        projectName: session.project_name,
        startTime: new Date(session.start_time),
        endTime: new Date(session.end_time),
        duration: session.duration,
        status: session.status as 'scheduled' | 'completed' | 'conflicted',
        priority: session.priority,
        color: session.color
      }));

      setScheduledSessions(formattedSessions);
    } catch (error) {
      console.error('Error fetching scheduled sessions:', error);
      toast.error('Failed to load scheduled sessions');
    } finally {
      setLoading(false);
    }
  };

  // Complete a session
  const completeSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId);

      if (error) throw error;

      setScheduledSessions(prev =>
        prev.map(session =>
          session.id === sessionId
            ? { ...session, status: 'completed' as const }
            : session
        )
      );

      toast.success('Session completed');
    } catch (error) {
      console.error('Error completing session:', error);
      toast.error('Failed to complete session');
      throw error;
    }
  };

  useEffect(() => {
    fetchScheduledSessions();
  }, []);

  return {
    scheduledSessions,
    loading,
    completeSession,
    refetch: fetchScheduledSessions
  };
};
