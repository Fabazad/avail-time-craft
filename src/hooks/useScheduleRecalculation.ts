
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

export const useScheduleRecalculation = () => {
  const [isRecalculating, setIsRecalculating] = useState(false);

  const recalculateSchedule = async () => {
    setIsRecalculating(true);
    
    try {
      // Verify user is authenticated first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      // Show initial toast
      toast.info('Recalculating schedule...', {
        description: 'This may take a few moments'
      });

      // Get the current session to ensure we have a valid token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session found');
      }

      // Use Paris timezone for all scheduling
      const parisTimezone = 'Europe/Paris';
      console.log('Using Paris timezone:', parisTimezone);

      const { data, error } = await supabase.functions.invoke('recalculate-schedule', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          timezone: parisTimezone
        }
      });

      if (error) throw error;

      // Show success toast with session count only
      toast.success('Schedule updated successfully!', {
        description: `${data.sessionsCount} sessions created`
      });

      return data;
    } catch (error) {
      console.error('Error recalculating schedule:', error);
      toast.error('Failed to recalculate schedule', {
        description: error.message || 'Unknown error occurred'
      });
      throw error;
    } finally {
      setIsRecalculating(false);
    }
  };

  return {
    recalculateSchedule,
    isRecalculating
  };
};
