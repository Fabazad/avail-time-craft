
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

export const useScheduleRecalculation = () => {
  const [isRecalculating, setIsRecalculating] = useState(false);

  const recalculateSchedule = async () => {
    setIsRecalculating(true);
    
    try {
      // Show initial toast
      toast.info('Recalculating schedule...', {
        description: 'This may take a few moments'
      });

      const { data, error } = await supabase.functions.invoke('recalculate-schedule');

      if (error) throw error;

      // Show success toast with details
      toast.success('Schedule updated successfully!', {
        description: `${data.sessionsCount} sessions created, ${data.conflictsAvoided} calendar conflicts avoided`
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
