
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScheduledSession } from '@/types';
import { toast } from 'sonner';

export const useScheduledSessions = () => {
  const [scheduledSessions, setScheduledSessions] = useState<ScheduledSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch scheduled sessions from database (RLS ensures user isolation)
  const fetchScheduledSessions = async () => {
    try {
      console.log('=== SCHEDULED SESSIONS FETCH DEBUG START ===');
      
      // Verify user is authenticated
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('Auth user check:', { user: user?.id, error: userError });
      
      if (userError) {
        console.error('Auth error:', userError);
        setScheduledSessions([]);
        setLoading(false);
        return;
      }
      
      if (!user) {
        console.log('No authenticated user');
        setScheduledSessions([]);
        setLoading(false);
        return;
      }

      console.log('Fetching scheduled sessions for user:', user.id);

      // Test RLS by trying to fetch with explicit user_id filter
      const { data: explicitData, error: explicitError } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: true });

      console.log('Explicit user_id filter query:', { 
        data: explicitData?.length, 
        error: explicitError,
        sample: explicitData?.[0] 
      });

      // Regular query (should be filtered by RLS)
      const { data, error } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      console.log('RLS-filtered query:', { 
        data: data?.length, 
        error: error,
        sample: data?.[0],
        allUserIds: data?.map(s => s.user_id)
      });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Scheduled sessions fetched:', data?.length || 0);
      console.log('User IDs in results:', [...new Set(data?.map(s => s.user_id) || [])]);

      const formattedSessions: ScheduledSession[] = (data || []).map(session => ({
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
      console.log('=== SCHEDULED SESSIONS FETCH DEBUG END ===');
    } catch (error) {
      console.error('Error fetching scheduled sessions:', error);
      toast.error('Failed to load scheduled sessions');
      setScheduledSessions([]);
    } finally {
      setLoading(false);
    }
  };

  // Complete a session
  const completeSession = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

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

  // Clear all scheduled sessions (used before recalculating)
  const clearScheduledSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      console.log('Clearing scheduled sessions for user:', user.id);

      const { error } = await supabase
        .from('scheduled_sessions')
        .delete()
        .eq('status', 'scheduled'); // RLS will ensure only user's sessions are deleted

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing scheduled sessions:', error);
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
    clearScheduledSessions,
    refetch: fetchScheduledSessions
  };
};
